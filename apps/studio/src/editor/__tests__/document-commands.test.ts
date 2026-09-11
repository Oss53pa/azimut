import { describe, it, expect } from 'vitest';
import type { DecorationShape } from '../scene-objects.js';
import { DEFAULT_DECORATION_STYLE } from '../scene-objects.js';
import type { EditorDocument } from '../editor-document.js';
import { applyPatch, documentOrder, emptyDocument, findShape } from '../editor-document.js';
import {
  CMD_SHAPE_CREATE,
  CMD_SHAPE_DELETE,
  CMD_SHAPE_MOVE,
  CMD_SHAPE_REORDER,
  createShapesCommand,
  defaultLayer,
  defaultLayerId,
  deleteShapesCommand,
  moveShapesCommand,
  nextShapeId,
  reorderShapesCommand,
} from '../document-commands.js';

const TS = '2026-01-01T00:00:00Z';
const LAYER = defaultLayer('org-1', 'site-1', 'level-0');

function shape(id: string, x: number): DecorationShape {
  return {
    id, orgId: 'org-1', layerId: LAYER.id,
    kind: 'area',
    geometry: { type: 'rectangle', origin: { x_m: x, y_m: 0 }, width_m: 1, height_m: 1 },
    styleRole: null,
    style: DEFAULT_DECORATION_STYLE,
    label: '',
    rotation_deg: 0,
  };
}

function docWith(shapes: readonly DecorationShape[]): EditorDocument {
  return { siteId: 'site-1', layers: [LAYER], shapes };
}

