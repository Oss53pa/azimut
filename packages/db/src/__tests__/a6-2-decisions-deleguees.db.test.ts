import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { deleteOrgFixture } from '../fixture-cleanup.js';
import { enrolFixtureMembers } from '../fixture-membership.js';

/**
 * A6.2 — les décisions de 0077, éprouvées contre la base réelle.
 *
 *   · `vendor` : aucun accès tant que le rattachement à un lot n'existe pas ;
 *   · `job` et `kiosk_package` : leur cycle de vie n'est écrit que par une
 *     session du service de compilation.
 *
 * Le second point se décide sur le rôle de connexion (`session_user`), pas sur
 * le rôle courant. Il s'éprouve donc depuis une connexion qui n'est pas celle
 * du service : celle de l'API, `authenticator`, que la chaîne monte pour
 * l'étanchéité par PostgREST (`AZIMUT_TEST_POSTGREST_DB_URI`). Sans elle, cette
 * partie se saute sur un poste, et échoue dans une chaîne qui déclare
 * `AZIMUT_REQUIRE_POSTGREST` — même règle que `a10-4-etancheite-postgrest`.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];
const API_URL = process.env['AZIMUT_TEST_POSTGREST_DB_URI'] ?? '';
const required = (process.env['AZIMUT_REQUIRE_POSTGREST'] ?? '') !== '';

const ORG = 'a6200000-0000-0000-0000-0000000d0a00';
const SITE = 'a6200000-0000-0000-0000-0000000d05a1';
const DESIGNER = 'a6200000-0000-0000-0000-0000000d00a1';
const VENDOR = 'a6200000-0000-0000-0000-0000000d00a2';

const LIFECYCLE = /belongs to the compiler service/;
const KIOSK_WRITER = /written by the compiler service only/;

let sql: postgres.Sql;
let api: postgres.Sql | null = null;
let jobId = '';

type Tx = postgres.TransactionSql;

async function asUser<T>(conn: postgres.Sql, userId: string, run: (tx: Tx) => Promise<T>): Promise<T> {
  const result = await conn.begin(async tx => {
    await tx`set local role authenticated`;
    await tx`select set_config('azimut.current_user_id', ${userId}, true)`;
    return run(tx);
  });
  return result as T;
}

/** Le motif du refus, ou « accepté » — la tentative est toujours annulée. */
async function attempt(conn: postgres.Sql, userId: string, run: (tx: Tx) => Promise<unknown>): Promise<string> {
  const rolledBack = new Error('annulation voulue');
  try {
    await asUser(conn, userId, async tx => { await run(tx); throw rolledBack; });
  } catch (e: unknown) {
    if (e === rolledBack) return 'accepté';
    return e instanceof Error ? e.message : String(e);
  }
  return 'accepté';
}

beforeAll(async () => {
  if (URL === undefined || URL === '') {
    throw new Error('AZIMUT_TEST_DATABASE_URL absente. Voir packages/db/migrations/ORDRE.md.');
  }
  if (API_URL === '' && required) {
    throw new Error('AZIMUT_REQUIRE_POSTGREST posée sans AZIMUT_TEST_POSTGREST_DB_URI.');
  }
  sql = postgres(URL, { onnotice: () => undefined });
  if (API_URL !== '') api = postgres(API_URL, { onnotice: () => undefined });

  await deleteOrgFixture(text => sql.unsafe(text), text => sql.unsafe(text), [ORG]);
  await asUser(sql, DESIGNER, tx => tx`insert into azimut.organization(id,name,slug) values (${ORG},'D','a62-delegue')`);
  await enrolFixtureMembers(text => sql.unsafe(text), [
    { orgId: ORG, userId: DESIGNER, role: 'designer' },
    { orgId: ORG, userId: VENDOR, role: 'vendor' },
  ]);
  await asUser(sql, DESIGNER, tx => tx`insert into azimut.site(id,org_id,name,country_code,timezone)
    values (${SITE},${ORG},'Site D','FR','Europe/Paris')`);
  const rows = await asUser(sql, DESIGNER, tx => tx`insert into azimut.job(org_id, kind)
    values (${ORG}, 'audit_site') returning id`);
  jobId = String(rows[0]?.['id'] ?? '');
});

afterAll(async () => {
  await deleteOrgFixture(text => sql.unsafe(text), text => sql.unsafe(text), [ORG]);
  await api?.end();
  await sql.end();
});

describe('A6.2 — vendor : aucun accès avant le rattachement à un lot (L4.1)', () => {
  it('ne voit ni l’organisation ni ses sites', async () => {
    expect(await asUser(sql, VENDOR, tx => tx`select id from azimut.organization where id = ${ORG}`)).toHaveLength(0);
    expect(await asUser(sql, VENDOR, tx => tx`select id from azimut.site where id = ${SITE}`)).toHaveLength(0);
  });

  it('n’écrit rien', async () => {
    expect(await attempt(sql, VENDOR, tx => tx`insert into azimut.site(org_id,name,country_code,timezone)
      values (${ORG},'Intrus','FR','Europe/Paris')`)).toMatch(/row-level security/);
  });

  it('les autres membres voient toujours leur organisation', async () => {
    expect(await asUser(sql, DESIGNER, tx => tx`select id from azimut.site where id = ${SITE}`)).toHaveLength(1);
  });
});

describe.runIf(API_URL !== '')('A6.2 — job et kiosk_package : écrits par le service seul', () => {
  const conn = (): postgres.Sql => {
    if (api === null) throw new Error('connexion de l’API absente');
    return api;
  };

  it('un membre crée encore un travail, en file', async () => {
    expect(await attempt(conn(), DESIGNER, tx => tx`insert into azimut.job(org_id, kind)
      values (${ORG}, 'audit_site')`)).toBe('accepté');
  });

  it('un membre ne crée pas un travail déjà réussi', async () => {
    expect(await attempt(conn(), DESIGNER, tx => tx`insert into azimut.job(org_id, kind, state, result)
      values (${ORG}, 'audit_site', 'succeeded', '{"forgé": true}'::jsonb)`)).toMatch(LIFECYCLE);
  });

  it('un membre ne clôt, ne modifie ni ne supprime un travail', async () => {
    expect(await attempt(conn(), DESIGNER, tx => tx`update azimut.job
      set state = 'succeeded', result = '{"forgé": true}'::jsonb where id = ${jobId}`)).toMatch(LIFECYCLE);
    expect(await attempt(conn(), DESIGNER, tx => tx`delete from azimut.job where id = ${jobId}`))
      .toMatch(LIFECYCLE);
  });

  it('un membre n’enregistre pas de paquet de borne', async () => {
    expect(await attempt(conn(), DESIGNER, tx => tx`insert into azimut.kiosk_package
      (org_id, site_id, version, storage_path, checksum, content_hash)
      values (${ORG}, ${SITE}, 1, 'sites/x/v1', 'sha256:x', 'sha256:x')`)).toMatch(KIOSK_WRITER);
  });

  it('la session du service, elle, écrit toujours', async () => {
    expect(await attempt(sql, DESIGNER, tx => tx`insert into azimut.kiosk_package
      (org_id, site_id, version, storage_path, checksum, content_hash)
      values (${ORG}, ${SITE}, 1, 'sites/x/v1', 'sha256:x', 'sha256:x')`)).toBe('accepté');
  });
});
