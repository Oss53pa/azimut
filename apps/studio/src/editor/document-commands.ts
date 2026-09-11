/**
 * E5 + E7.3 — Document commands.
 *
 * Every editing operation becomes a Command carrying the document state
 * before and after it (E5.1). Applying `before` undoes the operation,
 * applying `after` redoes it, so no command needs an inverse routine.
 *
 * Identifiers are derived from the document itself, never from a clock
 * or a random source, so replaying the same operations on the same
 * document yields the same ids (invariant 4, E4.4).
 */

import type { Command } from './command.js';
import { createCommand } from './command.js';
import type { AlignmentResult } from './alignment.js';
import type { DecorationLayer, DecorationShape } from './scene-objects.js';
import type { DocumentPatch, EditorDocument, ShapeSlot } from './editor-document.js';
import { capturePatch, documentOrder, findShape } from './editor-document.js';
import { translateShape } from './shape-geometry.js';

// ---------------------------------------------------------------------------
// Command types
// ---------------------------------------------------------------------------

export const CMD_SHAPE_CREATE = 'document.shape.create';
export const CMD_SHAPE_DELETE = 'document.shape.delete';
export const CMD_SHAPE_MOVE = 'document.shape.move';
export const CMD_SHAPE_REORDER = 'document.shape.reorder';
export const CMD_SHAPE_PASTE = 'document.shape.paste';

// ---------------------------------------------------------------------------
// Identifier derivation
// ---------------------------------------------------------------------------

const SHAPE_ID_PREFIX = 'dec-';

/**
 * Next shape identifier, derived from the identifiers already present.
 * Deterministic: the same document always yields the same next id.
 */
export function nextShapeId(doc: EditorDocument, offset = 0): string {
  let highest = 0;
  for (const shape of doc.shapes) {
    if (!shape.id.startsWith(SHAPE_ID_PREFIX)) continue;
    const suffix = Number.parseInt(shape.id.slice(SHAPE_ID_PREFIX.length), 10);
    if (Number.isInteger(suffix) && suffix > highest) highest = suffix;
  }
  return `${SHAPE_ID_PREFIX}${String(highest + offset + 1)}`;
}

/** Identifier of the default habillage layer of a level (E9.3). */
export function defaultLayerId(levelId: string): string {
  return `layer-default-${levelId}`;
}

/**
 * The default layer of a level, created on first use so that an empty
 * site carries no layer row it never needed.
 */
export function defaultLayer(
  orgId: string,
  siteId: string,
  levelId: string,
): DecorationLayer {
  return {
    id: defaultLayerId(levelId),
    orgId,
    siteId,
    levelId,
    name: 'Habillage',
    zOrder: 0,
    visible: true,
    printVisible: true,
    locked: false,
  };
}

function withLayer(
  layers: readonly DecorationLayer[],
  layer: DecorationLayer,
): readonly DecorationLayer[] {
  return layers.some(l => l.id === layer.id) ? layers : [...layers, layer];
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

/**
 * Command adding shapes on top of the draw order, bringing their layer
 * into the document if it is not there yet.
 */
export function createShapesCommand(
  doc: EditorDocument,
  shapes: readonly DecorationShape[],
  layer: DecorationLayer,
  timestamp: string,
  type: string = CMD_SHAPE_CREATE,
): Command<DocumentPatch> | null {
  if (shapes.length === 0) return null;

  const ids = shapes.map(s => s.id);
  const before = capturePatch(doc, ids);
  const after: DocumentPatch = {
    slots: shapes.map((shape): ShapeSlot => ({ id: shape.id, shape })),
    order: [...documentOrder(doc), ...ids],
    layers: withLayer(doc.layers, layer),
  };

  return createCommand<DocumentPatch>(type, doc.siteId, before, after, timestamp);
}

// ---------------------------------------------------------------------------
// Deletion
// ---------------------------------------------------------------------------

/** Command removing the named shapes. */
export function deleteShapesCommand(
  doc: EditorDocument,
  ids: readonly string[],
  timestamp: string,
): Command<DocumentPatch> | null {
  const present = ids.filter(id => findShape(doc, id) !== null);
  if (present.length === 0) return null;

  const removed = new Set(present);
  const before = capturePatch(doc, present);
  const after: DocumentPatch = {
    slots: present.map((id): ShapeSlot => ({ id, shape: null })),
    order: documentOrder(doc).filter(id => !removed.has(id)),
    layers: doc.layers,
  };

  return createCommand<DocumentPatch>(
    CMD_SHAPE_DELETE, doc.siteId, before, after, timestamp,
  );
}

// ---------------------------------------------------------------------------
// Movement — alignment, distribution, nudge
// ---------------------------------------------------------------------------

/**
 * Command translating shapes by per-shape deltas.
 *
 * `groupKey` lets a continuous gesture coalesce into a single undo
 * entry (E5.2). Deltas that move nothing are dropped, so an alignment
 * that changes no position produces no command at all.
 */
export function moveShapesCommand(
  doc: EditorDocument,
  deltas: readonly AlignmentResult[],
  timestamp: string,
  groupKey?: string,
): Command<DocumentPatch> | null {
  const moved: ShapeSlot[] = [];

  for (const delta of deltas) {
    if (delta.dx_m === 0 && delta.dy_m === 0) continue;
    const shape = findShape(doc, delta.id);
    if (shape === null) continue;
    moved.push({ id: shape.id, shape: translateShape(shape, delta.dx_m, delta.dy_m) });
  }

  if (moved.length === 0) return null;

  const before = capturePatch(doc, moved.map(s => s.id));
  const after: DocumentPatch = {
    slots: moved,
    order: documentOrder(doc),
    layers: doc.layers,
  };

  return createCommand<DocumentPatch>(
    CMD_SHAPE_MOVE, doc.siteId, before, after, timestamp, groupKey,
  );
}

// ---------------------------------------------------------------------------
// Draw order
// ---------------------------------------------------------------------------

/**
 * Command setting a new draw order. Touches no shape, only the order,
 * so its patch carries no slot.
 */
export function reorderShapesCommand(
  doc: EditorDocument,
  order: readonly string[],
  timestamp: string,
): Command<DocumentPatch> | null {
  const current = documentOrder(doc);
  if (order.length === current.length && order.every((id, i) => id === current[i])) {
    return null;
  }

  const before: DocumentPatch = { slots: [], order: current, layers: doc.layers };
  const after: DocumentPatch = { slots: [], order, layers: doc.layers };

  return createCommand<DocumentPatch>(
    CMD_SHAPE_REORDER, doc.siteId, before, after, timestamp,
  );
}
