import { describe, it, expect } from 'vitest';
import { canonicalSerialize, sha256Hex } from '@azimut/core-model';
import type { EntityCommand, Outcome, Point } from '@azimut/core-model';
import { EMPTY_STORE, dispatch, undo, redo, afterSync, canUndo } from '../command-store.js';
import type { StoreState } from '../command-store.js';
import { EMPTY_SESSION, writeToSession } from '../session-store.js';
import type { SessionState } from '../session-store.js';
import { acceptFootprint } from '../footprint-input.js';
import { createFootprintCommands } from '../footprint-commands.js';
import { acceptNode, acceptEdge } from '../graph-input.js';
import { graphCommands } from '../graph-commands.js';

/**
 * E4.4 — essai obligatoire, sur le chemin qui écrit réellement.
 *
 * « Rejouer une séquence enregistrée d'opérations d'édition sur un site de
 * référence, deux fois, et vérifier l'égalité stricte de l'état final et des
 * empreintes de rendu. »
 *
 * L'éditeur de documents a le sien depuis longtemps. Il porte sur ses propres
 * correctifs de document, et non sur les `EntityCommand` qui mènent à la base :
 * la preuve existait donc sur une couche que personne n'écrit. Celui-ci porte
 * sur l'autre, celle des empreintes et du graphe — T-1.2b, préalable à T-1.4.
 *
 * La séquence comporte une annulation et un rétablissement, parce que c'est là
 * que le rejeu se casse d'ordinaire : une pile qui garderait un horodatage, un
 * identifiant tiré au sort ou un ordre d'itération non trié ferait diverger le
 * second passage du premier.
 */

const ORG = 'aaaaaaaa-0000-0000-0000-000000000001';
const LEVEL = 'a7000000-0000-0000-0000-0000000000c1';
const T0 = '2026-09-22T10:00:00.000Z';

/** Un identifiant par rang, jamais tiré au sort : INV-4. */
function idOf(rank: number): string {
  return `00000000-0000-4000-8000-${rank.toString(16).padStart(12, '0')}`;
}

function square(x: number, y: number): readonly Point[] {
  return [
    { x_m: x, y_m: y },
    { x_m: x + 4, y_m: y },
    { x_m: x + 4, y_m: y + 3 },
    { x_m: x, y_m: y + 3 },
  ];
}

/**
 * La séquence enregistrée : quatre gestes, puis une annulation, puis un
 * rétablissement. Elle est déclarée une fois et rejouée telle quelle.
 */
type Gesture =
  | { readonly kind: 'footprint'; readonly rank: number; readonly code: string; readonly at: readonly [number, number] }
  | { readonly kind: 'graph'; readonly rank: number }
  | { readonly kind: 'undo' }
  | { readonly kind: 'redo' };

const SEQUENCE: readonly Gesture[] = [
  { kind: 'footprint', rank: 1, code: 'B01', at: [0, 0] },
  { kind: 'footprint', rank: 2, code: 'B02', at: [10, 0] },
  { kind: 'graph', rank: 3 },
  { kind: 'footprint', rank: 6, code: 'B03', at: [20, 0] },
  { kind: 'undo' },
  { kind: 'redo' },
];

function footprintGesture(
  rank: number, code: string, at: readonly [number, number],
  codesOnLevel: readonly string[],
): readonly EntityCommand[] {
  const accepted = acceptFootprint(
    { vertices: square(at[0], at[1]), unitCode: code, kind: 'cell', categoryId: null },
    { codesOnLevel, existing: [] },
  );
  if (!accepted.ok) throw new Error(`empreinte refusée : ${JSON.stringify(accepted.findings)}`);
  const id = idOf(rank);
  const built = createFootprintCommands(
    [{ id, footprint: accepted.value }],
    { orgId: ORG, levelId: LEVEL, timestamp: T0 },
    `footprint:${id}`,
  );
  if (!built.ok) throw new Error(JSON.stringify(built.findings));
  return built.value;
}

function graphGesture(rank: number): readonly EntityCommand[] {
  const from = { nodeId: idOf(rank), levelId: LEVEL, position: { x_m: 1, y_m: 1 }, elevation_m: 0 };
  const to = { nodeId: idOf(rank + 1), levelId: LEVEL, position: { x_m: 9, y_m: 1 }, elevation_m: 0 };
  const edge = acceptEdge({
    from, to, widthM: 2.4, slopePct: 0, accessible: true,
    direction: 'both', evacuationRoute: false, hasVerticalLink: false,
  });
  if (!edge.ok) throw new Error(JSON.stringify(edge.findings));

  const built = graphCommands(
    [
      { id: from.nodeId, node: acceptNode({ kind: 'entrance', label: 'Entrée', position: from.position }) },
      { id: to.nodeId, node: acceptNode({ kind: 'junction', label: 'Carrefour', position: to.position }) },
    ],
    [{ id: idOf(rank + 2), edge: edge.value }],
    [],
    { orgId: ORG, levelId: LEVEL, timestamp: T0 },
    `graph:${idOf(rank)}`,
  );
  if (!built.ok) throw new Error(JSON.stringify(built.findings));
  return built.value;
}

