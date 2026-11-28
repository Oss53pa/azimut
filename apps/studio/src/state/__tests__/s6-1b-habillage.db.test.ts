import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createConnection, createDb, applyCommands, enrolFixtureMembers, withFixtureRole } from '@azimut/db';
import { startPostgrest, signToken, installPlatformStubs } from '@azimut/db/harness';
import type { Harness } from '@azimut/db/harness';
import { inverseCommand } from '@azimut/core-model';
import type { EntityCommand } from '@azimut/core-model';
import { query } from '../../data/postgrest-http.js';
import { setAccessTokenSource } from '../../auth/access-token.js';
import { createJournaledSink } from '../journaled-sink.js';
import type { SinkConfig } from '../postgrest-sink.js';
import type { DecorationShape } from '../../editor/scene-objects.js';
import { DEFAULT_DECORATION_STYLE } from '../../editor/scene-objects.js';
import type { EditorDocument } from '../../editor/editor-document.js';
import { applyPatch, emptyDocument } from '../../editor/editor-document.js';
import type { Command } from '../../editor/command.js';
import type { DocumentPatch } from '../../editor/editor-document.js';
import {
  createShapesCommand, defaultLayer, deleteShapesCommand, moveShapesCommand, reorderShapesCommand,
} from '../../editor/document-commands.js';
import { decorationCommands } from '../../editor/decoration-commands.js';
import { decorationFromRows } from '../../editor/decoration-rows.js';

/**
 * S6.1b, décision Q11 — la famille de commandes d'habillage, sur base réelle,
 * par le chemin que l'atelier emprunte : PostgREST et le journal (0078).
 *
 * Acceptation de S6.1a reprise : une commande écrite se relit à l'identique,
 * son inverse aussi. Chaque geste de l'éditeur — créer, déplacer, réordonner,
 * supprimer — est traduit, écrit, relu, et le document relu est celui de
 * l'éditeur.
 *
 * **Décor qui ne se retire pas** (journal en insertion seule) : un site neuf
 * par exécution, dans une organisation d'essai que `db:reset` seul retire.
 */
const dsn = process.env['AZIMUT_TEST_DATABASE_URL'] ?? '';
const postgrestBinary = process.env['AZIMUT_TEST_POSTGREST'] ?? '';
const postgrestDbUri = process.env['AZIMUT_TEST_POSTGREST_DB_URI'] ?? '';
const jwtSecret = process.env['AZIMUT_TEST_JWT_SECRET'] ?? '';
const runnable = dsn !== '' && postgrestBinary !== '' && existsSync(postgrestBinary)
  && postgrestDbUri !== '' && jwtSecret !== '';

const ORG = '0b1b0000-0000-4000-8000-0000000000a1';
const DESIGNER = '0b1b0000-0000-4000-8000-0000000000d1';
const SITE = randomUUID();
const BUILDING = randomUUID();
const LEVEL = randomUUID();
const T = '2026-11-25T10:00:00.000Z';
const API_KEY = 'cle-publiable-du-banc';
const LAYER = defaultLayer(ORG, SITE, LEVEL);
const [A, B, C] = [randomUUID(), randomUUID(), randomUUID()];

let client: ReturnType<typeof createConnection>;
let db: ReturnType<typeof createDb>;
let rest: Harness;
let config: SinkConfig;
let doc: EditorDocument = emptyDocument(SITE);

function shape(id: string, x: number, kind: 'rect' | 'line' | 'symbol' = 'rect'): DecorationShape {
  const base = { id, orgId: ORG, layerId: LAYER.id, styleRole: null, style: DEFAULT_DECORATION_STYLE, label: '', rotation_deg: 0 };
  if (kind === 'line') {
    return { ...base, kind: 'path', geometry: { type: 'polyline', points: [{ x_m: x, y_m: 0 }, { x_m: x + 1.5, y_m: 2 }] } };
  }
  if (kind === 'symbol') {
    return { ...base, kind: 'symbol', label: 'Chêne', rotation_deg: 45, geometry: { type: 'symbol_ref', position: { x_m: x, y_m: 1 }, symbolId: 'arbre.feuillu', scale: 1.25 } };
  }
  return { ...base, kind: 'area', geometry: { type: 'rectangle', origin: { x_m: x, y_m: 0 }, width_m: 1, height_m: 2 } };
}

