import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildCommand, inverseCommand } from '@azimut/core-model';
import type { EntityCommand } from '@azimut/core-model';
import { applyCommands, createConnection, createDb, deleteOrgFixture } from '@azimut/db';
import { createFootprintCommands } from '../footprint-commands.js';
import { strikeFootprints } from '../footprint-strike.js';
import type { StoredRow } from '../session-store.js';

/**
 * J1.2 (partie J) — le trait barrant une empreinte, contre la base réelle :
 * la suppression passe par le chemin d'écriture ordinaire, sous cloisonnement
 * forcé, et son inverse rétablit la ligne telle qu'elle était.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];
const ALICE = 'a4000000-0000-0000-0000-0000000000a1';
const BOB = 'a4000000-0000-0000-0000-0000000000b1';
const ORG = 'a4000000-0000-0000-0000-00000000a0a0';
const ORG_B = 'a4000000-0000-0000-0000-00000000b0b0';
const SITE = 'a4000000-0000-0000-0000-0000000005a1';
const BUILDING = 'a4000000-0000-0000-0000-0000000006a1';
const LEVEL = 'a4000000-0000-0000-0000-0000000007a1';
const FOOTPRINT = 'a4000000-0000-0000-0000-0000000008a1';
const T = '2026-10-04T10:00:00.000Z';

let client: ReturnType<typeof createConnection>;
let db: ReturnType<typeof createDb>;

type Row = Readonly<Record<string, unknown>>;

async function asUser(userId: string, text: string, params: readonly string[] = []): Promise<readonly Row[]> {
  const rows: Row[] = [];
  await client.begin(async (tx) => {
    await tx.unsafe('set local role authenticated');
    await tx.unsafe(`select set_config('azimut.current_user_id', $1, true)`, [userId]);
    rows.push(...await tx.unsafe(text, [...params]));
  });
  return rows;
}

function command(table: string, id: string, after: Record<string, string>): EntityCommand {
  const out = buildCommand({ operation: 'create', module: '01-socle', table, id, org_id: ORG, after, timestamp: T });
  if (!out.ok) throw new Error(JSON.stringify(out.findings));
  return out.value;
}

async function apply(userId: string, commands: readonly EntityCommand[]): Promise<void> {
  const applied = await applyCommands(db, { userId }, commands);
  if (!applied.ok) throw new Error(JSON.stringify(applied.findings));
}

beforeAll(async () => {
  if (URL === undefined || URL === '') {
    throw new Error('AZIMUT_TEST_DATABASE_URL absente. Voir packages/db/migrations/ORDRE.md.');
  }
  client = createConnection(URL);
  db = createDb(URL);
  await deleteOrgFixture(text => client.unsafe(text), text => client.unsafe(text), [ORG, ORG_B]);
  for (const [user, org, slug] of [[ALICE, ORG, 'j12-a'], [BOB, ORG_B, 'j12-b']] as const) {
    await asUser(user, 'insert into azimut.organization(id,name,slug) values ($1, $2, $2)', [org, slug]);
    await asUser(user, `insert into azimut.membership(org_id,user_id,role) values ($1, $2, 'admin')`, [org, user]);
  }
  await apply(ALICE, [
    command('site', SITE, { id: SITE, org_id: ORG, name: 'Site barré', country_code: 'FR', timezone: 'Europe/Paris' }),
    command('building', BUILDING, { id: BUILDING, org_id: ORG, site_id: SITE, name: 'Bâtiment 1' }),
    command('level', LEVEL, { id: LEVEL, org_id: ORG, building_id: BUILDING, name: 'Niveau 0', ordinal: '0', elevation_m: '0' }),
  ]);
});

afterAll(async () => {
  await deleteOrgFixture(text => client.unsafe(text), text => client.unsafe(text), [ORG, ORG_B]);
  await client.end();
  await db.$client.end();
});

describe('J1.2 — le trait barrant une empreinte, en base', () => {
  it('la suppression passe, et son inverse rétablit la ligne entière', async () => {
    const created = createFootprintCommands([{
      id: FOOTPRINT,
      footprint: {
        vertices: [{ x_m: 0, y_m: 0 }, { x_m: 4, y_m: 0 }, { x_m: 4, y_m: 3 }, { x_m: 0, y_m: 3 }],
        unitCode: 'B01', kind: 'cell', categoryId: null, areaM2: 12,
      },
    }], { orgId: ORG, levelId: LEVEL, timestamp: T }, `footprint:${FOOTPRINT}`);
    if (!created.ok) throw new Error(JSON.stringify(created.findings));
    await apply(ALICE, created.value);

    const rows: readonly StoredRow[] = created.value.map(c => ({ table: c.table, id: c.id, values: c.after ?? {} }));
    const struck = strikeFootprints(rows, [FOOTPRINT], { orgId: ORG, timestamp: '2026-10-05T09:00:00.000Z' });
    if (struck.kind !== 'deleted') throw new Error(struck.kind);
    await apply(ALICE, struck.commands);
    expect(await asUser(ALICE, 'select id from azimut.footprint where id = $1', [FOOTPRINT])).toHaveLength(0);

    await apply(ALICE, struck.commands.map(c => inverseCommand(c, '2026-10-05T09:01:00.000Z')));
    const [back] = await asUser(ALICE, 'select unit_code, kind, geometry from azimut.footprint where id = $1', [FOOTPRINT]);
    expect(back).toMatchObject({ unit_code: 'B01', kind: 'cell', geometry: { vertices: [{ x_m: 0, y_m: 0 }, { x_m: 4, y_m: 0 }, { x_m: 4, y_m: 3 }, { x_m: 0, y_m: 3 }] } });
  });

  it('une autre organisation ne peut pas la supprimer', async () => {
    const rows: readonly StoredRow[] = [{
      table: 'footprint', id: FOOTPRINT,
      values: { org_id: ORG, level_id: LEVEL, kind: 'cell', unit_code: 'B01', geometry: '{"vertices":[]}' },
    }];
    const struck = strikeFootprints(rows, [FOOTPRINT], { orgId: ORG, timestamp: '2026-10-05T09:02:00.000Z' });
    if (struck.kind !== 'deleted') throw new Error(struck.kind);
    await applyCommands(db, { userId: BOB }, struck.commands);
    expect(await asUser(ALICE, 'select id from azimut.footprint where id = $1', [FOOTPRINT])).toHaveLength(1);
  });
});
