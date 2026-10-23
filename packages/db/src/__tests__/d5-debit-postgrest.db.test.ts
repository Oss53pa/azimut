import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import type { Sql } from 'postgres';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { installPlatformStubs, startPostgrest, signToken } from '../postgrest-harness.js';
import type { Harness } from '../postgrest-harness.js';
import { deleteOrgFixture } from '../fixture-cleanup.js';
import { provisionStatements } from '../provision-organization.js';

/**
 * Lot 8 de l'audit : un dépassement de débit rend, par le chemin de
 * l'application, une réponse 429 avec `Retry-After`, sans rien dire de
 * l'organisation ni du compteur.
 *
 * Le seuil est abaissé par l'administrateur lui-même, pour sa seule
 * organisation : c'est la surcharge que D-5 lui ouvre, qui ne peut que
 * resserrer.
 */
const dsn = process.env['AZIMUT_TEST_DATABASE_URL'];
const binary = process.env['AZIMUT_TEST_POSTGREST'] ?? '';
const postgrestDbUri = process.env['AZIMUT_TEST_POSTGREST_DB_URI'] ?? '';
const jwtSecret = process.env['AZIMUT_TEST_JWT_SECRET'] ?? '';
const runnable = dsn !== undefined && binary !== '' && existsSync(binary)
  && postgrestDbUri !== '' && jwtSecret !== '';
const required = (process.env['AZIMUT_REQUIRE_POSTGREST'] ?? '') !== '';

const ORG = randomUUID();
const ALICE = randomUUID();

let client: Sql;
let harness: Harness;

async function asAlice(path: string, body: unknown): Promise<Response> {
  return fetch(`${harness.url}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Profile': 'azimut',
      'Content-Profile': 'azimut',
      Authorization: `Bearer ${signToken(ALICE, 'authenticated', 'aal2')}`,
    },
    body: JSON.stringify(body),
  });
}

describe.runIf(runnable)('lot 8 : le dépassement de débit par PostgREST', () => {
  beforeAll(async () => {
    client = postgres(dsn ?? '', { onnotice: () => undefined });
    await installPlatformStubs(client);
    await client.begin(async tx => {
      for (const text of provisionStatements({ id: ORG, name: 'D8', slug: `d8-${ORG.slice(0, 8)}`, adminId: ALICE })) {
        await tx.unsafe(text);
      }
    });
    harness = await startPostgrest({ binary, dbUri: postgrestDbUri, port: 3998 });
  }, 60_000);

  afterAll(async () => {
    await harness.stop();
    await deleteOrgFixture(text => client.unsafe(text), text => client.unsafe(text), [ORG]);
    await client.end();
  });

  it('au-delà du seuil, 429 et un délai, sans identifiant ni compteur', async () => {
    const tightened = await asAlice('/org_security_setting', { org_id: ORG, key: 'rate.membership.per_user', value: 1 });
    expect(tightened.status).toBe(201);

    const first = await asAlice('/rpc/set_member', { p_org: ORG, p_user: randomUUID(), p_role: 'designer' });
    expect(first.status).toBeLessThan(300);

    const second = await asAlice('/rpc/set_member', { p_org: ORG, p_user: randomUUID(), p_role: 'designer' });
    expect(second.status).toBe(429);
    expect(second.headers.get('retry-after')).toMatch(/^\d+$/);
    const body = await second.text();
    expect(body).toContain('rate_limited');
    for (const leak of [ORG, ALICE, 'hits', 'per_user']) expect(body).not.toContain(leak);
  });
});

describe.runIf(required)('lot 8 : la chaîne exécute bien cette suite', () => {
  it('le binaire PostgREST et ses variables sont présents', () => {
    expect(runnable).toBe(true);
  });
});
