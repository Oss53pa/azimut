import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import {
  createConnection, createDb, applyCommands, deleteOrgFixture, enrolFixtureMembers,
} from '@azimut/db';
import { startPostgrest, signToken, installPlatformStubs } from '@azimut/db/harness';
import type { Harness } from '@azimut/db/harness';
import { inverseCommand, serializeCommand } from '@azimut/core-model';
import type { EntityCommand, Outcome, Point, SiteData } from '@azimut/core-model';
import { createPostgrestRepository } from '../../data/postgrest-repository.js';
import { setAccessTokenSource } from '../../auth/access-token.js';
import { sessionFromSite } from '../session-from-site.js';
import type { StoredRow } from '../session-store.js';
import { createFootprintCommands } from '../footprint-commands.js';
import { acceptFootprint } from '../footprint-input.js';
import { graphCommands } from '../graph-commands.js';
import { acceptNode, acceptEdge } from '../graph-input.js';
import type { EdgeEndpoint } from '../graph-input.js';
import { updateEdgeCommands, updateNodeCommands } from '../graph-update-commands.js';
import { deleteLevelCommands, renameCommands } from '../site-structure.js';
import { strikeFootprints } from '../footprint-strike.js';

/**
 * Q11 — décision d'Oss53pa du 21 novembre 2026 : avant de brancher l'atelier
 * sur le chemin journalisé (S6.6b), chaque famille de commande s'éprouve sur
 * une base réelle.
 *
 * `apply_journaled_commands` (0078) compare chaque colonne de `before` à la
 * ligne en base, dans le type de la colonne. L'atelier, lui, tire `before` de
 * ses lignes de session, qui viennent du modèle (`sessionFromSite`) et non de
 * la base. Une valeur que le modèle transforme ferait échouer chaque
 * modification de sa famille en 409 : c'est ce que cet essai cherche.
 *
 * Le chemin est celui du poste : le site est relu par PostgREST et par le
 * dépôt du studio, puis chaque commande est construite par le constructeur
 * de l'atelier. Seule l'application diffère : elle se fait par une connexion
 * directe, sous l'identité de l'utilisateur, dans une transaction annulée. Le
 * journal ne garde donc aucune ligne, et le décor se retire.
 */
const dsn = process.env['AZIMUT_TEST_DATABASE_URL'] ?? '';
const postgrestBinary = process.env['AZIMUT_TEST_POSTGREST'] ?? '';
const postgrestDbUri = process.env['AZIMUT_TEST_POSTGREST_DB_URI'] ?? '';
const jwtSecret = process.env['AZIMUT_TEST_JWT_SECRET'] ?? '';
const runnable = dsn !== '' && postgrestBinary !== '' && existsSync(postgrestBinary)
  && postgrestDbUri !== '' && jwtSecret !== '';

const USER = 'd1100000-0000-4000-8000-0000000000d1';
const ORG = 'd1100000-0000-4000-8000-0000000000a1';
const SITE = 'd1100000-0000-4000-8000-0000000000b1';
const BUILDING = 'd1100000-0000-4000-8000-0000000000b2';
const LEVEL = 'd1100000-0000-4000-8000-0000000000b3';
const EMPTY_LEVEL = 'd1100000-0000-4000-8000-0000000000b4';
const FOOTPRINT_1 = 'd1100000-0000-4000-8000-0000000000c1';
const FOOTPRINT_2 = 'd1100000-0000-4000-8000-0000000000c2';
const NODE_A = 'd1100000-0000-4000-8000-0000000000e1';
const NODE_B = 'd1100000-0000-4000-8000-0000000000e2';
const EDGE = 'd1100000-0000-4000-8000-0000000000e3';
const T = '2026-11-21T10:00:00.000Z';
const API_KEY = 'cle-publiable-du-banc';

let client: ReturnType<typeof createConnection>;
let db: ReturnType<typeof createDb>;
let rest: Harness;
let site: SiteData;
let rows: readonly StoredRow[];
let createdFootprints: readonly EntityCommand[] = [];
let createdGraph: readonly EntityCommand[] = [];

function commands(built: Outcome<readonly EntityCommand[]>): readonly EntityCommand[] {
  if (!built.ok) throw new Error(built.findings.map(f => f.code).join(', '));
  return built.value;
}

const SQUARE: readonly Point[] = [
  { x_m: 0, y_m: 0 }, { x_m: 3, y_m: 0 }, { x_m: 3, y_m: 4 }, { x_m: 0, y_m: 4 },
];

