/**
 * E5 + E7.3 — Document commands.
 *
 * Every editing operation becomes a Command carrying the document state
 * before and after it (E5.1). Applying `before` undoes the operation,
 * applying `after` redoes it, so no command needs an inverse routine.
 *
 * Shape identifiers are drawn by the caller, as a uuid, at creation
 * (decisions Q7 and Q10 of `docs/decoupage-s6-edition-simultanee.md`). A
 * command carries the identifiers it creates, so replaying the same
 * commands yields the same ids (invariant 4, E4.4). Deriving them from the
 * document gave two concurrent editors the same identifier.
 */

import type { Command } from './command.js';
import { createCommand } from './command.js';
import type { AlignmentResult } from './alignment.js';
import type { DecorationLayer, DecorationShape } from './scene-objects.js';
import type { DocumentPatch, EditorDocument, ShapeSlot } from './editor-document.js';
import { capturePatch, documentOrder, findShape } from './editor-document.js';
import { translateShape } from './shape-geometry.js';
import { empreinte } from '@azimut/core-model';

// ---------------------------------------------------------------------------
// Command types
// ---------------------------------------------------------------------------

export const CMD_SHAPE_CREATE = 'document.shape.create';
export const CMD_SHAPE_DELETE = 'document.shape.delete';
export const CMD_SHAPE_MOVE = 'document.shape.move';
export const CMD_SHAPE_REORDER = 'document.shape.reorder';
export const CMD_SHAPE_PASTE = 'document.shape.paste';

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

/**
 * Identifier of the default habillage layer of a level (E9.3).
 *
 * A uuid, as `decoration_layer.id` requires (migration 0086), derived from
 * the level rather than drawn: every workstation names the same default
 * layer the same way, so two of them opening a level's habillage at once
 * write one layer, not two (S6.1b). Name-based, in the RFC 9562 version 8
 * layout: the first 128 bits of the level's canonical fingerprint (D7.2,
 * the product's one hashing path), version and variant bits set.
 */
export function defaultLayerId(levelId: string): string {
  const hex = empreinte({ default_decoration_layer_of: levelId }).slice('sha256:'.length, 'sha256:'.length + 32).split('');
  hex[12] = '8';
  hex[16] = ((parseInt(hex[16] ?? '0', 16) & 0x3) | 0x8).toString(16);
  const h = hex.join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
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
