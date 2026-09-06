import { describe, it, expect } from 'vitest';
import {
  sortLayers,
  editableShapes,
  visibleShapes,
  printableShapes,
} from '../scene-objects.js';
import type {
  DecorationLayer,
  DecorationShape,
  DecorationStyle,
} from '../scene-objects.js';

const defaultStyle: DecorationStyle = {
  fillRole: null,
  strokeRole: null,
  strokeWidth_m: 0.01,
  opacity: 1,
};

function layer(id: string, overrides: Partial<DecorationLayer> = {}): DecorationLayer {
  return {
    id,
    orgId: 'org-1',
    siteId: 'site-1',
    levelId: 'level-1',
    name: `Layer ${id}`,
    zOrder: 0,
    visible: true,
    printVisible: true,
    locked: false,
    ...overrides,
  };
}

function shape(id: string, layerId: string): DecorationShape {
  return {
    id,
    orgId: 'org-1',
    layerId,
    kind: 'area',
    geometry: { type: 'rectangle', origin: { x_m: 0, y_m: 0 }, width_m: 1, height_m: 1 },
    styleRole: null,
    style: defaultStyle,
    label: '',
    rotation_deg: 0,
  };
}

describe('E9 — scene objects', () => {
  describe('sortLayers', () => {
    it('sorts by z-order ascending', () => {
      const layers = [layer('c', { zOrder: 3 }), layer('a', { zOrder: 1 }), layer('b', { zOrder: 2 })];
      const sorted = sortLayers(layers);
      expect(sorted.map(l => l.id)).toStrictEqual(['a', 'b', 'c']);
    });

    it('breaks ties deterministically by id', () => {
      const layers = [layer('beta', { zOrder: 1 }), layer('alpha', { zOrder: 1 })];
      const sorted = sortLayers(layers);
      expect(sorted.map(l => l.id)).toStrictEqual(['alpha', 'beta']);
    });

    it('does not mutate original array', () => {
      const layers = [layer('b', { zOrder: 2 }), layer('a', { zOrder: 1 })];
      const original = [...layers];
      sortLayers(layers);
      expect(layers).toStrictEqual(original);
    });
  });

  describe('editableShapes', () => {
    it('includes shapes on visible, unlocked layers', () => {
      const layers = [layer('l1')];
      const shapes = [shape('s1', 'l1')];
      expect(editableShapes(shapes, layers)).toHaveLength(1);
    });

    it('excludes shapes on locked layers', () => {
      const layers = [layer('l1', { locked: true })];
      const shapes = [shape('s1', 'l1')];
      expect(editableShapes(shapes, layers)).toHaveLength(0);
    });

    it('excludes shapes on hidden layers', () => {
      const layers = [layer('l1', { visible: false })];
      const shapes = [shape('s1', 'l1')];
      expect(editableShapes(shapes, layers)).toHaveLength(0);
    });
  });

  describe('visibleShapes', () => {
    it('includes shapes on visible layers regardless of lock', () => {
      const layers = [layer('l1', { locked: true })];
      const shapes = [shape('s1', 'l1')];
      expect(visibleShapes(shapes, layers)).toHaveLength(1);
    });

    it('excludes shapes on hidden layers', () => {
      const layers = [layer('l1', { visible: false })];
      const shapes = [shape('s1', 'l1')];
      expect(visibleShapes(shapes, layers)).toHaveLength(0);
    });
  });

  describe('printableShapes', () => {
    it('includes shapes on print-visible layers', () => {
      const layers = [layer('l1', { printVisible: true })];
      const shapes = [shape('s1', 'l1')];
      expect(printableShapes(shapes, layers)).toHaveLength(1);
    });

    it('excludes shapes on non-print layers', () => {
      const layers = [layer('l1', { printVisible: false })];
      const shapes = [shape('s1', 'l1')];
      expect(printableShapes(shapes, layers)).toHaveLength(0);
    });

    it('print-visible independent of screen-visible', () => {
      const layers = [layer('l1', { visible: false, printVisible: true })];
      const shapes = [shape('s1', 'l1')];
      expect(printableShapes(shapes, layers)).toHaveLength(1);
    });
  });
});
