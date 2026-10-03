import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createConnection, createDb, applyCommands, deleteOrgFixture } from '@azimut/db';
import type { EntityCommand, Outcome, Point } from '@azimut/core-model';
import { calibrationCommands } from '../plan-calibration-commands.js';
import type { CalibrationWrite, OriginProposal } from '../plan-calibration-commands.js';
import { computeCalibration } from '../../domain/plan-calibration.js';
import type { AcceptedPlan } from '../plan-import.js';
import { createFootprintCommands } from '../footprint-commands.js';
import type { FootprintRow, FootprintWrite } from '../footprint-commands.js';
import { acceptFootprint } from '../footprint-input.js';
import { graphCommands } from '../graph-commands.js';
import type { GraphWrite, NodeRow, EdgeRow } from '../graph-commands.js';
import { acceptNode, acceptEdge } from '../graph-input.js';
import type { EdgeEndpoint } from '../graph-input.js';
import { writeGraphValidation } from '../graph-validation-commands.js';

/**
 * M2, M3 et M4 (partie M) — les écrans de l'atelier écrivent réellement.
 *
 * Les essais unitaires de ces trois écrans prouvent la forme des commandes
 * contre un émetteur de doublure, qui accepte tout. Ils ne prouvent pas que la
 * base accepte : une colonne absente, un type mal encodé ou une contrainte
 * oubliée ne se voient qu'ici. C'est ainsi qu'une colonne `category_id`
 * inexistante a fait refuser chaque empreinte sans que rien ne le dise.
 *
 * Il demande `pnpm test:db`. Mise en place dans
 * `packages/db/migrations/ORDRE.md`.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];
const ALICE = '11111111-1111-1111-1111-111111111111';
const ORG = 'c2000000-0000-0000-0000-000000000001';
const SITE = 'c2000000-0000-0000-0000-000000000101';
const BUILDING = 'c2000000-0000-0000-0000-000000000102';
const LEVEL = 'c2000000-0000-0000-0000-000000000103';
const PLAN_SOURCE = 'c2000000-0000-0000-0000-000000000201';
const CALIBRATION = 'c2000000-0000-0000-0000-000000000202';
const POINT_A = 'c2000000-0000-0000-0000-000000000203';
const POINT_B = 'c2000000-0000-0000-0000-000000000204';
const FOOTPRINT_1 = 'c2000000-0000-0000-0000-000000000301';
const FOOTPRINT_2 = 'c2000000-0000-0000-0000-000000000302';
const NODE_A = 'c2000000-0000-0000-0000-000000000401';
const NODE_B = 'c2000000-0000-0000-0000-000000000402';
const EDGE = 'c2000000-0000-0000-0000-000000000403';
const T = '2026-09-23T11:00:00.000Z';

let dsn = '';
let client: ReturnType<typeof createConnection>;
let db: ReturnType<typeof createDb>;
let alice: Awaited<ReturnType<typeof client.reserve>>;

async function cleanup(): Promise<void> {
  const fresh = createConnection(dsn);
  await deleteOrgFixture(
    text => fresh.unsafe(text), text => fresh.unsafe(text), [ORG]);
  await fresh.end();
}

async function reserveAs(userId: string) {
  const held = await client.reserve();
  await held`set role authenticated`;
  await held`select set_config('azimut.current_user_id', ${userId}, false)`;
  return held;
}

/** Applique une suite de commandes et rend le refus en clair s'il y en a un. */
async function apply(built: Outcome<readonly EntityCommand[]>): Promise<void> {
  expect(built.ok, built.ok ? '' : built.findings.map(f => f.code).join(', ')).toBe(true);
  if (!built.ok) return;
  const written = await applyCommands(db, { userId: ALICE }, built.value);
  expect(
    written.ok,
    written.ok ? '' : written.findings.map(f => f.code).join(', '),
  ).toBe(true);
}

