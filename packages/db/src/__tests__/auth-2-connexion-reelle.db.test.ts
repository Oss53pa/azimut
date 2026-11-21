import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import type { Sql } from 'postgres';
import { existsSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { startPostgrest } from '../postgrest-harness.js';
import type { Harness } from '../postgrest-harness.js';
import { startAuthService } from '../auth-harness.js';
import type { AuthService } from '../auth-harness.js';
import { deleteOrgFixture } from '../fixture-cleanup.js';
import { enrolFixtureMembers, withdrawFixtureMembers } from '../fixture-membership.js';

/**
 * AUTH.2 — une connexion réelle, du service d'authentification au
 * cloisonnement (décision QA2 d'Oss53pa, 21 novembre 2026).
 *
 * Les autres essais d'étanchéité signent eux-mêmes leurs jetons. Celui-ci
 * obtient le sien du service d'authentification de Supabase, sur la base de
 * `scripts/monter-base-authentification.sh`, et le présente à PostgREST
 * comme le fera le poste. Ce qui s'éprouve : le jeton délivré porte l'identité
 * que la base reconnaît, et cette identité ne voit que son organisation.
 *
 * Le décor est enregistré, puis retiré : aucune écriture ne touche une table
 * en insertion seule. L'utilisateur créé reste au schéma du service, sous une
 * adresse propre à l'exécution.
 */
const dsn = process.env['AZIMUT_TEST_AUTH_DATABASE_URL'] ?? '';
const authDbUri = process.env['AZIMUT_TEST_AUTH_DB_URI'] ?? '';
const authBinary = process.env['AZIMUT_TEST_AUTH_BINARY'] ?? '';
const postgrestBinary = process.env['AZIMUT_TEST_POSTGREST'] ?? '';
const postgrestDbUri = process.env['AZIMUT_TEST_AUTH_POSTGREST_DB_URI'] ?? '';
const jwtSecret = process.env['AZIMUT_TEST_JWT_SECRET'] ?? '';

const runnable = dsn !== '' && authDbUri !== '' && jwtSecret !== ''
  && authBinary !== '' && existsSync(authBinary)
  && postgrestBinary !== '' && existsSync(postgrestBinary) && postgrestDbUri !== '';

/** Comme pour PostgREST : une chaîne qui déclare la suite requise ne la saute pas. */
const required = (process.env['AZIMUT_REQUIRE_AUTH'] ?? '') !== '';

const ORG = 'c2000000-0000-4000-8000-0000000000a1';
const OTHER_ORG = 'c2000000-0000-4000-8000-0000000000a2';
const SITE = 'c2000000-0000-4000-8000-0000000000b1';
const OTHER_SITE = 'c2000000-0000-4000-8000-0000000000b2';
const PASSWORD = 'phrase-de-passe-du-banc-42';

let client: Sql;
let auth: AuthService;
let rest: Harness;
let email: string;

type Session = { readonly access_token: string; readonly user: { readonly id: string } };

async function signIn(password: string): Promise<Response> {
  return fetch(`${auth.url}/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

function claims(token: string): Record<string, unknown> {
  const body = token.split('.')[1] ?? '';
  return JSON.parse(Buffer.from(body, 'base64url').toString('utf-8')) as Record<string, unknown>;
}

async function sites(token: string | null): Promise<Response> {
  const headers: Record<string, string> = { 'Accept-Profile': 'azimut' };
  if (token !== null) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${rest.url}/site?select=id&order=id`, { headers });
}


/** Le code TOTP courant d'un secret en base 32 (RFC 6238 : SHA-1, 30 s, 6 chiffres). */
function totp(secret: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of secret.replace(/=+$/, '').toUpperCase()) {
    bits += alphabet.indexOf(char).toString(2).padStart(5, '0');
  }
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map(b => Number.parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac('sha1', key).update(counter).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(code).padStart(6, '0');
}

async function authCall(path: string, token: string, body: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(`${auth.url}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  expect(response.status, path).toBe(200);
  return await response.json() as Record<string, unknown>;
}

describe.runIf(runnable)('AUTH.2 — connexion réelle', () => {
  let session: Session;

  beforeAll(async () => {
    client = postgres(dsn, { onnotice: () => undefined });
    auth = await startAuthService({ binary: authBinary, dbUri: authDbUri, port: 9998 });
    rest = await startPostgrest({ binary: postgrestBinary, dbUri: postgrestDbUri, port: 3997 });

    email = `banc-${Date.now().toString(36)}@example.invalid`;
    const signup = await fetch(`${auth.url}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    expect(signup.status).toBe(200);
    session = await (await signIn(PASSWORD)).json() as Session;

    await deleteOrgFixture(text => client.unsafe(text), text => client.unsafe(text), [ORG, OTHER_ORG]);
    for (const table of ['organization', 'site']) {
      await client.unsafe(`alter table azimut.${table} no force row level security`);
    }
    await client.unsafe(`
      insert into azimut.organization(id,name,slug)
        values ('${ORG}','Connectée','auth2-${Date.now().toString(36)}'),
               ('${OTHER_ORG}','Autre','auth2b-${Date.now().toString(36)}');
      insert into azimut.site(id,org_id,name,country_code,timezone)
        values ('${SITE}','${ORG}','Site','FR','Europe/Paris'),
               ('${OTHER_SITE}','${OTHER_ORG}','Autre site','FR','Europe/Paris');
    `);
    for (const table of ['organization', 'site']) {
      await client.unsafe(`alter table azimut.${table} force row level security`);
    }
    await enrolFixtureMembers(text => client.unsafe(text), [
      { orgId: ORG, userId: session.user.id, role: 'designer' },
    ]);
  }, 60_000);

  afterAll(async () => {
    await rest.stop();
    await auth.stop();
    await deleteOrgFixture(text => client.unsafe(text), text => client.unsafe(text), [ORG, OTHER_ORG]);
    await client.end();
  });

  it('délivre un jeton qui porte l’identité, le rôle et le niveau d’assurance', () => {
    const c = claims(session.access_token);
    expect(c['sub']).toBe(session.user.id);
    expect(c['role']).toBe('authenticated');
    expect(c['aal']).toBe('aal1');
  });

  it('ne délivre rien sur une phrase de passe fausse', async () => {
    const response = await signIn('pas-la-bonne-phrase');
    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).not.toContain('access_token');
  });

  it('l’identité du jeton ne voit que son organisation', async () => {
    const response = await sites(session.access_token);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: SITE }]);
  });

  /**
   * AUTH.5, migration 0080 — le même utilisateur, devenu `admin`, ne lit plus
   * rien sur la phrase de passe seule. Il enrôle un second facteur auprès du
   * service, le vérifie, et le jeton qu'il reçoit alors (`aal2`) lui rend son
   * organisation.
   */
  it('un admin ne lit son organisation qu’après le second facteur', async () => {
    await withdrawFixtureMembers(text => client.unsafe(text), [{ orgId: ORG, userId: session.user.id }]);
    await enrolFixtureMembers(text => client.unsafe(text), [
      { orgId: ORG, userId: session.user.id, role: 'admin' },
    ]);

    expect(await (await sites(session.access_token)).json()).toEqual([]);

    const factor = await authCall('/factors', session.access_token, {
      factor_type: 'totp', friendly_name: 'banc',
    });
    const factorId = String(factor['id']);
    const secret = String((factor['totp'] as Record<string, unknown>)['secret']);
    const challenge = await authCall(`/factors/${factorId}/challenge`, session.access_token, {});
    const verified = await authCall(`/factors/${factorId}/verify`, session.access_token, {
      challenge_id: challenge['id'], code: totp(secret),
    });
    const strong = String(verified['access_token']);

    expect(claims(strong)['aal']).toBe('aal2');
    expect(await (await sites(strong)).json()).toEqual([{ id: SITE }]);
  });

  it('sans jeton, rien ne se lit', async () => {
    const response = await sites(null);
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});

describe.runIf(required)('AUTH.2 — la chaîne exécute bien cette suite', () => {
  it('le service d’authentification est disponible là où la chaîne le déclare requis', () => {
    expect(runnable).toBe(true);
  });
});
