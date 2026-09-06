import { describe, it, expect } from 'vitest';
import {
  computeAlignment,
  computeDistribution,
  computeZOrder,
} from '../alignment.js';
import type { AlignableBounds } from '../alignment.js';

function bounds(id: string, minX: number, minY: number, maxX: number, maxY: number): AlignableBounds {
  return { id, minX_m: minX, minY_m: minY, maxX_m: maxX, maxY_m: maxY };
}

describe('E7.3 — alignment and distribution', () => {
  describe('computeAlignment', () => {
    it('returns empty for fewer than 2 items', () => {
      const items = [bounds('a', 0, 0, 1, 1)];
      expect(computeAlignment(items, 'left')).toStrictEqual([]);
    });

    it('aligns left', () => {
      const items = [bounds('a', 2, 0, 4, 1), bounds('b', 5, 0, 8, 1)];
      const result = computeAlignment(items, 'left');
      expect(result.find(r => r.id === 'a')?.dx_m).toBe(0);
      expect(result.find(r => r.id === 'b')?.dx_m).toBe(-3); // 2-5
    });

    it('aligns right', () => {
      const items = [bounds('a', 0, 0, 3, 1), bounds('b', 0, 0, 6, 1)];
      const result = computeAlignment(items, 'right');
      expect(result.find(r => r.id === 'a')?.dx_m).toBe(3); // 6-3
      expect(result.find(r => r.id === 'b')?.dx_m).toBe(0);
    });

    it('aligns center horizontally', () => {
      const items = [bounds('a', 0, 0, 2, 1), bounds('b', 6, 0, 10, 1)];
      // Centers: a=1, b=8, average=4.5
      const result = computeAlignment(items, 'center_h');
      expect(result.find(r => r.id === 'a')?.dx_m).toBeCloseTo(3.5);
      expect(result.find(r => r.id === 'b')?.dx_m).toBeCloseTo(-3.5);
    });

    it('aligns top (max Y in meters)', () => {
      const items = [bounds('a', 0, 0, 1, 3), bounds('b', 0, 0, 1, 5)];
      const result = computeAlignment(items, 'top');
      expect(result.find(r => r.id === 'a')?.dy_m).toBe(2); // 5-3
      expect(result.find(r => r.id === 'b')?.dy_m).toBe(0);
    });

    it('aligns bottom (min Y)', () => {
      const items = [bounds('a', 0, 2, 1, 4), bounds('b', 0, 5, 1, 8)];
      const result = computeAlignment(items, 'bottom');
      expect(result.find(r => r.id === 'a')?.dy_m).toBe(0);
      expect(result.find(r => r.id === 'b')?.dy_m).toBe(-3); // 2-5
    });

    it('zero deltas preserve unchanged', () => {
      const items = [bounds('a', 0, 0, 1, 1), bounds('b', 0, 0, 1, 1)];
      const result = computeAlignment(items, 'left');
      expect(result.every(r => r.dx_m === 0 && r.dy_m === 0)).toBe(true);
    });
  });

  describe('computeDistribution', () => {
    it('returns empty for fewer than 3 items', () => {
      const items = [bounds('a', 0, 0, 1, 1), bounds('b', 5, 0, 6, 1)];
      expect(computeDistribution(items, 'horizontal')).toStrictEqual([]);
    });

    it('distributes 3 items horizontally', () => {
      // Centers at 1, 3, 9 → should become 1, 5, 9
      const items = [
        bounds('a', 0, 0, 2, 1), // center=1
        bounds('b', 2, 0, 4, 1), // center=3
        bounds('c', 8, 0, 10, 1), // center=9
      ];
      const result = computeDistribution(items, 'horizontal');
      // a stays at center=1 (delta=0), b moves from 3 to 5 (delta=2), c stays at 9 (delta=0)
      expect(result.find(r => r.id === 'a')?.dx_m).toBeCloseTo(0);
      expect(result.find(r => r.id === 'b')?.dx_m).toBeCloseTo(2);
      expect(result.find(r => r.id === 'c')?.dx_m).toBeCloseTo(0);
    });

    it('distributes vertically', () => {
      const items = [
        bounds('a', 0, 0, 1, 2),   // centerY=1
        bounds('b', 0, 2, 1, 4),   // centerY=3
        bounds('c', 0, 10, 1, 12), // centerY=11
      ];
      const result = computeDistribution(items, 'vertical');
      // First at 1, last at 11, step=5: targets 1, 6, 11
      expect(result.find(r => r.id === 'a')?.dy_m).toBeCloseTo(0);
      expect(result.find(r => r.id === 'b')?.dy_m).toBeCloseTo(3); // 6-3
      expect(result.find(r => r.id === 'c')?.dy_m).toBeCloseTo(0);
    });
  });

  describe('computeZOrder', () => {
    const ids = ['a', 'b', 'c', 'd'];

    it('bring_front moves selected to end', () => {
      const result = computeZOrder(ids, ['b'], 'bring_front');
      expect(result).toStrictEqual(['a', 'c', 'd', 'b']);
    });

    it('send_back moves selected to start', () => {
      const result = computeZOrder(ids, ['c'], 'send_back');
      expect(result).toStrictEqual(['c', 'a', 'b', 'd']);
    });

    it('bring_forward moves one position up', () => {
      const result = computeZOrder(ids, ['b'], 'bring_forward');
      expect(result).toStrictEqual(['a', 'c', 'b', 'd']);
    });

    it('send_backward moves one position down', () => {
      const result = computeZOrder(ids, ['c'], 'send_backward');
      expect(result).toStrictEqual(['a', 'c', 'b', 'd']);
    });

    it('bring_front with multiple selected preserves relative order', () => {
      const result = computeZOrder(ids, ['a', 'c'], 'bring_front');
      expect(result).toStrictEqual(['b', 'd', 'a', 'c']);
    });

    it('returns unchanged for empty selection', () => {
      expect(computeZOrder(ids, [], 'bring_front')).toStrictEqual(ids);
    });

    it('already-at-front item stays in place', () => {
      const result = computeZOrder(ids, ['d'], 'bring_front');
      expect(result).toStrictEqual(['a', 'b', 'c', 'd']);
    });
  });
});
