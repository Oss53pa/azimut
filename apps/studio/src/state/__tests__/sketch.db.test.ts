import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildCommand } from '@azimut/core-model';
import type { EntityCommand } from '@azimut/core-model';
import { applyCommands, createConnection, createDb, provisionOrganization } from '@azimut/db';
import { eraseCommands, layerVisibilityCommand, sketchStrokeCommands } from '../sketch.js';
import { randomUUID } from 'node:crypto';

/**
 * J3 (partie J) : la couche d'esquisse contre la base réelle (migration 0072),
 * par le chemin d'écriture ordinaire et sous cloisonnement forcé.
 *
 * Ce qui s'éprouve : un trait et sa couche s'écrivent d'un geste ; le tracé et
 * sa pression reviennent tels quels ; la gomme supprime logiquement ; une
 * autre organisation n'en voit rien ; une couleur hors palette est refusée.
 */
/**
 * Un décor propre à chaque exécution (préfixe `RUN`). Depuis 0083,
 * la suppression logique d’un trait laisse une entrée au journal d'audit, que rien ne
 * supprime (A12.3) : l'organisation de l'essai ne se retire donc plus, et
 * l'exécution suivante en prend une autre.
 */
const RUN = randomUUID().slice(0, 8);
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];
const ALICE = `${RUN}-0000-0000-0000-0000000000a1`;
const BOB = `${RUN}-0000-0000-0000-0000000000b1`;
const ORG = `${RUN}-0000-0000-0000-00000000a0a0`;
const ORG_B = `${RUN}-0000-0000-0000-00000000b0b0`;
const SITE = `${RUN}-0000-0000-0000-0000000005a1`;
const BUILDING = `${RUN}-0000-0000-0000-0000000006a1`;
const LEVEL = `${RUN}-0000-0000-0000-0000000007a1`;
const LAYER = `${RUN}-0000-0000-0000-0000000008a1`;
const STROKE = `${RUN}-0000-0000-0000-0000000009a1`;
const T = '2026-10-04T10:00:00.000Z';
const POINTS = [{ x_m: 1.23456789, y_m: 2.5, p: 0.37 }, { x_m: 4.1, y_m: 3.33333, p: 0.91 }];

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
  for (const [user, org, slug] of [[ALICE, ORG, `j3-a-${RUN}`], [BOB, ORG_B, `j3-b-${RUN}`]] as const) {
    await client.begin(tx => provisionOrganization(
      text => tx.unsafe(text), { id: org, name: slug, slug, adminId: user }));
  }
  await apply(ALICE, [
    command('site', SITE, { id: SITE, org_id: ORG, name: 'Site esquisse', country_code: 'FR', timezone: 'Europe/Paris' }),
    command('building', BUILDING, { id: BUILDING, org_id: ORG, site_id: SITE, name: 'Bâtiment 1' }),
    command('level', LEVEL, { id: LEVEL, org_id: ORG, building_id: BUILDING, name: 'Niveau 0', ordinal: '0', elevation_m: '0' }),
  ]);
});

afterAll(async () => {
  await client.end();
  await db.$client.end();
});

describe('J3 : la couche d’esquisse en base', () => {
  it('un trait et sa couche s’écrivent d’un geste, le tracé et sa pression intacts', async () => {
    const out = sketchStrokeCommands(
      { newId: LAYER, name: 'Esquisse' },
      { id: STROKE, tool: 'felt', color: 'ultramarine', points: POINTS },
      { orgId: ORG, siteId: SITE, levelId: LEVEL, timestamp: T },
    );
    if (!out.ok) throw new Error(JSON.stringify(out.findings));
    await apply(ALICE, out.value);

    const [layer] = await asUser(ALICE, 'select owner_id, visible from azimut.sketch_layer where id = $1', [LAYER]);
    expect(layer).toMatchObject({ owner_id: ALICE, visible: true });
    const [stroke] = await asUser(ALICE, 'select points, color, tool from azimut.sketch_stroke where id = $1', [STROKE]);
    expect(stroke).toMatchObject({ color: 'ultramarine', tool: 'felt', points: POINTS });
  });

  it('la couche se masque puis se remontre, booléen compris', async () => {
    const write = { orgId: ORG, timestamp: '2026-10-04T10:02:00.000Z' };
    const hide = layerVisibilityCommand({ id: LAYER, visible: true, locked: false }, false, write);
    if (!hide.ok) throw new Error(JSON.stringify(hide.findings));
    await apply(ALICE, [hide.value]);
    const [hidden] = await asUser(ALICE, 'select visible from azimut.sketch_layer where id = $1', [LAYER]);
    expect(hidden).toMatchObject({ visible: false });
    const show = layerVisibilityCommand({ id: LAYER, visible: false, locked: false }, true, write);
    if (!show.ok) throw new Error(JSON.stringify(show.findings));
    await apply(ALICE, [show.value]);
    const [shown] = await asUser(ALICE, 'select visible from azimut.sketch_layer where id = $1', [LAYER]);
    expect(shown).toMatchObject({ visible: true });
  });

  it('une autre organisation n’en voit rien', async () => {
    expect(await asUser(BOB, 'select id from azimut.sketch_stroke where id = $1', [STROKE])).toHaveLength(0);
    expect(await asUser(BOB, 'select id from azimut.sketch_layer where id = $1', [LAYER])).toHaveLength(0);
  });

  it('la gomme supprime logiquement : la ligne reste, datée', async () => {
    const out = eraseCommands([STROKE], { orgId: ORG, timestamp: '2026-10-04T10:05:00.000Z' });
    if (!out.ok) throw new Error(JSON.stringify(out.findings));
    await apply(ALICE, out.value);
    const [stroke] = await asUser(ALICE, 'select deleted_at from azimut.sketch_stroke where id = $1', [STROKE]);
    expect(stroke?.['deleted_at']).not.toBeNull();
  });

  it('une couleur hors de la palette d’esquisse est refusée par la base', async () => {
    const draft = {
      operation: 'create', module: '12-atelier', table: 'sketch_stroke', id: `${RUN}-0000-0000-0000-0000000009b2`,
      org_id: ORG, timestamp: T,
      after: {
        id: `${RUN}-0000-0000-0000-0000000009b2`, org_id: ORG, layer_id: LAYER, tool: 'felt',
        color: 'charter-primary', width_base_m: '0.08', points: '[]',
      },
    } as const;
    // Le modèle la refuse (lot 4) ; elle part tout de même, construite à la
    // main, pour éprouver la base sans supposer que l'appelant l'a filtrée.
    expect(buildCommand(draft).ok).toBe(false);
    const applied = await applyCommands(db, { userId: ALICE }, [{ ...draft, before: null, groupKey: null }]);
    expect(applied.ok).toBe(false);
  });
});
