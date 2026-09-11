import { describe, it, expect } from 'vitest';
import type { DecorationLayer, DecorationShape } from '../scene-objects.js';
import { DEFAULT_DECORATION_STYLE } from '../scene-objects.js';
import type { EditorDocument } from '../editor-document.js';
import {
  applyPatch,
  capturePatch,
  documentOrder,
  documentReducer,
  editableShapesOfLevel,
  emptyDocument,
  findShape,
  isDocumentPatch,
  layerOfShape,
  levelSceneObjects,
  levelSelectableItems,
  shapesOfLevel,
} from '../editor-document.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function layer(id: string, levelId: string, over: Partial<DecorationLayer> = {}): DecorationLayer {
  return {
    id, orgId: 'org-1', siteId: 'site-1', levelId,
    name: id, zOrder: 0, visible: true, printVisible: true, locked: false,
    ...over,
  };
}

function shape(id: string, layerId: string, x: number): DecorationShape {
  return {
    id, orgId: 'org-1', layerId,
    kind: 'area',
    geometry: { type: 'rectangle', origin: { x_m: x, y_m: 0 }, width_m: 1, height_m: 1 },
    styleRole: null,
    style: DEFAULT_DECORATION_STYLE,
    label: '',
    rotation_deg: 0,
  };
}

const L0 = layer('layer-0', 'level-0');
const L1 = layer('layer-1', 'level-1');

function docWith(shapes: readonly DecorationShape[]): EditorDocument {
  return { siteId: 'site-1', layers: [L0, L1], shapes };
}

const A = shape('dec-1', 'layer-0', 0);
const B = shape('dec-2', 'layer-0', 2);
const C = shape('dec-3', 'layer-1', 4);