beforeAll(async () => {
  if (URL === undefined || URL === '') {
    throw new Error(
      'AZIMUT_TEST_DATABASE_URL absente. Voir packages/db/migrations/ORDRE.md.',
    );
  }
  dsn = URL;
  client = createConnection(dsn);
  db = createDb(dsn);

  await cleanup();

  for (const table of ['membership', 'organization']) {
    await client`alter table azimut.${client(table)} no force row level security`;
  }
  await client`insert into azimut.organization(id,name,slug)
    values (${ORG},'Atelier','atelier-ecriture')`;
  await client`insert into azimut.membership(org_id,user_id,role)
    values (${ORG},${ALICE},'admin')`;
  for (const table of ['membership', 'organization']) {
    await client`alter table azimut.${client(table)} force row level security`;
  }

  alice = await reserveAs(ALICE);

  // Le décor minimal : le site, son bâtiment et son niveau. Il s'écrit par le
  // chemin d'écriture, comme le reste.
  const decor: EntityCommand[] = [];
  for (const draft of [
    {
      table: 'site', id: SITE,
      after: {
        id: SITE, org_id: ORG, name: 'Site de l’atelier',
        country_code: 'FR', timezone: 'Europe/Paris',
      },
    },
    {
      table: 'building', id: BUILDING,
      after: { id: BUILDING, org_id: ORG, site_id: SITE, name: 'Bâtiment A' },
    },
    {
      table: 'level', id: LEVEL,
      after: {
        id: LEVEL, org_id: ORG, building_id: BUILDING, name: 'RDC',
        ordinal: 0, elevation_m: 0,
      },
    },
  ]) {
    decor.push({
      operation: 'create', module: '01-socle', org_id: ORG, timestamp: T,
      groupKey: null, before: null, ...draft,
    } as EntityCommand);
  }
  const seeded = await applyCommands(db, { userId: ALICE }, decor);
  if (!seeded.ok) throw new Error(seeded.findings.map(f => f.code).join(', '));
});

afterAll(async () => {
  // `alice` reste indéfinie si l'amorçage a échoué : le nettoyage doit pouvoir
  // s'exécuter quand même, sinon le motif du premier échec disparaît derrière
  // un second.
  await alice?.release();
  await cleanup();
  await client.end();
  await db.$client.end();
});

// ---------------------------------------------------------------------------
// M2 (partie M) — import et calage
// ---------------------------------------------------------------------------

const PLAN: AcceptedPlan = {
  format: 'pdf', mediaType: 'application/pdf', byteSize: 2048, page: 1, contentKind: 'raster',
};

const CALIBRATION_WRITE: CalibrationWrite = {
  orgId: ORG, siteId: SITE, levelId: LEVEL,
  planSourceId: PLAN_SOURCE, calibrationId: CALIBRATION,
  storagePath: 'plans/atelier/rdc.pdf',
  points: [
    { id: POINT_A, point: { x_px: 0, y_px: 0 } },
    { id: POINT_B, point: { x_px: 200, y_px: 0 } },
  ],
  referenceDistanceM: 20,
  timestamp: T,
};

const ORIGIN: OriginProposal = { site: {}, proposed: { x_m: 12.5, y_m: -3.25 } };

function calibration() {
  const computed = computeCalibration({
    a: { x_px: 0, y_px: 0 }, b: { x_px: 200, y_px: 0 },
    real_distance_m: 20, north_azimuth_deg: 12,
  });
  if (!computed.ok) throw new Error('calage invalide');
  return computed.value;
}