/** L'état final d'un passage : les lignes locales et la pile. */
type Replay = { readonly session: SessionState; readonly store: StoreState };

async function play(): Promise<Replay> {
  let session: SessionState = EMPTY_SESSION;
  let store: StoreState = EMPTY_STORE;

  // L'émetteur applique à l'état local. Il ne lit ni horloge ni réseau : le
  // rejeu doit dépendre de la seule séquence.
  const sink = async (commands: readonly EntityCommand[]): Promise<Outcome<unknown>> => {
    session = await writeToSession(session, commands, async () => ({
      ok: true, value: null, warnings: [],
    }));
    return { ok: true, value: null, warnings: [] };
  };

  for (const gesture of SEQUENCE) {
    if (gesture.kind === 'undo') {
      ({ state: store } = await undo(store, sink, T0));
      continue;
    }
    if (gesture.kind === 'redo') {
      ({ state: store } = await redo(store, sink, T0));
      continue;
    }
    const codes = session.rows
      .filter(r => r.table === 'footprint')
      .map(r => String(r.values['unit_code'] ?? ''));
    const commands = gesture.kind === 'footprint'
      ? footprintGesture(gesture.rank, gesture.code, gesture.at, codes)
      : graphGesture(gesture.rank);
    ({ state: store } = await dispatch(store, sink, commands));
  }

  return { session, store };
}

describe('E4.4 — le rejeu d’une séquence donne deux fois le même état', () => {
  it('rend deux fois les mêmes lignes locales', async () => {
    const first = await play();
    const second = await play();
    expect(second.session.rows).toEqual(first.session.rows);
  });

  it('rend deux fois la même pile d’annulation et de rétablissement', async () => {
    const first = await play();
    const second = await play();
    expect(second.store.undoStack).toEqual(first.store.undoStack);
    expect(second.store.redoStack).toEqual(first.store.redoStack);
  });

  it('produit deux sérialisations identiques, octet pour octet (INV-4)', async () => {
    const first = canonicalSerialize((await play()).session.rows);
    const second = canonicalSerialize((await play()).session.rows);
    expect(second).toBe(first);
  });

  it('produit deux fois la même empreinte', async () => {
    const first = await sha256Hex(canonicalSerialize((await play()).session.rows));
    const second = await sha256Hex(canonicalSerialize((await play()).session.rows));
    expect(second).toBe(first);
  });

  /**
   * Sans cette vérification, la comparaison serait vide de sens : deux états
   * vides sont égaux, et l'essai passerait en ne prouvant rien.
   */
  it('a réellement écrit, donc la comparaison n’est pas creuse', async () => {
    const { session, store } = await play();
    expect(session.rows.filter(r => r.table === 'footprint')).toHaveLength(3);
    expect(session.rows.filter(r => r.table === 'node')).toHaveLength(2);
    expect(session.rows.filter(r => r.table === 'edge')).toHaveLength(1);
    expect(canUndo(store)).toBe(true);
  });
});

/**
 * E5.2 et E5.3, sur le même chemin : la promesse d'annulation ne vaut que si
 * l'état revient exactement, et qu'elle cesse à la synchronisation.
 */
describe('E5.2 — annuler puis rétablir rend un état identique', () => {
  it('l’annulation retire exactement ce que le geste avait écrit', async () => {
    let session: SessionState = EMPTY_SESSION;
    let store: StoreState = EMPTY_STORE;
    const sink = async (commands: readonly EntityCommand[]): Promise<Outcome<unknown>> => {
      session = await writeToSession(session, commands, async () => ({
        ok: true, value: null, warnings: [],
      }));
      return { ok: true, value: null, warnings: [] };
    };

    ({ state: store } = await dispatch(store, sink, footprintGesture(1, 'B01', [0, 0], [])));
    const afterFirst = session.rows;

    ({ state: store } = await dispatch(store, sink, graphGesture(3)));
    ({ state: store } = await undo(store, sink, T0));
    expect(session.rows).toEqual(afterFirst);

    ({ state: store } = await redo(store, sink, T0));
    expect(session.rows.filter(r => r.table === 'node')).toHaveLength(2);
  });

  it('la pile est vidée à la synchronisation (E5.3)', () => {
    const synced = afterSync({
      undoStack: [{ groupKey: 'g', commands: [] }],
      redoStack: [],
      pending: [],
    });
    expect(canUndo(synced)).toBe(false);
  });
});
