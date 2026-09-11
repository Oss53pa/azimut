import { describe, it, expect } from 'vitest';
import type { DecorationShape } from '../scene-objects.js';
import { DEFAULT_DECORATION_STYLE } from '../scene-objects.js';
import type { EditorDocument } from '../editor-document.js';
import { defaultLayer } from '../document-commands.js';
import {
  buildClipboardPayload,
  decodeGeometry,
  shapesFromClipboard,
} from '../document-clipboard.js';
import type { ClipboardItem } from '../clipboard.js';

const LAYER = defaultLayer('org-1', 'site-1', 'level-0');
const CONTEXT = { orgId: 'org-1', siteId: 'site-1', levelId: 'level-0' };
const NO_OFFSET = { x_m: 0, y_m: 0 };

function shape(id: string, x: number, over: Partial<DecorationShape> = {}): DecorationShape {
  return {
    id, orgId: 'org-1', layerId: LAYER.id,
    kind: 'area',
    geometry: { type: 'rectangle', origin: { x_m: x, y_m: 0 }, width_m: 2, height_m: 2 },
    styleRole: null,
    style: DEFAULT_DECORATION_STYLE,
    label: '',
    rotation_deg: 0,
    ...over,
  };
}

function docWith(shapes: readonly DecorationShape[]): EditorDocument {
  return { siteId: 'site-1', layers: [LAYER], shapes };
}

const TARGET = {
  orgId: 'org-1',
  layerId: LAYER.id,
  idAt: (index: number) => `dec-new-${String(index)}`,
};

