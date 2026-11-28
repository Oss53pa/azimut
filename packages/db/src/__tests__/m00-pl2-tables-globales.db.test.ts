import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';

/**
 * M00.PL2 — une table globale est en lecture seule pour l'application (0078).
 *
 * Une table du schéma `azimut` sans colonne `org_id` n'est cloisonnée par
 * aucune organisation : une écriture y toucherait toutes les organisations.
 * `authenticated` n'y détient donc aucun droit d'écriture, et le refus ne
 * repose pas sur les seules politiques.
 *
 * L'essai parcourt le catalogue, pas une liste écrite à la main : une table
 * globale ajoutée demain sans retirer ses droits le fait échouer.
 *
 * `has_table_privilege` compte les droits reçus par héritage et par `PUBLIC`,
 * ce que `information_schema.role_table_grants` ne montre pas.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];

const WRITE_PRIVILEGES = ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] as const;

/**
 * Les tables sans `org_id` où l'écriture reste permise, chacune avec sa raison.
 * Y ajouter une table demande une raison, pas seulement un nom.
 */
const JUSTIFIED: Readonly<Record<string, string>> = {
  organization:
    'Porte son identifiant d’organisation dans `id` : créer son organisation '
    + 'est un parcours de l’application (politiques 0007, rôles 0076).',
};

/** Les tables passées en lecture seule par 0078, vérifiées nommément. */
const REVOKED_BY_0078 = ['country', 'rules_pack', 'rules_pack_rule'] as const;

let sql: postgres.Sql;

async function globalTables(): Promise<readonly string[]> {
  const rows = await sql<{ name: string }[]>`
    select c.relname as name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'azimut'
      and c.relkind in ('r', 'p')
      and not c.relispartition
      and not exists (
        select 1 from pg_attribute a
        where a.attrelid = c.oid and a.attname = 'org_id'
          and a.attnum > 0 and not a.attisdropped
      )
    order by c.relname`;
  return rows.map(row => row.name);
}

async function writePrivileges(table: string): Promise<readonly string[]> {
  const held: string[] = [];
  for (const privilege of WRITE_PRIVILEGES) {
    const [row] = await sql<{ held: boolean }[]>`
      select has_table_privilege('authenticated', ${`azimut.${table}`}, ${privilege}) as held`;
    if (row?.held === true) held.push(privilege);
  }
  return held;
}

beforeAll(() => {
  if (URL === undefined || URL === '') {
    throw new Error('AZIMUT_TEST_DATABASE_URL absente. Voir packages/db/migrations/ORDRE.md.');
  }
  sql = postgres(URL, { onnotice: () => undefined });
});

afterAll(async () => {
  await sql.end();
});

describe('M00.PL2 — aucune écriture sur une table globale', () => {
  it('authenticated n’écrit dans aucune table sans org_id, hors exception justifiée', async () => {
    const offending: string[] = [];
    for (const table of await globalTables()) {
      if (table in JUSTIFIED) continue;
      const held = await writePrivileges(table);
      if (held.length > 0) offending.push(`${table}: ${held.join(', ')}`);
    }
    expect(offending).toEqual([]);
  });

  it('chaque exception nomme une table globale qui existe', async () => {
    const tables = await globalTables();
    for (const table of Object.keys(JUSTIFIED)) {
      expect(tables).toContain(table);
    }
  });

  it('les trois références de 0078 sont globales et gardent leur lecture', async () => {
    const tables = await globalTables();
    for (const table of REVOKED_BY_0078) {
      expect(tables).toContain(table);
      expect(await writePrivileges(table)).toEqual([]);
      const [row] = await sql<{ held: boolean }[]>`
        select has_table_privilege('authenticated', ${`azimut.${table}`}, 'SELECT') as held`;
      expect(row?.held).toBe(true);
    }
  });

  it('une écriture sur une référence est refusée par un refus de droit', async () => {
    let message = 'accepté';
    try {
      await sql.begin(async tx => {
        await tx`set local role authenticated`;
        await tx`update azimut.country set name_fr = name_fr where false`;
      });
    } catch (e: unknown) {
      message = e instanceof Error ? e.message : String(e);
    }
    expect(message).toMatch(/permission denied/);
  });
});
