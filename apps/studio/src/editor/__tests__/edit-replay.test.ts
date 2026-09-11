/**
 * E4.4 — Mandatory test.
 *
 * "Rejouer une séquence enregistrée d'opérations d'édition sur un site
 * de référence, deux fois, et vérifier l'égalité stricte de l'état
 * final et des empreintes de rendu."
 *
 * The sequence below is replayed from an empty document twice, and the
 * two final states are compared field by field and through a canonical
 * serialization, which is what the render fingerprint is computed from.
 */

import { describe, it, expect } from 'vitest';
import { canonicalSerialize, sha256Hex } from '@azimut/core-model';
import type { Command, HistoryState } from '../command.js';
import { historyReducer, EMPTY_HISTORY } from '../command.js';
import { computeAlignment, computeDistribution, computeZOrder } from '../alignment.js';
import type { AlignAxis, DistributeAxis, ZOrderOp } from '../alignment.js';
import type { ShapeCommandData } from '../command-integration.js';
import type { DecorationShape } from '../scene-objects.js';
import { DEFAULT_DECORATION_STYLE } from '../scene-objects.js';
import type { DocumentPatch, EditorDocument } from '../editor-document.js';
import {
  applyPatch,
  documentOrder,
  emptyDocument,
  findShape,
  isDocumentPatch,
} from '../editor-document.js';
import {
  createShapesCommand,
  defaultLayer,
  deleteShapesCommand,
  moveShapesCommand,
  nextShapeId,
  reorderShapesCommand,
} from '../document-commands.js';
import { geometryFromCommandData, kindForGeometry, shapeBounds } from '../shape-geometry.js';

// ---------------------------------------------------------------------------
// Recorded sequence
// ---------------------------------------------------------------------------

type Operation =
  | { readonly op: 'draw'; readonly data: ShapeCommandData }
  | { readonly op: 'align'; readonly ids: readonly string[]; readonly axis: AlignAxis }
  | { readonly op: 'distribute'; readonly ids: readonly string[]; readonly axis: DistributeAxis }
  | { readonly op: 'zorder'; readonly ids: readonly string[]; readonly z: ZOrderOp }
  | { readonly op: 'delete'; readonly ids: readonly string[] }
  | { readonly op: 'undo' }
  | { readonly op: 'redo' };

const ORG = 'org-ref';
const SITE = 'site-ref';
const LEVEL = 'level-ref';
const LAYER = defaultLayer(ORG, SITE, LEVEL);

const SEQUENCE: readonly Operation[] = [
  // Four shapes drawn with coordinates that do not fall on the
  // millimetre grid, so quantization is exercised (E4.2).
  { op: 'draw', data: { kind: 'rect', origin: { x_m: 0.00049, y_m: 0.0 }, corner: { x_m: 2.12345, y_m: 1.98765 } } },
  { op: 'draw', data: { kind: 'rect', origin: { x_m: 4.5, y_m: 3.33333 }, corner: { x_m: 6.75, y_m: 4.66666 } } },
  { op: 'draw', data: { kind: 'ellipse', center: { x_m: 9.87654, y_m: 1.11111 }, rx_m: 1.5, ry_m: 0.75 } },
  { op: 'draw', data: { kind: 'polygon', center: { x_m: 13.3, y_m: 2.7 }, radius_m: 1.234, sides: 7, rotation_deg: 17.456 } },
  { op: 'draw', data: { kind: 'polyline', points: [{ x_m: 0.1, y_m: 5.0 }, { x_m: 3.9, y_m: 5.4 }, { x_m: 7.2, y_m: 4.1 }] } },
  // A measurement, which persists nothing.
  { op: 'draw', data: { kind: 'measure', from: { x_m: 0, y_m: 0 }, to: { x_m: 5, y_m: 5 } } },
  // Set operations over the shapes drawn above.
  { op: 'align', ids: ['dec-1', 'dec-2', 'dec-3'], axis: 'top' },
  { op: 'distribute', ids: ['dec-1', 'dec-2', 'dec-3', 'dec-4'], axis: 'horizontal' },
  { op: 'zorder', ids: ['dec-1'], z: 'bring_front' },
  { op: 'zorder', ids: ['dec-5'], z: 'send_backward' },
  { op: 'delete', ids: ['dec-2'] },
  // Undo past two operations, then redo one: the stacks must land in a
  // state that is itself reproducible.
  { op: 'undo' },
  { op: 'undo' },
  { op: 'redo' },
  { op: 'align', ids: ['dec-3', 'dec-4'], axis: 'left' },
];

// ---------------------------------------------------------------------------
// Replay harness
// ---------------------------------------------------------------------------

type ReplayState = {
  readonly document: EditorDocument;
  readonly history: HistoryState;
};

/** Timestamps are supplied by the caller, never read inside a command (E5.1). */
function timestampAt(index: number): string {
  return `2026-03-0${String((index % 9) + 1)}T00:00:00.000Z`;
}

function boundsOf(
  doc: EditorDocument,
  ids: readonly string[],
): readonly NonNullable<ReturnType<typeof shapeBounds>>[] {
  const result: NonNullable<ReturnType<typeof shapeBounds>>[] = [];
  for (const id of ids) {
    const shape = findShape(doc, id);
    if (shape === null) continue;
    const bounds = shapeBounds(shape);
    if (bounds !== null) result.push(bounds);
  }
  return result;
}