function footprint(code: string, dx: number) {
  const r = acceptFootprint(
    { vertices: SQUARE.map(v => ({ x_m: v.x_m + dx, y_m: v.y_m })), unitCode: code, kind: 'cell', categoryId: null },
    { codesOnLevel: [], existing: [] },
  );
  if (!r.ok) throw new Error(r.findings.map(f => f.code).join(','));
  return r.value;
}

function endpoint(id: string, x: number): EdgeEndpoint {
  return { nodeId: id, levelId: LEVEL, position: { x_m: x, y_m: 0 }, elevation_m: 0 };
}

/**
 * Applique par le chemin journalisé, sous l'identité de l'utilisateur, et
 * annule. Rend le refus de la base, ou « accepté ».
 */
async function journaled(cmds: readonly EntityCommand[]): Promise<string> {
  const wire = cmds.map(c => {
    const out = serializeCommand(c);
    if (!out.ok) throw new Error('écriture');
    return JSON.parse(out.value) as unknown;
  });
  const done = new Error('annulation voulue');
  let verdict = 'accepté';
  await client.begin(async tx => {
    await tx`select set_config('azimut.current_user_id', ${USER}, true)`;
    await tx`set local role authenticated`;
    try {
      await tx.savepoint(async sp => {
        await sp`select azimut.apply_journaled_commands(${SITE}, null, ${JSON.stringify(wire)}::text::jsonb)`;
      });
    } catch (e: unknown) {
      const code = (e as { code?: unknown }).code;
      verdict = `${typeof code === 'string' ? code : '?'} ${e instanceof Error ? e.message : String(e)}`;
    }
    throw done;
  }).catch((e: unknown) => { if (e !== done) throw e; });
  return verdict;
}

