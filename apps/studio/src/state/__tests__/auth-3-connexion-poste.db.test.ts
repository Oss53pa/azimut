import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { createConnection, deleteOrgFixture, enrolFixtureMembers } from '@azimut/db';
import { startAuthService, startPostgrest } from '@azimut/db/harness';
import type { AuthService, Harness } from '@azimut/db/harness';
import type { GoTrueClient } from '@supabase/auth-js';
import { createAuthClient } from '../../auth/auth-config.js';
import { setAccessTokenSource } from '../../auth/access-token.js';
import { signInFailureOf } from '../../auth/use-auth-session.js';
import { query } from '../../data/postgrest-http.js';
import { isRepositoryError } from '../../data/site-repository.js';
import { loadMemberships } from '../../auth/load-memberships.js';

/**
 * AUTH.3 et AUTH.4 — le code de connexion du studio, contre le vrai service et le vrai
 * PostgREST (base de `scripts/monter-base-authentification.sh`).
 *
 * Ce qui s'éprouve : le client de `auth-config.ts` obtient une session ; posé
 * comme source du jeton, il fait lire par `postgrest-http.ts` — la lecture de
 * tous les registres — le site de l'organisation, et lui seul ; après la
 * déconnexion, plus rien ne se lit. Aucune écriture : le décor se retire.
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

const ORG = 'c3000000-0000-4000-8000-0000000000a1';
const OTHER_ORG = 'c3000000-0000-4000-8000-0000000000a2';
const SITE = 'c3000000-0000-4000-8000-0000000000b1';
const OTHER_SITE = 'c3000000-0000-4000-8000-0000000000b2';
const PASSWORD = 'phrase-de-passe-du-poste-42';
/** Le service autonome, sans passerelle, n'exige pas de clé ; le client en envoie une. */
const API_KEY = 'cle-publiable-du-banc';

let client: ReturnType<typeof createConnection>;
let auth: AuthService;
let rest: Harness;
let gotrue: GoTrueClient;
let email: string;

describe.runIf(runnable)('AUTH.3 — la connexion du poste', () => {
  beforeAll(async () => {
    client = createConnection(dsn);
    auth = await startAuthService({ binary: authBinary, dbUri: authDbUri, port: 9996 });
    rest = await startPostgrest({ binary: postgrestBinary, dbUri: postgrestDbUri, port: 3996 });
    gotrue = createAuthClient({ url: auth.url, apiKey: API_KEY }, null);

    email = `poste-${Date.now().toString(36)}@example.invalid`;
    const signup = await gotrue.signUp({ email, password: PASSWORD });
    expect(signup.error).toBeNull();
    const userId = signup.data.user?.id ?? '';
    await gotrue.signOut();

    await deleteOrgFixture(text => client.unsafe(text), text => client.unsafe(text), [ORG, OTHER_ORG]);
    for (const table of ['organization', 'site']) {
      await client.unsafe(`alter table azimut.${table} no force row level security`);
    }
    await client.unsafe(`
      insert into azimut.organization(id,name,slug)
        values ('${ORG}','Poste','auth3-${Date.now().toString(36)}'),
               ('${OTHER_ORG}','Autre','auth3b-${Date.now().toString(36)}');
      insert into azimut.site(id,org_id,name,country_code,timezone)
        values ('${SITE}','${ORG}','Site','FR','Europe/Paris'),
               ('${OTHER_SITE}','${OTHER_ORG}','Autre site','FR','Europe/Paris');
    `);
    for (const table of ['organization', 'site']) {
      await client.unsafe(`alter table azimut.${table} force row level security`);
    }
    await enrolFixtureMembers(text => client.unsafe(text), [{ orgId: ORG, userId, role: 'designer' }]);
  }, 60_000);

  afterAll(async () => {
    await rest.stop();
    await auth.stop();
    await deleteOrgFixture(text => client.unsafe(text), text => client.unsafe(text), [ORG, OTHER_ORG]);
    await client.end();
  });

  const config = () => ({ url: rest.url, apiKey: API_KEY, schema: 'azimut' });

  it('une phrase de passe fausse est refusée, et se dit comme un refus', async () => {
    const { data, error } = await gotrue.signInWithPassword({ email, password: 'pas-la-bonne' });
    expect(data.session).toBeNull();
    expect(error === null ? null : signInFailureOf(error.status)).toBe('failed');
  });

  it('connecté, le poste lit le site de son organisation, et lui seul', async () => {
    const { data, error } = await gotrue.signInWithPassword({ email, password: PASSWORD });
    expect(error).toBeNull();
    const token = data.session?.access_token ?? null;
    const release = setAccessTokenSource(() => token);
    try {
      const rows = await query<{ id: string }>(config(), 'site', 'select=id&order=id');
      expect(rows).toEqual([{ id: SITE }]);
      // AUTH.4 — l'organisation et le rôle viennent du rattachement, et du seul.
      expect(await loadMemberships(config(), data.session?.user.id ?? ''))
        .toEqual([{ orgId: ORG, orgName: 'Poste', role: 'designer' }]);
    } finally {
      release();
    }
  });

  it('déconnecté, il ne lit plus rien', async () => {
    await gotrue.signOut();
    const { data } = await gotrue.getSession();
    expect(data.session).toBeNull();
    const failure = await query(config(), 'site', 'select=id').then(() => 'lu', (e: unknown) => e);
    expect(isRepositoryError(failure)).toBe(true);
  });
});
