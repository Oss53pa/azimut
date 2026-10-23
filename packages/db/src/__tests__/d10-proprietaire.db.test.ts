import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { ownershipGaps } from '../ownership-catalogue.js';

/**
 * D-10 de l'audit (A12.3) : aucun rôle de l'application n'endosse le
 * propriétaire des tables, qui seul peut en retirer les barrières.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];

let sql: postgres.Sql;

beforeAll(() => {
  if (URL === undefined || URL === '') {
    throw new Error('AZIMUT_TEST_DATABASE_URL absente. Voir packages/db/migrations/ORDRE.md.');
  }
  sql = postgres(URL, { onnotice: () => undefined });
});

afterAll(async () => { await sql.end(); });

describe('D-10 : le propriétaire des tables n’est pas un rôle de l’application', () => {
  it('aucun rôle de connexion ni de bascule ne l’endosse', async () => {
    expect(await ownershipGaps(text => sql.unsafe(text))).toEqual([]);
  });

  it('le contrôle voit un rôle qui l’endosserait', async () => {
    const [row] = await sql<{ owner: string }[]>`
      select pg_get_userbyid(nspowner) as owner from pg_namespace where nspname = 'azimut'`;
    const owner = row?.owner ?? '';
    expect(await ownershipGaps(text => sql.unsafe(text), [owner])).toContain(`${owner} owner ${owner}`);
  });

  it('refuse un nom de rôle qui ne serait pas un identifiant', async () => {
    await expect(ownershipGaps(text => sql.unsafe(text), ["x') or (true"])).rejects.toThrow(/nom de rôle/);
  });
});