describe('E5+E9 — editor document', () => {
  describe('queries', () => {
    it('starts empty', () => {
      const doc = emptyDocument('site-1');
      expect(doc.shapes).toHaveLength(0);
      expect(doc.layers).toHaveLength(0);
      expect(documentOrder(doc)).toEqual([]);
    });

    it('finds a shape by id, and reports absence as null', () => {
      const doc = docWith([A, B]);
      expect(findShape(doc, 'dec-2')).toBe(B);
      expect(findShape(doc, 'absent')).toBeNull();
    });

    it('resolves the layer of a shape', () => {
      expect(layerOfShape(docWith([A]), A)).toBe(L0);
      expect(layerOfShape(emptyDocument('site-1'), A)).toBeNull();
    });

    it('filters shapes by level through their layer', () => {
      const doc = docWith([A, B, C]);
      expect(shapesOfLevel(doc, 'level-0').map(s => s.id)).toEqual(['dec-1', 'dec-2']);
      expect(shapesOfLevel(doc, 'level-1').map(s => s.id)).toEqual(['dec-3']);
    });

    it('excludes locked and hidden layers from the editable set (E9.3)', () => {
      const locked = layer('layer-locked', 'level-0', { locked: true });
      const hidden = layer('layer-hidden', 'level-0', { visible: false });
      const doc: EditorDocument = {
        siteId: 'site-1',
        layers: [L0, locked, hidden],
        shapes: [A, shape('dec-9', 'layer-locked', 9), shape('dec-8', 'layer-hidden', 8)],
      };
      expect(editableShapesOfLevel(doc, 'level-0').map(s => s.id)).toEqual(['dec-1']);
      expect(shapesOfLevel(doc, 'level-0')).toHaveLength(3);
    });

    it('offers the vertices of each shape as snap targets (E8.1)', () => {
      const objects = levelSceneObjects(docWith([A]), 'level-0');
      expect(objects).toHaveLength(1);
      expect(objects[0]?.id).toBe('dec-1');
      expect(objects[0]?.vertices).toHaveLength(4);
    });

    it('reports draw order on selectable items (E6.1)', () => {
      const items = levelSelectableItems(docWith([A, B]), 'level-0');
      expect(items).toEqual([
        { id: 'dec-1', drawOrder: 0 },
        { id: 'dec-2', drawOrder: 1 },
      ]);
    });
  });

  describe('capturePatch / applyPatch', () => {
    it('captures absent shapes as null slots', () => {
      const patch = capturePatch(emptyDocument('site-1'), ['dec-1']);
      expect(patch.slots).toEqual([{ id: 'dec-1', shape: null }]);
    });

    it('adds a shape and places it in the given order', () => {
      const doc = docWith([A]);
      const next = applyPatch(doc, {
        slots: [{ id: 'dec-2', shape: B }],
        order: ['dec-1', 'dec-2'],
        layers: doc.layers,
      });
      expect(next.shapes.map(s => s.id)).toEqual(['dec-1', 'dec-2']);
    });

    it('removes a shape on a null slot', () => {
      const doc = docWith([A, B]);
      const next = applyPatch(doc, {
        slots: [{ id: 'dec-1', shape: null }],
        order: ['dec-2'],
        layers: doc.layers,
      });
      expect(next.shapes.map(s => s.id)).toEqual(['dec-2']);
    });

    it('leaves shapes the patch does not name untouched', () => {
      const doc = docWith([A, B]);
      const next = applyPatch(doc, {
        slots: [{ id: 'dec-1', shape: shape('dec-1', 'layer-0', 99) }],
        order: ['dec-1', 'dec-2'],
        layers: doc.layers,
      });
      expect(next.shapes[1]).toBe(B);
    });

    it('reorders without touching any shape', () => {
      const doc = docWith([A, B]);
      const next = applyPatch(doc, {
        slots: [],
        order: ['dec-2', 'dec-1'],
        layers: doc.layers,
      });
      expect(next.shapes.map(s => s.id)).toEqual(['dec-2', 'dec-1']);
    });

    it('appends shapes the order omits, sorted by id, rather than dropping them', () => {
      const doc = docWith([A, B]);
      const next = applyPatch(doc, { slots: [], order: [], layers: doc.layers });
      expect(next.shapes.map(s => s.id)).toEqual(['dec-1', 'dec-2']);
    });

    it('ignores a duplicate id in the order', () => {
      const doc = docWith([A, B]);
      const next = applyPatch(doc, {
        slots: [],
        order: ['dec-1', 'dec-1', 'dec-2'],
        layers: doc.layers,
      });
      expect(next.shapes.map(s => s.id)).toEqual(['dec-1', 'dec-2']);
    });

    it('restores the exact previous state, which is what makes a command reversible (E5.1)', () => {
      const doc = docWith([A, B]);
      const before = capturePatch(doc, ['dec-1']);
      const modified = applyPatch(doc, {
        slots: [{ id: 'dec-1', shape: shape('dec-1', 'layer-0', 42) }],
        order: documentOrder(doc),
        layers: doc.layers,
      });
      expect(applyPatch(modified, before)).toEqual(doc);
    });
  });

  describe('isDocumentPatch', () => {
    it('accepts a well-formed patch', () => {
      expect(isDocumentPatch({ slots: [], order: ['a'], layers: [] })).toBe(true);
      expect(isDocumentPatch({
        slots: [{ id: 'a', shape: null }], order: [], layers: [],
      })).toBe(true);
    });

    it('rejects payloads that are not patches', () => {
      expect(isDocumentPatch(null)).toBe(false);
      expect(isDocumentPatch('patch')).toBe(false);
      expect(isDocumentPatch({})).toBe(false);
      expect(isDocumentPatch({ slots: [], order: [] })).toBe(false);
      expect(isDocumentPatch({ slots: {}, order: [], layers: [] })).toBe(false);
      expect(isDocumentPatch({ slots: [{ id: 1 }], order: [], layers: [] })).toBe(false);
      expect(isDocumentPatch({ slots: [{ id: 'a' }], order: [], layers: [] })).toBe(false);
      expect(isDocumentPatch({ slots: [], order: [7], layers: [] })).toBe(false);
    });
  });

  describe('reducer', () => {
    it('applies a patch', () => {
      const doc = docWith([]);
      const next = documentReducer(doc, {
        type: 'apply',
        patch: { slots: [{ id: 'dec-1', shape: A }], order: ['dec-1'], layers: doc.layers },
      });
      expect(next.shapes).toEqual([A]);
    });

    it('replaces the whole document on reset', () => {
      const replacement = docWith([C]);
      expect(documentReducer(docWith([A]), { type: 'reset', document: replacement }))
        .toBe(replacement);
    });
  });
});