describe('M2 (partie M) — le calage s’écrit', () => {
  it('écrit le fond, son calage et ses points', async () => {
    await apply(calibrationCommands(PLAN, calibration(), ORIGIN, CALIBRATION_WRITE));

    const source = await alice`
      select level_id, media_type, storage_path, content_kind
      from azimut.plan_source where id = ${PLAN_SOURCE}`;
    expect(source[0]?.['level_id']).toBe(LEVEL);
    expect(source[0]?.['media_type']).toBe('application/pdf');
    // A5.2, version 28 : la nature du contenu survit à l'écran d'import.
    expect(source[0]?.['content_kind']).toBe('raster');

    const points = await alice`
      select ordinal, image_x_px, image_y_px from azimut.plan_calibration_point
      where calibration_id = ${CALIBRATION} order by ordinal`;
    expect(points.map(r => r['ordinal'])).toEqual([0, 1]);
  });

  /** M01.S1 — le repère est fixé par le premier calage et ne bouge plus. */
  it('fixe l’origine du repère site', async () => {
    const rows = await alice`
      select origin_x_m, origin_y_m from azimut.site where id = ${SITE}`;
    expect(Number(rows[0]?.['origin_x_m'])).toBe(12.5);
    expect(Number(rows[0]?.['origin_y_m'])).toBe(-3.25);
  });
});

// ---------------------------------------------------------------------------
// M3 (partie M) — tracé des empreintes
// ---------------------------------------------------------------------------

const SQUARE: readonly Point[] = [
  { x_m: 0, y_m: 0 }, { x_m: 3, y_m: 0 }, { x_m: 3, y_m: 4 }, { x_m: 0, y_m: 4 },
];

function accepted(code: string, vertices: readonly Point[] = SQUARE) {
  const r = acceptFootprint(
    { vertices, unitCode: code, kind: 'cell', categoryId: null },
    { codesOnLevel: [], existing: [] },
  );
  if (!r.ok) throw new Error(r.findings.map(f => f.code).join(','));
  return r.value;
}

const FOOTPRINT_WRITE: FootprintWrite = { orgId: ORG, levelId: LEVEL, timestamp: T };

describe('M3 (partie M) — les empreintes s’écrivent', () => {
  it('écrit deux cellules en un seul geste', async () => {
    const rows: readonly FootprintRow[] = [
      { id: FOOTPRINT_1, footprint: accepted('B01') },
      {
        id: FOOTPRINT_2,
        footprint: accepted('B02', SQUARE.map(v => ({ x_m: v.x_m + 4, y_m: v.y_m }))),
      },
    ];
    await apply(createFootprintCommands(rows, FOOTPRINT_WRITE, 'trace:1'));

    const written = await alice`
      select unit_code, kind from azimut.footprint
      where level_id = ${LEVEL} order by unit_code`;
    expect(written.map(r => r['unit_code'])).toEqual(['B01', 'B02']);
    expect(written.map(r => r['kind'])).toEqual(['cell', 'cell']);
  });

  /** M01.S2 — la géométrie est en mètres, et se relit telle quelle. */
  it('rend la géométrie au millimètre', async () => {
    const rows = await alice`
      select geometry from azimut.footprint where id = ${FOOTPRINT_1}`;
    expect(rows[0]?.['geometry']).toEqual({ vertices: SQUARE });
  });
});

// ---------------------------------------------------------------------------
// M4 (partie M) — saisie du graphe
// ---------------------------------------------------------------------------

function endpoint(id: string, x: number): EdgeEndpoint {
  return { nodeId: id, levelId: LEVEL, position: { x_m: x, y_m: 0 }, elevation_m: 0 };
}

const GRAPH_WRITE: GraphWrite = { orgId: ORG, levelId: LEVEL, timestamp: T };