describe.runIf(runnable)('Q11 — fidélité de before, famille par famille', () => {
  beforeAll(async () => {
    client = createConnection(dsn);
    db = createDb(dsn);
    await deleteOrgFixture(text => client.unsafe(text), text => client.unsafe(text), [ORG]);
    await client.unsafe('alter table azimut.organization no force row level security');
    await client`insert into azimut.organization(id,name,slug) values (${ORG},'Q11','q11-fidelite')`;
    await client.unsafe('alter table azimut.organization force row level security');
    await enrolFixtureMembers(text => client.unsafe(text), [{ orgId: ORG, userId: USER, role: 'designer' }]);

    // Le décor s'écrit par le chemin d'écriture et par les constructeurs de
    // l'atelier, comme un parcours réel.
    const decor: EntityCommand[] = [
      { table: 'site', id: SITE, after: { id: SITE, org_id: ORG, name: 'Site Q11', country_code: 'FR', timezone: 'Europe/Paris' } },
      { table: 'building', id: BUILDING, after: { id: BUILDING, org_id: ORG, site_id: SITE, name: 'Bâtiment A' } },
      { table: 'level', id: LEVEL, after: { id: LEVEL, org_id: ORG, building_id: BUILDING, name: 'RDC', ordinal: 0, elevation_m: 0 } },
      { table: 'level', id: EMPTY_LEVEL, after: { id: EMPTY_LEVEL, org_id: ORG, building_id: BUILDING, name: 'R+1', ordinal: 1, elevation_m: 3.5 } },
    ].map(d => ({ operation: 'create', module: '01-socle', org_id: ORG, timestamp: T, groupKey: null, before: null, ...d }) as EntityCommand);
    createdFootprints = commands(createFootprintCommands([
      { id: FOOTPRINT_1, footprint: footprint('B01', 0) },
      { id: FOOTPRINT_2, footprint: footprint('B02', 4) },
    ], { orgId: ORG, levelId: LEVEL, timestamp: T }, 'trace:1'));
    const edge = acceptEdge({
      from: endpoint(NODE_A, 0), to: endpoint(NODE_B, 10.25),
      widthM: 1.4, slopePct: 0, accessible: true, direction: 'both',
      evacuationRoute: false, hasVerticalLink: false,
    });
    if (!edge.ok) throw new Error('arête');
    createdGraph = commands(graphCommands(
      [
        { id: NODE_A, node: acceptNode({ kind: 'entrance', label: 'Entrée', position: { x_m: 0, y_m: 0 } }) },
        { id: NODE_B, node: acceptNode({ kind: 'junction', label: '', position: { x_m: 10.25, y_m: 0 } }) },
      ],
      [{ id: EDGE, edge: edge.value }], [], { orgId: ORG, levelId: LEVEL, timestamp: T }, 'graphe:1',
    ));
    const written = await applyCommands(db, { userId: USER }, [...decor, ...createdFootprints, ...createdGraph]);
    if (!written.ok) throw new Error(written.findings.map(f => f.code).join(', '));

    // La relecture, par le chemin du poste. L'identité du jeton se lit par
    // `auth.uid()`, que la plateforme fournit et que le banc pose.
    await installPlatformStubs(client);
    rest = await startPostgrest({ binary: postgrestBinary, dbUri: postgrestDbUri, port: 3994 });
    const release = setAccessTokenSource(() => signToken(USER));
    try {
      site = await createPostgrestRepository({ url: rest.url, apiKey: API_KEY, schema: 'azimut' }).loadSite(SITE);
    } finally {
      release();
    }
    rows = sessionFromSite(site).rows;
  }, 60_000);

  afterAll(async () => {
    await rest.stop();
    await deleteOrgFixture(text => client.unsafe(text), text => client.unsafe(text), [ORG]);
    await client.end();
    await db.$client.end();
  });

  const write = () => ({ orgId: ORG, siteId: SITE, timestamp: T });
  const level = (id: string) => rows.find(r => r.table === 'level' && r.id === id);
  const node = (id: string) => site.graph.nodes.find(n => n.id === id);

  it('l’essai mord : un before qui ne correspond plus est refusé', async () => {
    expect(await journaled(commands(renameCommands('building', BUILDING, 'Pas ce nom', 'Bâtiment Nord', [], write()))))
      .toMatch(/^PT409/);
  });

  it('la session relue porte les lignes que les familles emploient', () => {
    for (const [table, id] of [['level', EMPTY_LEVEL], ['footprint', FOOTPRINT_2], ['node', NODE_B], ['edge', EDGE]] as const) {
      expect(rows.some(r => r.table === table && r.id === id), `${table} ${id}`).toBe(true);
    }
  });

  it('renommer un bâtiment', async () => {
    expect(await journaled(commands(renameCommands('building', BUILDING, 'Bâtiment A', 'Bâtiment Nord', [], write()))))
      .toBe('accepté');
  });

  it('renommer un niveau', async () => {
    expect(await journaled(commands(renameCommands('level', LEVEL, 'RDC', 'Rez-de-chaussée', [], write()))))
      .toBe('accepté');
  });

  it('supprimer un niveau vide', async () => {
    const empty = level(EMPTY_LEVEL);
    if (empty === undefined) throw new Error('niveau absent de la session');
    expect(await journaled(commands(deleteLevelCommands(empty, { footprints: 0, nodes: 0 }, write()))))
      .toBe('accepté');
  });

  it('déplacer un nœud, longueurs d’arêtes comprises', async () => {
    const before = node(NODE_B);
    if (before === undefined) throw new Error('nœud absent');
    expect(await journaled(commands(updateNodeCommands(
      before, { kind: before.kind, label: 'Carrefour', position: { x_m: 12.5, y_m: 1.125 } },
      site.graph.edges, site.graph.nodes, { orgId: ORG, timestamp: T }, 'deplacer:1',
    )))).toBe('accepté');
  });

  it('modifier une arête', async () => {
    const before = site.graph.edges.find(e => e.id === EDGE);
    if (before === undefined) throw new Error('arête absente');
    expect(await journaled(commands(updateEdgeCommands(
      before, { widthM: 2.2, slopePct: 4, accessible: false, direction: 'forward', evacuationRoute: true },
      { orgId: ORG, timestamp: T }, 'arete:1',
    )))).toBe('accepté');
  });

  it('rayer une empreinte', async () => {
    const struck = strikeFootprints(rows, [FOOTPRINT_2], { orgId: ORG, timestamp: T });
    if (struck.kind !== 'deleted') throw new Error(`rayure : ${struck.kind}`);
    expect(await journaled(struck.commands)).toBe('accepté');
  });

  it('annuler la création des empreintes', async () => {
    expect(await journaled([...createdFootprints].reverse().map(c => inverseCommand(c, T)))).toBe('accepté');
  });

  it('annuler la création du graphe', async () => {
    expect(await journaled([...createdGraph].reverse().map(c => inverseCommand(c, T)))).toBe('accepté');
  });
});