function execute(
  state: ReplayState,
  command: Command<DocumentPatch> | null,
): ReplayState {
  if (command === null) return state;
  return {
    document: applyPatch(state.document, command.after),
    history: historyReducer(state.history, { type: 'execute', command }),
  };
}

function drawShape(
  state: ReplayState,
  data: ShapeCommandData,
  timestamp: string,
): ReplayState {
  const geometry = geometryFromCommandData(data);
  if (geometry === null) return state;

  const shape: DecorationShape = {
    id: nextShapeId(state.document),
    orgId: ORG,
    layerId: LAYER.id,
    kind: kindForGeometry(geometry),
    geometry,
    styleRole: null,
    style: DEFAULT_DECORATION_STYLE,
    label: '',
    rotation_deg: 0,
  };

  return execute(state, createShapesCommand(state.document, [shape], LAYER, timestamp));
}

function undo(state: ReplayState): ReplayState {
  const entry = state.history.undoStack[state.history.undoStack.length - 1];
  if (entry === undefined || !isDocumentPatch(entry.before)) return state;
  return {
    document: applyPatch(state.document, entry.before),
    history: historyReducer(state.history, { type: 'undo' }),
  };
}

function redo(state: ReplayState): ReplayState {
  const entry = state.history.redoStack[state.history.redoStack.length - 1];
  if (entry === undefined || !isDocumentPatch(entry.after)) return state;
  return {
    document: applyPatch(state.document, entry.after),
    history: historyReducer(state.history, { type: 'redo' }),
  };
}

function step(state: ReplayState, operation: Operation, index: number): ReplayState {
  const ts = timestampAt(index);
  const doc = state.document;

  switch (operation.op) {
    case 'draw':
      return drawShape(state, operation.data, ts);
    case 'align':
      return execute(state, moveShapesCommand(
        doc, computeAlignment(boundsOf(doc, operation.ids), operation.axis), ts,
      ));
    case 'distribute':
      return execute(state, moveShapesCommand(
        doc, computeDistribution(boundsOf(doc, operation.ids), operation.axis), ts,
      ));
    case 'zorder':
      return execute(state, reorderShapesCommand(
        doc, computeZOrder(documentOrder(doc), operation.ids, operation.z), ts,
      ));
    case 'delete':
      return execute(state, deleteShapesCommand(doc, operation.ids, ts));
    case 'undo':
      return undo(state);
    case 'redo':
      return redo(state);
  }
}

function replay(sequence: readonly Operation[]): ReplayState {
  let state: ReplayState = {
    document: emptyDocument(SITE),
    history: EMPTY_HISTORY,
  };
  sequence.forEach((operation, index) => {
    state = step(state, operation, index);
  });
  return state;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('E4.4 — replaying an edit sequence is deterministic', () => {
  it('produces the same final document twice', () => {
    expect(replay(SEQUENCE).document).toEqual(replay(SEQUENCE).document);
  });

  it('produces the same undo and redo stacks twice', () => {
    expect(replay(SEQUENCE).history).toEqual(replay(SEQUENCE).history);
  });

  it('produces byte-identical serializations (invariant 4)', () => {
    const a = canonicalSerialize(replay(SEQUENCE).document);
    const b = canonicalSerialize(replay(SEQUENCE).document);
    expect(a).toBe(b);
  });

  it('produces the same fingerprint twice', async () => {
    const a = await sha256Hex(canonicalSerialize(replay(SEQUENCE).document));
    const b = await sha256Hex(canonicalSerialize(replay(SEQUENCE).document));
    expect(a).toBe(b);
  });

  it('actually changed the document, so the comparison is not vacuous', () => {
    const final = replay(SEQUENCE).document;
    expect(final.shapes.length).toBeGreaterThan(0);
    expect(final.layers).toEqual([LAYER]);
  });

  it('quantizes every stored coordinate to the millimetre (E4.2)', () => {
    for (const shape of replay(SEQUENCE).document.shapes) {
      const bounds = shapeBounds(shape);
      if (bounds === null) continue;
      for (const value of [bounds.minX_m, bounds.minY_m, bounds.maxX_m, bounds.maxY_m]) {
        expect(Math.abs(value * 1000 - Math.round(value * 1000))).toBeLessThan(1e-6);
      }
    }
  });

  it('persists nothing for the measurement in the sequence', () => {
    const drawn = SEQUENCE.filter(o => o.op === 'draw').length;
    // Six draw operations, one of which is a measurement.
    expect(drawn).toBe(6);
    expect(replay(SEQUENCE).document.shapes.length).toBeLessThan(drawn);
  });

  it('undoes back to an earlier state exactly', () => {
    const upTo = (count: number): EditorDocument => replay(SEQUENCE.slice(0, count)).document;
    const before = upTo(5);
    const withDelete = replay([...SEQUENCE.slice(0, 5), { op: 'delete', ids: ['dec-2'] }]);
    const undone = undo(withDelete);
    expect(undone.document).toEqual(before);
  });
});
