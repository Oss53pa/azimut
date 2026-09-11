import { describe, it, expect } from 'vitest';
import type { ShapeCommandData } from '../command-integration.js';
import type { DecorationGeometry, DecorationShape } from '../scene-objects.js';
import { DEFAULT_DECORATION_STYLE } from '../scene-objects.js';
import {
  geometryBounds,
  geometryFromCommandData,
  geometryVertices,
  kindForGeometry,
  regularPolygonPoints,
  shapeBounds,
  translateGeometry,
  translateShape,
} from '../shape-geometry.js';

function shapeWith(geometry: DecorationGeometry): DecorationShape {
  return {
    id: 'dec-1',
    orgId: 'org-1',
    layerId: 'layer-1',
    kind: kindForGeometry(geometry),
    geometry,
    styleRole: null,
    style: DEFAULT_DECORATION_STYLE,
    label: '',
    rotation_deg: 0,
  };
}

describe('E9 — geometry of decoration shapes', () => {
  describe('geometryBounds', () => {
    it('bounds a polygon from its points', () => {
      const b = geometryBounds({
        type: 'polygon',
        points: [
          { x_m: 1, y_m: 2 },
          { x_m: 5, y_m: 2 },
          { x_m: 5, y_m: 7 },
        ],
      });
      expect(b).toEqual({ minX_m: 1, minY_m: 2, maxX_m: 5, maxY_m: 7 });
    });

    it('bounds a rectangle with a negative extent', () => {
      const b = geometryBounds({
        type: 'rectangle',
        origin: { x_m: 4, y_m: 4 },
        width_m: -3,
        height_m: -2,
      });
      expect(b).toEqual({ minX_m: 1, minY_m: 2, maxX_m: 4, maxY_m: 4 });
    });

    it('bounds an ellipse from its radii', () => {
      const b = geometryBounds({
        type: 'ellipse',
        center: { x_m: 10, y_m: 10 },
        rx_m: 2,
        ry_m: 3,
      });
      expect(b).toEqual({ minX_m: 8, minY_m: 7, maxX_m: 12, maxY_m: 13 });
    });

    it('gives a symbol reference a zero-extent box at its anchor', () => {
      const b = geometryBounds({
        type: 'symbol_ref',
        position: { x_m: 3, y_m: 4 },
        symbolId: 'tree',
        scale: 2,
      });
      expect(b).toEqual({ minX_m: 3, minY_m: 4, maxX_m: 3, maxY_m: 4 });
    });

    it('returns null for an empty polyline', () => {
      expect(geometryBounds({ type: 'polyline', points: [] })).toBeNull();
    });
  });

  describe('shapeBounds', () => {
    it('carries the shape id for the alignment engine', () => {
      const bounds = shapeBounds(shapeWith({
        type: 'rectangle',
        origin: { x_m: 0, y_m: 0 },
        width_m: 2,
        height_m: 2,
      }));
      expect(bounds).toEqual({ id: 'dec-1', minX_m: 0, minY_m: 0, maxX_m: 2, maxY_m: 2 });
    });

    it('returns null when the geometry has no extent to align on', () => {
      expect(shapeBounds(shapeWith({ type: 'polygon', points: [] }))).toBeNull();
    });
  });

  describe('geometryVertices', () => {
    it('gives the four corners of a rectangle', () => {
      const v = geometryVertices({
        type: 'rectangle',
        origin: { x_m: 0, y_m: 0 },
        width_m: 2,
        height_m: 1,
      });
      expect(v).toHaveLength(4);
      expect(v).toContainEqual({ x_m: 2, y_m: 1 });
    });

    it('gives the four axis extremes of an ellipse', () => {
      const v = geometryVertices({
        type: 'ellipse',
        center: { x_m: 0, y_m: 0 },
        rx_m: 3,
        ry_m: 1,
      });
      expect(v).toHaveLength(4);
      expect(v).toContainEqual({ x_m: -3, y_m: 0 });
      expect(v).toContainEqual({ x_m: 0, y_m: 1 });
    });

    it('gives the anchor of a symbol reference', () => {
      expect(geometryVertices({
        type: 'symbol_ref',
        position: { x_m: 1, y_m: 2 },
        symbolId: 's',
        scale: 1,
      })).toEqual([{ x_m: 1, y_m: 2 }]);
    });
  });

  describe('translateGeometry (E4.1)', () => {
    it('translates and quantizes to the millimetre', () => {
      const g = translateGeometry(
        { type: 'polyline', points: [{ x_m: 0, y_m: 0 }] },
        0.00049,
        0.0016,
      );
      expect(g.type).toBe('polyline');
      if (g.type !== 'polyline') return;
      expect(g.points[0]?.x_m).toBe(0);
      expect(g.points[0]?.y_m).toBeCloseTo(0.002, 6);
    });

    it('moves a rectangle by its origin only', () => {
      const g = translateGeometry(
        { type: 'rectangle', origin: { x_m: 1, y_m: 1 }, width_m: 3, height_m: 4 },
        2, 3,
      );
      expect(g).toEqual({
        type: 'rectangle',
        origin: { x_m: 3, y_m: 4 },
        width_m: 3,
        height_m: 4,
      });
    });

    it('moves an ellipse by its centre', () => {
      const g = translateGeometry(
        { type: 'ellipse', center: { x_m: 0, y_m: 0 }, rx_m: 1, ry_m: 2 },
        5, -5,
      );
      expect(g).toEqual({
        type: 'ellipse',
        center: { x_m: 5, y_m: -5 },
        rx_m: 1,
        ry_m: 2,
      });
    });

    it('moves a symbol reference by its position, keeping its scale', () => {
      const g = translateGeometry(
        { type: 'symbol_ref', position: { x_m: 0, y_m: 0 }, symbolId: 'tree', scale: 3 },
        1, 1,
      );
      expect(g).toEqual({
        type: 'symbol_ref',
        position: { x_m: 1, y_m: 1 },
        symbolId: 'tree',
        scale: 3,
      });
    });

    it('keeps every other field of the shape untouched', () => {
      const shape = shapeWith({ type: 'polygon', points: [{ x_m: 0, y_m: 0 }] });
      const moved = translateShape(shape, 1, 1);
      expect(moved.id).toBe(shape.id);
      expect(moved.style).toBe(shape.style);
      expect(moved.layerId).toBe(shape.layerId);
    });
  });

  describe('regularPolygonPoints', () => {
    it('produces one point per side', () => {
      expect(regularPolygonPoints({ x_m: 0, y_m: 0 }, 1, 6, 0)).toHaveLength(6);
    });

    it('is deterministic for identical inputs (invariant 4)', () => {
      const a = regularPolygonPoints({ x_m: 1.5, y_m: -2.25 }, 3.33, 7, 12.5);
      const b = regularPolygonPoints({ x_m: 1.5, y_m: -2.25 }, 3.33, 7, 12.5);
      expect(a).toEqual(b);
    });

    it('starts on the positive x axis with no rotation', () => {
      const points = regularPolygonPoints({ x_m: 0, y_m: 0 }, 2, 4, 0);
      expect(points[0]).toEqual({ x_m: 2, y_m: 0 });
    });
  });

  describe('geometryFromCommandData', () => {
    it('normalizes a rectangle drawn right-to-left to a positive extent', () => {
      const data: ShapeCommandData = {
        kind: 'rect',
        origin: { x_m: 5, y_m: 6 },
        corner: { x_m: 1, y_m: 2 },
      };
      expect(geometryFromCommandData(data)).toEqual({
        type: 'rectangle',
        origin: { x_m: 1, y_m: 2 },
        width_m: 4,
        height_m: 4,
      });
    });

    it('converts a regular polygon to explicit points', () => {
      const g = geometryFromCommandData({
        kind: 'polygon',
        center: { x_m: 0, y_m: 0 },
        radius_m: 1,
        sides: 5,
        rotation_deg: 0,
      });
      expect(g?.type).toBe('polygon');
      if (g?.type !== 'polygon') return;
      expect(g.points).toHaveLength(5);
    });

    it('converts an ellipse, quantizing its radii', () => {
      const g = geometryFromCommandData({
        kind: 'ellipse',
        center: { x_m: 0, y_m: 0 },
        rx_m: 1.00049,
        ry_m: 2,
      });
      expect(g?.type).toBe('ellipse');
      if (g?.type !== 'ellipse') return;
      expect(g.rx_m).toBe(1);
    });

    it('converts a polyline', () => {
      const g = geometryFromCommandData({
        kind: 'polyline',
        points: [{ x_m: 0, y_m: 0 }, { x_m: 1, y_m: 1 }],
      });
      expect(g).toEqual({
        type: 'polyline',
        points: [{ x_m: 0, y_m: 0 }, { x_m: 1, y_m: 1 }],
      });
    });

    it('persists nothing for a measurement, which is a read-out', () => {
      expect(geometryFromCommandData({
        kind: 'measure',
        from: { x_m: 0, y_m: 0 },
        to: { x_m: 1, y_m: 1 },
      })).toBeNull();
    });

    it('persists nothing for a dimension, which belongs to annotations', () => {
      expect(geometryFromCommandData({
        kind: 'dimension',
        from: { x_m: 0, y_m: 0 },
        to: { x_m: 1, y_m: 1 },
        offset_m: 0.5,
      })).toBeNull();
    });
  });

  describe('kindForGeometry (E9.3)', () => {
    it('classifies closed geometries as areas', () => {
      expect(kindForGeometry({ type: 'polygon', points: [] })).toBe('area');
      expect(kindForGeometry({
        type: 'rectangle', origin: { x_m: 0, y_m: 0 }, width_m: 1, height_m: 1,
      })).toBe('area');
      expect(kindForGeometry({
        type: 'ellipse', center: { x_m: 0, y_m: 0 }, rx_m: 1, ry_m: 1,
      })).toBe('area');
    });

    it('classifies an open line as a path and a reference as a symbol', () => {
      expect(kindForGeometry({ type: 'polyline', points: [] })).toBe('path');
      expect(kindForGeometry({
        type: 'symbol_ref', position: { x_m: 0, y_m: 0 }, symbolId: 's', scale: 1,
      })).toBe('symbol');
    });
  });
});
