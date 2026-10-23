import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { deleteOrgFixture } from '../fixture-cleanup.js';
import { enrolFixtureMembers } from '../fixture-membership.js';

/**
 * A6.1 et A6.2 — personne ne se rattache seul à une organisation (0075).
 *
 * Les deux attaques que 0075 ferme, rejouées contre la base réelle sous
 * `FORCE ROW LEVEL SECURITY` :
 *   · un utilisateur s'inscrit comme `admin` dans l'organisation d'un autre,
 *     puis lit ce qu'elle possède ;
 *   · un membre `vendor` se donne `admin` en modifiant sa propre ligne.
 *
 * Chacune doit être refusée par la base, avec un refus de droit, et non passer
 * pour une écriture sans effet.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];

const ALICE = 'a6100000-0000-0000-0000-00000000f0a1';
const MALLORY = 'a6100000-0000-0000-0000-00000000f0b1';
const ORG_A = 'a6100000-0000-0000-0000-00000000f0a0';
const ORG_M = 'a6100000-0000-0000-0000-00000000f0b0';

let sql: postgres.Sql;

async function asUser<T>(userId: string, run: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  const result = await sql.begin(async tx => {
    await tx`set local role authenticated`;
    await tx`select set_config('azimut.current_user_id', ${userId}, true)`;
    return run(tx);
  });
  return result as T;
}

/** Le message d'une tentative refusée, ou « accepté ». */
async function attempt(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return 'accepté';
  } catch (e: unknown) {
    return e instanceof Error ? e.message : String(e);
  }
}

beforeAll(async () => {
  if (URL === undefined || URL === '') {
    throw new Error('AZIMUT_TEST_DATABASE_URL absente. Voir packages/db/migrations/ORDRE.md.');
  }
  sql = postgres(URL, { onnotice: () => undefined });
  await deleteOrgFixture(text => sql.unsafe(text), text => sql.unsafe(text), [ORG_A, ORG_M]);

  await asUser(ALICE, tx => tx`insert into azimut.organization(id,name,slug) values (${ORG_A},'A','a61-ferme-a')`);
  await asUser(MALLORY, tx => tx`insert into azimut.organization(id,name,slug) values (${ORG_M},'M','a61-ferme-m')`);
  await enrolFixtureMembers(text => sql.unsafe(text), [
    { orgId: ORG_A, userId: ALICE, role: 'admin' },
    { orgId: ORG_M, userId: MALLORY, role: 'vendor' },
  ]);
});

afterAll(async () => {
  await deleteOrgFixture(text => sql.unsafe(text), text => sql.unsafe(text), [ORG_A, ORG_M]);
  await sql.end();
});

describe('A6.1 — on ne s’inscrit pas dans l’organisation d’un autre', () => {
  it('l’inscription comme admin chez autrui est refusée', async () => {
    expect(await attempt(() => asUser(MALLORY, tx =>
      tx`insert into azimut.membership(org_id,user_id,role) values (${ORG_A},${MALLORY},'admin')`)))
      .toMatch(/permission denied/);
  });

  it('l’organisation d’autrui reste invisible', async () => {
    const rows = await asUser(MALLORY, tx => tx`select id from azimut.organization where id = ${ORG_A}`);
    expect(rows).toHaveLength(0);
  });

  it('même dans sa propre organisation, personne ne s’inscrit seul', async () => {
    expect(await attempt(() => asUser(ALICE, tx =>
      tx`insert into azimut.membership(org_id,user_id,role) values (${ORG_A},${MALLORY},'designer')`)))
      .toMatch(/permission denied/);
  });
});

describe('A6.2 — un membre ne change pas son rôle', () => {
  it('un vendor ne se donne pas admin', async () => {
    expect(await attempt(() => asUser(MALLORY, tx =>
      tx`update azimut.membership set role = 'admin' where user_id = ${MALLORY}`)))
      .toMatch(/permission denied/);
    const rows = await asUser(MALLORY, tx => tx`select role from azimut.membership where org_id = ${ORG_M}`);
    expect(rows.map(r => r['role'])).toEqual(['vendor']);
  });

  it('un rattachement ne se retire pas non plus par l’application', async () => {
    expect(await attempt(() => asUser(MALLORY, tx =>
      tx`delete from azimut.membership where user_id = ${MALLORY}`)))
      .toMatch(/permission denied/);
  });

  it('chacun lit encore ses propres rattachements, et eux seuls', async () => {
    const rows = await asUser(ALICE, tx => tx`select org_id from azimut.membership`);
    expect(rows.map(r => r['org_id'])).toEqual([ORG_A]);
  });
});

describe('0075 — les droits eux-mêmes sont retirés', () => {
  it('authenticated n’a ni INSERT, ni UPDATE, ni DELETE sur membership', async () => {
    const rows = await sql`
      select privilege_type from information_schema.role_table_grants
      where grantee = 'authenticated' and table_schema = 'azimut' and table_name = 'membership'
      order by privilege_type`;
    expect(rows.map(r => r['privilege_type']).filter(p => ['INSERT', 'UPDATE', 'DELETE'].includes(String(p))))
      .toEqual([]);
  });
});
