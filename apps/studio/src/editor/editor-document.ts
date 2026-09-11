/**
 * E5 + E9 — Editable document of the habillage layer.
 *
 * The document is the state a Command (E5.1) reads and writes. Without
 * it a command has nothing to apply to and the undo stack is inert.
 *
 * Scope is the site being edited (E5.2): the document holds the layers
 * and shapes of every level, so changing the active level is a view
 * change and never touches the undo stack.
 *
 * The document carries no business attribute (E9.2). Footprints, nodes
 * and edges belong to the business layer and are not stored here.
 */

import type { SelectableItem } from './selection.js';
import type { SceneObject } from './snap-integration.js';
import type { DecorationLayer, DecorationShape } from './scene-objects.js';
import { geometryVertices } from './shape-geometry.js';

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export type EditorDocument = {
  readonly siteId: string;
  /** Decoration layers, one per level by default (E9.3). */
  readonly layers: readonly DecorationLayer[];
  /** Shapes in draw order — index 0 is backmost (E7.3). */
  readonly shapes: readonly DecorationShape[];
};

export function emptyDocument(siteId: string): EditorDocument {
  return { siteId, layers: [], shapes: [] };
}

// ---------------------------------------------------------------------------
// Patch — the before/after payload of a document command
// ---------------------------------------------------------------------------

/**
 * State of one shape within a patch. A null shape means the shape is
 * absent in that state, which is how creation and deletion are
 * expressed without a second command type.
 */
export type ShapeSlot = {
  readonly id: string;
  readonly shape: DecorationShape | null;
};

/**
 * A reversible document state. A command stores one patch as `before`
 * and one as `after`; applying either moves the document to that state,
 * which is what makes every command reversible (E5.1).
 */
export type DocumentPatch = {
  /** Only the shapes the operation touches. */
  readonly slots: readonly ShapeSlot[];
  /** Full draw order in this state. */
  readonly order: readonly string[];
  /** Layers present in this state, so a first shape can bring its layer. */
  readonly layers: readonly DecorationLayer[];
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function documentOrder(doc: EditorDocument): readonly string[] {
  return doc.shapes.map(s => s.id);
}

export function findShape(
  doc: EditorDocument,
  id: string,
): DecorationShape | null {
  return doc.shapes.find(s => s.id === id) ?? null;
}

export function layerOfShape(
  doc: EditorDocument,
  shape: DecorationShape,
): DecorationLayer | null {
  return doc.layers.find(l => l.id === shape.layerId) ?? null;
}

/** Shapes of one level, in draw order. */
export function shapesOfLevel(
  doc: EditorDocument,
  levelId: string,
): readonly DecorationShape[] {
  const levelLayerIds = new Set(
    doc.layers.filter(l => l.levelId === levelId).map(l => l.id),
  );
  return doc.shapes.filter(s => levelLayerIds.has(s.layerId));
}

/** Shapes of one level that are editable — visible and unlocked (E9.3). */
export function editableShapesOfLevel(
  doc: EditorDocument,
  levelId: string,
): readonly DecorationShape[] {
  const editableLayerIds = new Set(
    doc.layers
      .filter(l => l.levelId === levelId && l.visible && !l.locked)
      .map(l => l.id),
  );
  return doc.shapes.filter(s => editableLayerIds.has(s.layerId));
}

/** Snap targets contributed by the habillage layer of a level (E8.1). */
export function levelSceneObjects(
  doc: EditorDocument,
  levelId: string,
): readonly SceneObject[] {
  return shapesOfLevel(doc, levelId).map(s => ({
    id: s.id,
    vertices: geometryVertices(s.geometry),
  }));
}

/** Selectable items of a level, carrying the draw order of E6.1. */
export function levelSelectableItems(
  doc: EditorDocument,
  levelId: string,
): readonly SelectableItem[] {
  const order = new Map(doc.shapes.map((s, i) => [s.id, i]));
  return shapesOfLevel(doc, levelId).map(s => ({
    id: s.id,
    drawOrder: order.get(s.id) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Capture and apply
// ---------------------------------------------------------------------------

/**
 * Capture the current state of the given shapes as a patch. This is the
 * `before` value of a command: applying it restores exactly what the
 * operation is about to change, and nothing else.
 */
export function capturePatch(
  doc: EditorDocument,
  ids: readonly string[],
): DocumentPatch {
  return {
    slots: ids.map(id => ({ id, shape: findShape(doc, id) })),
    order: documentOrder(doc),
    layers: doc.layers,
  };
}

/**
 * Apply a patch. Shapes named by a slot take the slot's value, a null
 * value removing them; every other shape is left untouched. The result
 * is ordered by `order`, with any shape the order omits appended in a
 * deterministic position so a malformed patch cannot reorder the
 * document arbitrarily (invariant 4).
 */
export function applyPatch(
  doc: EditorDocument,
  patch: DocumentPatch,
): EditorDocument {
  const byId = new Map(doc.shapes.map(s => [s.id, s]));

  for (const slot of patch.slots) {
    if (slot.shape === null) {
      byId.delete(slot.id);
    } else {
      byId.set(slot.id, slot.shape);
    }
  }

  const ordered: DecorationShape[] = [];
  const placed = new Set<string>();
  for (const id of patch.order) {
    const shape = byId.get(id);
    if (shape !== undefined && !placed.has(id)) {
      ordered.push(shape);
      placed.add(id);
    }
  }

  const remaining = [...byId.values()]
    .filter(s => !placed.has(s.id))
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    siteId: doc.siteId,
    layers: patch.layers,
    shapes: [...ordered, ...remaining],
  };
}

// ---------------------------------------------------------------------------
// Type guard — history stores commands as `Command<unknown>`
// ---------------------------------------------------------------------------

function isShapeSlot(value: unknown): value is ShapeSlot {
  if (typeof value !== 'object' || value === null) return false;
  const slot: Record<string, unknown> = { ...value };
  return typeof slot['id'] === 'string' && 'shape' in slot;
}

/**
 * Narrow an unknown command payload to a document patch.
 * Commands leave the history stack typed as `unknown` (E5.1 requires
 * them to be plain serializable objects), so the payload is checked
 * rather than asserted.
 */
export function isDocumentPatch(value: unknown): value is DocumentPatch {
  if (typeof value !== 'object' || value === null) return false;
  const patch: Record<string, unknown> = { ...value };
  const { slots, order, layers } = patch;
  if (!Array.isArray(slots) || !Array.isArray(order) || !Array.isArray(layers)) {
    return false;
  }
  return slots.every(isShapeSlot) && order.every(id => typeof id === 'string');
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export type DocumentAction =
  | { readonly type: 'apply'; readonly patch: DocumentPatch }
  | { readonly type: 'reset'; readonly document: EditorDocument };

export function documentReducer(
  state: EditorDocument,
  action: DocumentAction,
): EditorDocument {
  switch (action.type) {
    case 'apply':
      return applyPatch(state, action.patch);
    case 'reset':
      return action.document;
  }
}