describe('E7.3 — clipboard bridge', () => {
  describe('buildClipboardPayload', () => {
    it('encodes the selected shapes with the source context', () => {
      const payload = buildClipboardPayload(docWith([shape('dec-1', 0)]), ['dec-1'], CONTEXT);
      expect(payload).not.toBeNull();
      if (payload === null) return;
      expect(payload.sourceOrgId).toBe('org-1');
      expect(payload.sourceSiteId).toBe('site-1');
      expect(payload.sourceLevelId).toBe('level-0');
      expect(payload.items).toHaveLength(1);
      expect(payload.items[0]?.type).toBe('area');
    });

    it('keeps draw order rather than selection order', () => {
      const doc = docWith([shape('dec-1', 0), shape('dec-2', 4)]);
      const payload = buildClipboardPayload(doc, ['dec-2', 'dec-1'], CONTEXT);
      expect(payload?.items.map(i => i.properties['label'])).toEqual(['', '']);
      expect(payload?.items).toHaveLength(2);
    });

    it('records the centroid of the combined bounds', () => {
      const doc = docWith([shape('dec-1', 0), shape('dec-2', 4)]);
      const payload = buildClipboardPayload(doc, ['dec-1', 'dec-2'], CONTEXT);
      // Combined bounds x from 0 to 6, y from 0 to 2.
      expect(payload?.centroid).toEqual({ x_m: 3, y_m: 1 });
    });

    it('falls back to the origin when no shape has an extent', () => {
      const doc = docWith([shape('dec-1', 0, { geometry: { type: 'polygon', points: [] } })]);
      expect(buildClipboardPayload(doc, ['dec-1'], CONTEXT)?.centroid)
        .toEqual({ x_m: 0, y_m: 0 });
    });

    it('returns null when the selection holds no habillage shape', () => {
      expect(buildClipboardPayload(docWith([]), ['footprint-1'], CONTEXT)).toBeNull();
    });
  });

  describe('decodeGeometry', () => {
    it('accepts each geometry of the model (E9.3)', () => {
      expect(decodeGeometry({ type: 'polygon', points: [{ x_m: 0, y_m: 0 }] })).not.toBeNull();
      expect(decodeGeometry({ type: 'polyline', points: [] })).not.toBeNull();
      expect(decodeGeometry({
        type: 'rectangle', origin: { x_m: 0, y_m: 0 }, width_m: 1, height_m: 1,
      })).not.toBeNull();
      expect(decodeGeometry({
        type: 'ellipse', center: { x_m: 0, y_m: 0 }, rx_m: 1, ry_m: 1,
      })).not.toBeNull();
      expect(decodeGeometry({
        type: 'symbol_ref', position: { x_m: 0, y_m: 0 }, symbolId: 's', scale: 1,
      })).not.toBeNull();
    });

    it('rejects a payload that is not an object', () => {
      expect(decodeGeometry(null)).toBeNull();
      expect(decodeGeometry('polygon')).toBeNull();
    });

    it('rejects an unknown geometry type', () => {
      expect(decodeGeometry({ type: 'spline', points: [] })).toBeNull();
    });

    it('rejects malformed points', () => {
      expect(decodeGeometry({ type: 'polygon', points: [{ x_m: 0 }] })).toBeNull();
      expect(decodeGeometry({ type: 'polygon', points: 'nope' })).toBeNull();
    });

    it('rejects missing numeric fields', () => {
      expect(decodeGeometry({
        type: 'rectangle', origin: { x_m: 0, y_m: 0 }, width_m: '1', height_m: 1,
      })).toBeNull();
      expect(decodeGeometry({
        type: 'ellipse', center: { x_m: 0, y_m: 0 }, rx_m: 1,
      })).toBeNull();
      expect(decodeGeometry({
        type: 'symbol_ref', position: { x_m: 0, y_m: 0 }, symbolId: 1, scale: 1,
      })).toBeNull();
    });
  });

  describe('shapesFromClipboard', () => {
    it('round-trips a shape through encode and decode', () => {
      const original = shape('dec-1', 3, { label: 'Massif', rotation_deg: 45 });
      const payload = buildClipboardPayload(docWith([original]), ['dec-1'], CONTEXT);
      if (payload === null) throw new Error('payload expected');

      const pasted = shapesFromClipboard(payload.items, NO_OFFSET, TARGET);
      expect(pasted).toHaveLength(1);
      expect(pasted[0]).toEqual({ ...original, id: 'dec-new-0' });
    });

    it('applies the paste offset to the geometry', () => {
      const payload = buildClipboardPayload(docWith([shape('dec-1', 0)]), ['dec-1'], CONTEXT);
      if (payload === null) throw new Error('payload expected');

      const pasted = shapesFromClipboard(payload.items, { x_m: 0.5, y_m: 0.5 }, TARGET);
      expect(pasted[0]?.geometry).toEqual({
        type: 'rectangle', origin: { x_m: 0.5, y_m: 0.5 }, width_m: 2, height_m: 2,
      });
    });

    it('gives each pasted shape a distinct identifier', () => {
      const doc = docWith([shape('dec-1', 0), shape('dec-2', 4)]);
      const payload = buildClipboardPayload(doc, ['dec-1', 'dec-2'], CONTEXT);
      if (payload === null) throw new Error('payload expected');

      const pasted = shapesFromClipboard(payload.items, NO_OFFSET, TARGET);
      expect(pasted.map(s => s.id)).toEqual(['dec-new-0', 'dec-new-1']);
    });

    it('re-parents pasted shapes onto the target layer', () => {
      const payload = buildClipboardPayload(docWith([shape('dec-1', 0)]), ['dec-1'], CONTEXT);
      if (payload === null) throw new Error('payload expected');

      const pasted = shapesFromClipboard(payload.items, NO_OFFSET, {
        ...TARGET, layerId: 'layer-other',
      });
      expect(pasted[0]?.layerId).toBe('layer-other');
    });

    it('skips an item whose geometry fails validation rather than pasting it degraded', () => {
      const bad: ClipboardItem = {
        type: 'area',
        geometry: { type: 'spline' },
        properties: { style: DEFAULT_DECORATION_STYLE },
      };
      expect(shapesFromClipboard([bad], NO_OFFSET, TARGET)).toEqual([]);
    });

    it('skips an item with an unknown kind', () => {
      const bad: ClipboardItem = {
        type: 'widget',
        geometry: { type: 'polyline', points: [] },
        properties: { style: DEFAULT_DECORATION_STYLE },
      };
      expect(shapesFromClipboard([bad], NO_OFFSET, TARGET)).toEqual([]);
    });

    it('skips an item with an unusable style', () => {
      const bad: ClipboardItem = {
        type: 'area',
        geometry: { type: 'polyline', points: [] },
        properties: { style: { fillRole: 1, strokeRole: null, strokeWidth_m: 1, opacity: 1 } },
      };
      expect(shapesFromClipboard([bad], NO_OFFSET, TARGET)).toEqual([]);
    });

    it('falls back to neutral values for missing optional properties', () => {
      const sparse: ClipboardItem = {
        type: 'path',
        geometry: { type: 'polyline', points: [] },
        properties: { style: DEFAULT_DECORATION_STYLE },
      };
      const pasted = shapesFromClipboard([sparse], NO_OFFSET, TARGET);
      expect(pasted[0]?.label).toBe('');
      expect(pasted[0]?.styleRole).toBeNull();
      expect(pasted[0]?.rotation_deg).toBe(0);
    });

    it('numbers only the items it keeps, leaving no identifier gap', () => {
      const good: ClipboardItem = {
        type: 'path',
        geometry: { type: 'polyline', points: [] },
        properties: { style: DEFAULT_DECORATION_STYLE },
      };
      const bad: ClipboardItem = { type: 'area', geometry: null, properties: {} };
      const pasted = shapesFromClipboard([bad, good], NO_OFFSET, TARGET);
      expect(pasted.map(s => s.id)).toEqual(['dec-new-0']);
    });
  });
});