describe('E5 — document commands', () => {
  describe('identifier derivation', () => {
    it('starts at one on an empty document', () => {
      expect(nextShapeId(emptyDocument('site-1'))).toBe('dec-1');
    });

    it('continues past the highest existing identifier', () => {
      expect(nextShapeId(docWith([shape('dec-1', 0), shape('dec-7', 1)]))).toBe('dec-8');
    });

    it('ignores identifiers that do not follow the scheme', () => {
      expect(nextShapeId(docWith([shape('imported-x', 0)]))).toBe('dec-1');
    });

    it('offsets so a multi-shape paste gets distinct identifiers', () => {
      const doc = docWith([shape('dec-3', 0)]);
      expect([0, 1, 2].map(i => nextShapeId(doc, i)))
        .toEqual(['dec-4', 'dec-5', 'dec-6']);
    });

    it('is derived from the document, never from a clock or a random source', () => {
      const doc = docWith([shape('dec-2', 0)]);
      expect(nextShapeId(doc)).toBe(nextShapeId(doc));
    });
  });

  describe('defaultLayer (E9.3)', () => {
    it('is visible, printable and unlocked', () => {
      expect(LAYER.visible).toBe(true);
      expect(LAYER.printVisible).toBe(true);
      expect(LAYER.locked).toBe(false);
    });

    it('derives its id from the level, so a level has exactly one', () => {
      expect(LAYER.id).toBe(defaultLayerId('level-0'));
      expect(defaultLayerId('level-1')).not.toBe(LAYER.id);
    });
  });

  describe('createShapesCommand', () => {
    it('adds the shape on top of the draw order', () => {
      const doc = docWith([shape('dec-1', 0)]);
      const cmd = createShapesCommand(doc, [shape('dec-2', 5)], LAYER, TS);
      expect(cmd).not.toBeNull();
      if (cmd === null) return;
      expect(cmd.type).toBe(CMD_SHAPE_CREATE);
      expect(cmd.targetId).toBe('site-1');
      expect(cmd.timestamp).toBe(TS);
      expect(applyPatch(doc, cmd.after).shapes.map(s => s.id)).toEqual(['dec-1', 'dec-2']);
    });

    it('is reversed by its own before-state', () => {
      const doc = docWith([]);
      const cmd = createShapesCommand(doc, [shape('dec-1', 0)], LAYER, TS);
      if (cmd === null) throw new Error('command expected');
      const created = applyPatch(doc, cmd.after);
      expect(applyPatch(created, cmd.before).shapes).toEqual([]);
    });

    it('brings the layer into the document with the first shape', () => {
      const doc = emptyDocument('site-1');
      const cmd = createShapesCommand(doc, [shape('dec-1', 0)], LAYER, TS);
      if (cmd === null) throw new Error('command expected');
      expect(applyPatch(doc, cmd.after).layers).toEqual([LAYER]);
    });

    it('does not duplicate a layer already present', () => {
      const doc = docWith([shape('dec-1', 0)]);
      const cmd = createShapesCommand(doc, [shape('dec-2', 0)], LAYER, TS);
      if (cmd === null) throw new Error('command expected');
      expect(applyPatch(doc, cmd.after).layers).toHaveLength(1);
    });

    it('produces no command for an empty set', () => {
      expect(createShapesCommand(docWith([]), [], LAYER, TS)).toBeNull();
    });
  });

  describe('deleteShapesCommand', () => {
    it('removes the named shapes from the order', () => {
      const doc = docWith([shape('dec-1', 0), shape('dec-2', 2)]);
      const cmd = deleteShapesCommand(doc, ['dec-1'], TS);
      if (cmd === null) throw new Error('command expected');
      expect(cmd.type).toBe(CMD_SHAPE_DELETE);
      expect(applyPatch(doc, cmd.after).shapes.map(s => s.id)).toEqual(['dec-2']);
    });

    it('restores the deleted shape in its original place on undo', () => {
      const doc = docWith([shape('dec-1', 0), shape('dec-2', 2), shape('dec-3', 4)]);
      const cmd = deleteShapesCommand(doc, ['dec-2'], TS);
      if (cmd === null) throw new Error('command expected');
      const deleted = applyPatch(doc, cmd.after);
      expect(applyPatch(deleted, cmd.before)).toEqual(doc);
    });

    it('ignores ids that are not in the document', () => {
      const doc = docWith([shape('dec-1', 0)]);
      const cmd = deleteShapesCommand(doc, ['dec-1', 'absent'], TS);
      if (cmd === null) throw new Error('command expected');
      expect(cmd.before.slots.map(s => s.id)).toEqual(['dec-1']);
    });

    it('produces no command when nothing named exists', () => {
      expect(deleteShapesCommand(docWith([]), ['absent'], TS)).toBeNull();
    });
  });

  describe('moveShapesCommand', () => {
    it('translates the named shapes', () => {
      const doc = docWith([shape('dec-1', 0)]);
      const cmd = moveShapesCommand(doc, [{ id: 'dec-1', dx_m: 3, dy_m: 0 }], TS);
      if (cmd === null) throw new Error('command expected');
      expect(cmd.type).toBe(CMD_SHAPE_MOVE);
      const moved = findShape(applyPatch(doc, cmd.after), 'dec-1');
      expect(moved?.geometry).toEqual({
        type: 'rectangle', origin: { x_m: 3, y_m: 0 }, width_m: 1, height_m: 1,
      });
    });

    it('restores the original position on undo', () => {
      const doc = docWith([shape('dec-1', 0)]);
      const cmd = moveShapesCommand(doc, [{ id: 'dec-1', dx_m: 1.5, dy_m: -2 }], TS);
      if (cmd === null) throw new Error('command expected');
      expect(applyPatch(applyPatch(doc, cmd.after), cmd.before)).toEqual(doc);
    });

    it('drops deltas that move nothing', () => {
      const doc = docWith([shape('dec-1', 0), shape('dec-2', 2)]);
      const cmd = moveShapesCommand(doc, [
        { id: 'dec-1', dx_m: 0, dy_m: 0 },
        { id: 'dec-2', dx_m: 1, dy_m: 0 },
      ], TS);
      if (cmd === null) throw new Error('command expected');
      expect(cmd.after.slots.map(s => s.id)).toEqual(['dec-2']);
    });

    it('produces no command when no shape actually moves', () => {
      const doc = docWith([shape('dec-1', 0)]);
      expect(moveShapesCommand(doc, [{ id: 'dec-1', dx_m: 0, dy_m: 0 }], TS)).toBeNull();
    });

    it('carries a group key so a continuous gesture coalesces (E5.2)', () => {
      const doc = docWith([shape('dec-1', 0)]);
      const cmd = moveShapesCommand(doc, [{ id: 'dec-1', dx_m: 1, dy_m: 0 }], TS, 'drag-1');
      expect(cmd?.groupKey).toBe('drag-1');
    });

    it('leaves the group key null when none is given', () => {
      const doc = docWith([shape('dec-1', 0)]);
      const cmd = moveShapesCommand(doc, [{ id: 'dec-1', dx_m: 1, dy_m: 0 }], TS);
      expect(cmd?.groupKey).toBeNull();
    });
  });

  describe('reorderShapesCommand', () => {
    it('sets the new order without touching a shape', () => {
      const doc = docWith([shape('dec-1', 0), shape('dec-2', 2)]);
      const cmd = reorderShapesCommand(doc, ['dec-2', 'dec-1'], TS);
      if (cmd === null) throw new Error('command expected');
      expect(cmd.type).toBe(CMD_SHAPE_REORDER);
      expect(cmd.after.slots).toEqual([]);
      expect(applyPatch(doc, cmd.after).shapes.map(s => s.id)).toEqual(['dec-2', 'dec-1']);
    });

    it('restores the previous order on undo', () => {
      const doc = docWith([shape('dec-1', 0), shape('dec-2', 2)]);
      const cmd = reorderShapesCommand(doc, ['dec-2', 'dec-1'], TS);
      if (cmd === null) throw new Error('command expected');
      expect(applyPatch(applyPatch(doc, cmd.after), cmd.before)).toEqual(doc);
    });

    it('produces no command when the order is unchanged', () => {
      const doc = docWith([shape('dec-1', 0), shape('dec-2', 2)]);
      expect(reorderShapesCommand(doc, documentOrder(doc), TS)).toBeNull();
    });
  });
});
