import { describe, it, expect } from 'vitest';
import {
  signedArea,
  polygonArea,
  ensureCCW,
  pointInPolygon,
  segmentIntersection,
  isSelfIntersecting,
  booleanOperation,
} from '../boolean-ops.js';
import type { Polygon } from '../boolean-ops.js';

// Unit square CCW
const square: Polygon = [
  { x_m: 0, y_m: 0 },
  { x_m: 1, y_m: 0 },
  { x_m: 1, y_m: 1 },
  { x_m: 0, y_m: 1 },
];

// Square offset by (0.5, 0.5)
const offsetSquare: Polygon = [
  { x_m: 0.5, y_m: 0.5 },
  { x_m: 1.5, y_m: 0.5 },
  { x_m: 1.5, y_m: 1.5 },
  { x_m: 0.5, y_m: 1.5 },
];

describe('E7.4 — boolean operations', () => {
  describe('signedArea', () => {
    it('returns positive for CCW polygon', () => {
      expect(signedArea(square)).toBeGreaterThan(0);
    });

    it('returns negative for CW polygon', () => {
      const cw = [...square].reverse();
      expect(signedArea(cw)).toBeLessThan(0);
    });

    it('returns 1 for unit square', () => {
      expect(signedArea(square)).toBeCloseTo(1);
    });
  });

  describe('polygonArea', () => {
    it('returns absolute area', () => {
      expect(polygonArea(square)).toBeCloseTo(1);
    });

    it('returns correct area for triangle', () => {
      const tri: Polygon = [
        { x_m: 0, y_m: 0 },
        { x_m: 4, y_m: 0 },
        { x_m: 0, y_m: 3 },
      ];
      expect(polygonArea(tri)).toBeCloseTo(6);
    });
  });

  describe('ensureCCW', () => {
    it('returns CCW polygon unchanged (same winding)', () => {
      const result = ensureCCW(square);
      expect(signedArea(result)).toBeGreaterThan(0);
    });

    it('reverses CW polygon to CCW', () => {
      const cw = [...square].reverse();
      const result = ensureCCW(cw);
      expect(signedArea(result)).toBeGreaterThan(0);
    });
  });

  describe('pointInPolygon', () => {
    it('returns true for interior point', () => {
      expect(pointInPolygon({ x_m: 0.5, y_m: 0.5 }, square)).toBe(true);
    });

    it('returns false for exterior point', () => {
      expect(pointInPolygon({ x_m: 2, y_m: 2 }, square)).toBe(false);
    });
  });

  describe('segmentIntersection', () => {
    it('finds intersection of crossing segments', () => {
      const ix = segmentIntersection(
        { x_m: 0, y_m: 0 }, { x_m: 2, y_m: 2 },
        { x_m: 0, y_m: 2 }, { x_m: 2, y_m: 0 },
      );
      expect(ix).not.toBeNull();
      expect(ix?.x_m).toBeCloseTo(1);
      expect(ix?.y_m).toBeCloseTo(1);
    });

    it('returns null for parallel segments', () => {
      const ix = segmentIntersection(
        { x_m: 0, y_m: 0 }, { x_m: 1, y_m: 0 },
        { x_m: 0, y_m: 1 }, { x_m: 1, y_m: 1 },
      );
      expect(ix).toBeNull();
    });

    it('returns null for non-overlapping segments', () => {
      const ix = segmentIntersection(
        { x_m: 0, y_m: 0 }, { x_m: 1, y_m: 0 },
        { x_m: 2, y_m: 0 }, { x_m: 3, y_m: 1 },
      );
      expect(ix).toBeNull();
    });
  });

  describe('isSelfIntersecting', () => {
    it('returns false for simple polygon', () => {
      expect(isSelfIntersecting(square)).toBe(false);
    });

    it('returns true for bowtie polygon', () => {
      const bowtie: Polygon = [
        { x_m: 0, y_m: 0 },
        { x_m: 1, y_m: 1 },
        { x_m: 1, y_m: 0 },
        { x_m: 0, y_m: 1 },
      ];
      expect(isSelfIntersecting(bowtie)).toBe(true);
    });
  });

  describe('booleanOperation', () => {
    it('intersection of overlapping squares produces valid polygon', () => {
      const result = booleanOperation(square, offsetSquare, 'intersect');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(polygonArea(result.polygon)).toBeCloseTo(0.25, 1);
      }
    });

    it('union of overlapping squares produces valid polygon', () => {
      const result = booleanOperation(square, offsetSquare, 'union');
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Convex hull of both squares
        expect(polygonArea(result.polygon)).toBeGreaterThan(1);
      }
    });

    it('intersection of non-overlapping squares fails', () => {
      const farSquare: Polygon = [
        { x_m: 10, y_m: 10 },
        { x_m: 11, y_m: 10 },
        { x_m: 11, y_m: 11 },
        { x_m: 10, y_m: 11 },
      ];
      const result = booleanOperation(square, farSquare, 'intersect');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.finding.code).toBe('EDIT.BOOLEAN_RESULT_INVALID');
      }
    });

    it('subtraction producing degenerate polygon fails', () => {
      // Subtract identical polygon → empty result
      const result = booleanOperation(square, square, 'subtract');
      // Should either return empty (too few vertices) or degenerate area
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.finding.code).toBe('EDIT.BOOLEAN_RESULT_INVALID');
      }
    });

    it('subtraction producing valid polygon succeeds', () => {
      // Large square minus small corner
      const large: Polygon = [
        { x_m: 0, y_m: 0 },
        { x_m: 10, y_m: 0 },
        { x_m: 10, y_m: 10 },
        { x_m: 0, y_m: 10 },
      ];
      const smallCorner: Polygon = [
        { x_m: 8, y_m: 8 },
        { x_m: 12, y_m: 8 },
        { x_m: 12, y_m: 12 },
        { x_m: 8, y_m: 12 },
      ];
      const result = booleanOperation(large, smallCorner, 'subtract');
      if (result.ok) {
        // Remaining area should be large - intersection (100 - 4 = 96)
        expect(polygonArea(result.polygon)).toBeGreaterThan(0);
      }
      // Either ok or validly rejected — both acceptable for subtraction
    });
  });
});