async function send(commands: readonly EntityCommand[]): Promise<void> {
  const out = await createJournaledSink(config, { siteId: SITE, levelId: LEVEL })(commands);
  if (!out.ok) throw new Error(out.findings.map(f => `${f.code}:${String(f.params['cause'])}`).join(','));
}

/** Traduit le geste, l'écrit, et avance le document de l'éditeur. */
async function gesture(command: Command<DocumentPatch> | null): Promise<readonly EntityCommand[]> {
  if (command === null) throw new Error('geste vide');
  const translated = decorationCommands(command, doc.shapes, { orgId: ORG, timestamp: T, groupKey: null });
  if (!translated.ok) throw new Error(translated.findings.map(f => f.code).join(','));
  await send(translated.value);
  doc = applyPatch(doc, command.after);
  return translated.value;
}

async function reread() {
  const release = setAccessTokenSource(() => signToken(DESIGNER));
  try {
    const rest_ = { url: rest.url, apiKey: API_KEY, schema: 'azimut' };
    const layers = await query<Record<string, unknown>>(rest_, 'decoration_layer', `select=*&site_id=eq.${SITE}`);
    const shapes = await query<Record<string, unknown>>(rest_, 'decoration_shape', `select=*&layer_id=eq.${LAYER.id}`);
    return decorationFromRows(layers, shapes);
  } finally {
    release();
  }
}

describe.runIf(runnable)('S6.1b — l’habillage écrit et relu par le journal', () => {
  beforeAll(async () => {
    client = createConnection(dsn);
    db = createDb(dsn);
    await withFixtureRole(client, tx => tx`insert into azimut.organization(id,name,slug) values (${ORG},'S6.1b','s6-1b-habillage')
                 on conflict (id) do nothing`);
    await enrolFixtureMembers(text => client.unsafe(text), [{ orgId: ORG, userId: DESIGNER, role: 'designer' }]);
    const decor = [
      { table: 'site', id: SITE, after: { id: SITE, org_id: ORG, name: 'Site habillé', country_code: 'FR', timezone: 'Europe/Paris' } },
      { table: 'building', id: BUILDING, after: { id: BUILDING, org_id: ORG, site_id: SITE, name: 'B' } },
      { table: 'level', id: LEVEL, after: { id: LEVEL, org_id: ORG, building_id: BUILDING, name: 'RDC', ordinal: 0, elevation_m: 0 } },
    ].map(d => ({ operation: 'create', module: '01-socle', org_id: ORG, timestamp: T, groupKey: null, before: null, ...d }) as EntityCommand);
    const written = await applyCommands(db, { userId: DESIGNER }, decor);
    if (!written.ok) throw new Error(written.findings.map(f => f.code).join(', '));
    await installPlatformStubs(client);
    rest = await startPostgrest({ binary: postgrestBinary, dbUri: postgrestDbUri, port: 3995 });
    config = { url: rest.url, apiKey: API_KEY, schema: 'azimut', accessToken: signToken(DESIGNER) };
  }, 60_000);

  afterAll(async () => {
    await rest.stop();
    await client.end();
    await db.$client.end();
  });

  it('créer : la couche et trois formes se relisent à l’identique', async () => {
    await gesture(createShapesCommand(doc, [shape(A, 0), shape(B, 2, 'line'), shape(C, 4, 'symbol')], LAYER, T));
    const read = await reread();
    expect(read.unreadable).toBe(0);
    expect(read.layers).toEqual([LAYER]);
    expect(read.shapes).toEqual(doc.shapes);
  });

  it('déplacer, puis réordonner : relu dans le même état et le même ordre', async () => {
    await gesture(moveShapesCommand(doc, [{ id: B, dx_m: 0.25, dy_m: -1 }], T));
    expect((await reread()).shapes).toEqual(doc.shapes);
    await gesture(reorderShapesCommand(doc, [C, A, B], T));
    expect((await reread()).shapes.map(s => s.id)).toEqual([C, A, B]);
    expect((await reread()).shapes).toEqual(doc.shapes);
  });

  it('supprimer, puis annuler par l’inverse : la forme revient à l’identique', async () => {
    const before = doc;
    const written = await gesture(deleteShapesCommand(doc, [A], T));
    expect((await reread()).shapes).toEqual(doc.shapes);
    await send([...written].reverse().map(c => inverseCommand(c, T)));
    expect((await reread()).shapes).toEqual(before.shapes);
  });
});
