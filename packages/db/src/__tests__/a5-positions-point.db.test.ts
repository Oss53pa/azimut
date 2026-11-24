import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { enrolFixtureMembers } from '../fixture-membership.js';

/**
 * Migration 0082, décision Q15 — la base exige qu'une position de nœud ou
 * d'ouverture soit un objet `{x_m, y_m}` à deux nombres, et rien d'autre.
 *
 * Les contraintes sont posées NOT VALID : une ligne déjà en base, même mal
 * formée, reste lisible ; toute écriture nouvelle est contrôlée.
 *
 * Tout se fait dans une transaction annulée.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];
const ORG = 'a5820000-0000-4000-8000-0000000000a1';
const SITE = 'a5820000-0000-4000-8000-0000000000b1';
const BUILDING = 'a5820000-0000-4000-8000-0000000000b2';
const LEVEL = 'a5820000-0000-4000-8000-0000000000b3';
const DESIGNER = 'a5820000-0000-4000-8000-0000000000d1';

let sql: postgres.Sql;

beforeAll(() => {
  if (URL === undefined || URL === '') {
    throw new Error('AZIMUT_TEST_DATABASE_URL absente. Voir packages/db/migrations/ORDRE.md.');
  }
  sql = postgres(URL, { onnotice: () => undefined });
});

afterAll(async () => { await sql.end(); });

async function inRolledBack(check: (tx: postgres.TransactionSql) => Promise<void>): Promise<void> {
  const done = new Error('annulation voulue');
  await sql.begin(async tx => {
    await tx`select set_config('azimut.current_user_id', ${DESIGNER}, true)`;
    await tx`insert into azimut.organization(id,name,slug) values (${ORG},'Q15','q15-positions')`;
    await enrolFixtureMembers(text => tx.unsafe(text), [{ orgId: ORG, userId: DESIGNER, role: 'designer' }]);
    await tx`insert into azimut.site(id,org_id,name,country_code,timezone) values (${SITE},${ORG},'Site','FR','Europe/Paris')`;
    await tx`insert into azimut.building(id,org_id,site_id,name) values (${BUILDING},${ORG},${SITE},'B')`;
    await tx`insert into azimut.level(id,org_id,building_id,name,ordinal,elevation_m) values (${LEVEL},${ORG},${BUILDING},'RDC',0,0)`;
    await tx`set local role authenticated`;
    await check(tx);
    throw done;
  }).catch((e: unknown) => { if (e !== done) throw e; });
}

async function verdict(tx: postgres.TransactionSql, position: unknown): Promise<string> {
  try {
    await tx.savepoint(async sp => {
      await sp`insert into azimut.node(org_id, level_id, kind, position)
               values (${ORG}, ${LEVEL}, 'junction', ${JSON.stringify(position)}::text::jsonb)`;
    });
  } catch (e: unknown) {
    const code = (e as { code?: unknown }).code;
    return typeof code === 'string' ? code : '?';
  }
  return 'accepté';
}

describe('Q15 — une position est un point {x_m, y_m}', () => {
  it('le point du modèle passe, entier ou décimal, négatif compris', async () => {
    await inRolledBack(async tx => {
      expect(await verdict(tx, { x_m: 0, y_m: 0 })).toBe('accepté');
      expect(await verdict(tx, { x_m: -12.375, y_m: 1000000 })).toBe('accepté');
    });
  });

  it('toute autre forme est refusée par la base', async () => {
    await inRolledBack(async tx => {
      for (const bad of [
        { x: 0, y: 0 }, { x_m: 0 }, { x_m: 0, y_m: 0, z_m: 0 }, { x_m: '0', y_m: 0 },
        { x_m: 0, y_m: null }, { x_m: 1000001, y_m: 0 }, [0, 0], 'point', 0, {},
      ]) expect(await verdict(tx, bad)).toBe('23514');
    });
  });

  it('les deux tables portent la contrainte, posée NOT VALID', async () => {
    const rows = await sql<{ conname: string; convalidated: boolean }[]>`
      select conname, convalidated from pg_constraint
      where conname in ('node_position_point', 'opening_position_point') order by conname`;
    expect(rows).toEqual([
      { conname: 'node_position_point', convalidated: false },
      { conname: 'opening_position_point', convalidated: false },
    ]);
  });
});