describe('M4 (partie M) — le graphe s’écrit', () => {
  it('écrit deux nœuds et l’arête qui les relie', async () => {
    const nodes: readonly NodeRow[] = [
      { id: NODE_A, node: acceptNode({ kind: 'entrance', label: 'Entrée', position: { x_m: 0, y_m: 0 } }) },
      { id: NODE_B, node: acceptNode({ kind: 'junction', label: '', position: { x_m: 10, y_m: 0 } }) },
    ];
    const edgeAccepted = acceptEdge({
      from: endpoint(NODE_A, 0), to: endpoint(NODE_B, 10),
      widthM: 1.4, slopePct: 0, accessible: true, direction: 'both',
      evacuationRoute: false, hasVerticalLink: false,
    });
    if (!edgeAccepted.ok) throw new Error(edgeAccepted.findings.map(f => f.code).join(','));
    const edges: readonly EdgeRow[] = [{ id: EDGE, edge: edgeAccepted.value }];

    await apply(graphCommands(nodes, edges, [], GRAPH_WRITE, 'graphe:1'));

    const written = await alice`
      select kind, label from azimut.node where level_id = ${LEVEL} order by kind`;
    expect(written.map(r => r['kind'])).toEqual(['entrance', 'junction']);
  });

  /** M01.S6 — la longueur est calculée, jamais saisie. */
  it('écrit une arête dont la longueur est celle du calcul', async () => {
    const rows = await alice`
      select length_m, width_m, accessible, direction from azimut.edge where id = ${EDGE}`;
    expect(Number(rows[0]?.['length_m'])).toBe(10);
    expect(Number(rows[0]?.['width_m'])).toBe(1.4);
    expect(rows[0]?.['accessible']).toBe(true);
    expect(rows[0]?.['direction']).toBe('both');
  });
});

// ---------------------------------------------------------------------------
// M5 (partie M) — validation de complétude
// ---------------------------------------------------------------------------

/**
 * M5 (partie M) — « Relancer | Recalcule, affiche la durée réelle, enregistre
 * le passage dans `graph_validation` ».
 *
 * Décor à part, et qui ne se retire pas. A12.3 interdit toute suppression d'un
 * passage de validation, et A5.11 fait refuser à sa clé la suppression du
 * site : une organisation qui en porte un ne se nettoie plus, et seule la
 * purge d'O15 la retirerait. Le décor est donc distinct de celui de l'atelier,
 * posé une fois et repris tel quel aux passages suivants. `db:reset` le
 * retire, rien d'autre.
 */
const ORG_V = 'c3000000-0000-0000-0000-000000000001';
const SITE_V = 'c3000000-0000-0000-0000-000000000101';

describe('M5 (partie M) — le passage de validation s’enregistre', () => {
  it('écrit un passage, avec l’empreinte du graphe validé', async () => {
    await client`alter table azimut.membership no force row level security`;
    await client`alter table azimut.organization no force row level security`;
    await client`insert into azimut.organization(id,name,slug)
      values (${ORG_V},'Validation','atelier-validation') on conflict (id) do nothing`;
    await client`insert into azimut.membership(org_id,user_id,role)
      values (${ORG_V},${ALICE},'admin') on conflict do nothing`;
    await client`alter table azimut.organization force row level security`;
    await client`alter table azimut.membership force row level security`;

    const held = await reserveAs(ALICE);
    try {
      await held`insert into azimut.site(id,org_id,name,country_code,timezone)
        values (${SITE_V},${ORG_V},'Site validé','FR','Europe/Paris')
        on conflict (id) do nothing`;

      // Un identifiant neuf à chaque passage : la ligne précédente ne se
      // supprime pas, et la réécrire buterait sur sa clé.
      const id = crypto.randomUUID();
      const built = writeGraphValidation([], {
        orgId: ORG_V, siteId: SITE_V, id,
        timestamp: T, graphHash: 'sha256:essai-atelier',
      });
      expect(built.ok, built.ok ? '' : built.findings.map(f => f.code).join(', ')).toBe(true);
      if (!built.ok) return;

      const written = await applyCommands(db, { userId: ALICE }, [built.value]);
      expect(
        written.ok,
        written.ok ? '' : written.findings.map(f => f.code).join(', '),
      ).toBe(true);

      const rows = await held`
        select graph_hash, passed, blocking_count, warning_count
        from azimut.graph_validation where id = ${id}`;
      expect(rows[0]?.['graph_hash']).toBe('sha256:essai-atelier');
      expect(rows[0]?.['passed']).toBe(true);
      expect(rows[0]?.['blocking_count']).toBe(0);
      expect(rows[0]?.['warning_count']).toBe(0);
    } finally {
      await held.release();
    }
  });
});
