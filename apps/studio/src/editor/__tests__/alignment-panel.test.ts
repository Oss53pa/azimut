/**
 * Tests for alignment, distribution, and z-order pure functions.
 *
 * The AlignmentPanel component is thin UI — these tests cover
 * the underlying pure computations from alignment.ts.
 */

import { describe, it, expect } from 'vitest';
import {
  computeAlignment,
  computeDistribution,
  computeZOrder,
} from '../alignment.js';
import type { AlignableBounds } from '../alignment.js';

const ITEMS: readonly AlignableBounds[] = [
  { id: 'a', minX_m: 0, minY_m: 0, maxX_m: 2, maxY_m: 1 },
  { id: 'b', minX_m: 3, minY_m: 2, maxX_m: 5, maxY_m: 4 },
  { id: 'c', minX_m: 6, minY_m: 1, maxX_m: 8, maxY_m: 3 },
];

describe('E7.3 — alignment and distribution', () => {
  describe('computeAlignment', () => {
    it('returns empty for < 2 items', () => {
      const single = ITEMS[0];
      if (single === undefined) throw new Error('test setup');
      expect(computeAlignment([single], 'left')).toEqual([]);
    });

    it('aligns left to minimum x', () => {
      const result = computeAlignment(ITEMS, 'left');
      expect(result).toHaveLength(3);
      // All items should move to minX = 0
      expect(result.find(r => r.id === 'a')?.dx_m).toBe(0);
      expect(result.find(r => r.id === 'b')?.dx_m).toBe(-3);
      expect(result.find(r => r.id === 'c')?.dx_m).toBe(-6);
    });

    it('aligns right to maximum x', () => {
      const result = computeAlignment(ITEMS, 'right');
      expect(result).toHaveLength(3);
      // All items should move maxX to 8
      expect(result.find(r => r.id === 'a')?.dx_m).toBe(6);
      expect(result.find(r => r.id === 'b')?.dx_m).toBe(3);
      expect(result.find(r => r.id === 'c')?.dx_m).toBe(0);
    });

    it('aligns bottom to minimum y', () => {
      const result = computeAlignment(ITEMS, 'bottom');
      expect(result).toHaveLength(3);
      // All items should move minY to 0
      expect(result.find(r => r.id === 'a')?.dy_m).toBe(0);
      expect(result.find(r => r.id === 'b')?.dy_m).toBe(-2);
      expect(result.find(r => r.id === 'c')?.dy_m).toBe(-1);
    });

    it('aligns top to maximum y', () => {
      const result = computeAlignment(ITEMS, 'top');
      expect(result).toHaveLength(3);
      // All items should move maxY to 4
      expect(result.find(r => r.id === 'a')?.dy_m).toBe(3);
      expect(result.find(r => r.id === 'b')?.dy_m).toBe(0);
      expect(result.find(r => r.id === 'c')?.dy_m).toBe(1);
    });

    it('center horizontal produces zero dy', () => {
      const result = computeAlignment(ITEMS, 'center_h');
      for (const r of result) {
        expect(r.dy_m).toBe(0);
      }
    });

    it('center vertical produces zero dx', () => {
      const result = computeAlignment(ITEMS, 'center_v');
      for (const r of result) {
        expect(r.dx_m).toBe(0);
      }
    });
  });

  describe('computeDistribution', () => {
    it('returns empty for < 3 items', () => {
      expect(computeDistribution(ITEMS.slice(0, 2), 'horizontal')).toEqual([]);
    });

    it('distributes horizontally', () => {
      const result = computeDistribution(ITEMS, 'horizontal');
      expect(result).toHaveLength(3);
      // First and last centers should stay fixed
      // Centers: a=1, b=4, c=7 → evenly spaced at 1, 4, 7 (already even)
      expect(result.find(r => r.id === 'a')?.dx_m).toBeCloseTo(0, 5);
      expect(result.find(r => r.id === 'c')?.dx_m).toBeCloseTo(0, 5);
    });

    it('distributes vertically', () => {
      const result = computeDistribution(ITEMS, 'vertical');
      expect(result).toHaveLength(3);
      // Centers: a=0.5, b=3, c=2 → sorted by y center: a(0.5), c(2), b(3)
      // Step = (3 - 0.5) / 2 = 1.25
      // Target: a=0.5, c=1.75, b=3
      // c delta = 1.75 - 2 = -0.25
      const cResult = result.find(r => r.id === 'c');
      expect(cResult?.dy_m).toBeCloseTo(-0.25, 5);
    });
  });

  describe('computeZOrder', () => {
    const ORDER = ['a', 'b', 'c', 'd'];

    it('bring_front moves selected to end', () => {
      const result = computeZOrder(ORDER, ['b'], 'bring_front');
      expect(result).toEqual(['a', 'c', 'd', 'b']);
    });

    it('send_back moves selected to start', () => {
      const result = computeZOrder(ORDER, ['c'], 'send_back');
      expect(result).toEqual(['c', 'a', 'b', 'd']);
    });

    it('bring_forward moves one position forward', () => {
      const result = computeZOrder(ORDER, ['b'], 'bring_forward');
      expect(result).toEqual(['a', 'c', 'b', 'd']);
    });

    it('send_backward moves one position back', () => {
      const result = computeZOrder(ORDER, ['c'], 'send_backward');
      expect(result).toEqual(['a', 'c', 'b', 'd']);
    });

    it('returns unchanged order when no selection', () => {
      expect(computeZOrder(ORDER, [], 'bring_front')).toEqual(ORDER);
    });

    it('bring_front with multiple selected preserves relative order', () => {
      const result = computeZOrder(ORDER, ['a', 'c'], 'bring_front');
      expect(result).toEqual(['b', 'd', 'a', 'c']);
    });
  });
});
