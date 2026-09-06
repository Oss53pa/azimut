import { describe, it, expect } from 'vitest';
import {
  findSnapTarget,
  generateGridTargets,
  generateMidpointTargets,
  constrainOrthogonal,
  constrainAngle,
  DEFAULT_SNAP_TOLERANCE_PX,
} from '../snap.js';
import type { SnapTarget } from '../snap.js';

function target(
  kind: SnapTarget['kind'],
  x: number, y: number,
  sx: number, sy: number,
  sourceId: string,
): SnapTarget {
  return { kind, point: { x_m: x, y_m: y }, screenX: sx, screenY: sy, sourceId };
}

describe('E8 — snap (magnétisme)', () => {
  describe('findSnapTarget', () => {
    it('returns unsnapped position when no targets in range', () => {
      const cursor = { x_m: 5, y_m: 5 };
      const result = findSnapTarget(100, 100, cursor, [], 8);
      expect(result.point).toStrictEqual(cursor);
      expect(result.target).toBeNull();
    });

    it('snaps to nearest target within tolerance', () => {
      const targets: SnapTarget[] = [
        target('vertex', 1, 1, 105, 105, 'v1'),
        target('vertex', 2, 2, 200, 200, 'v2'),
      ];
      const result = findSnapTarget(100, 100, { x_m: 0, y_m: 0 }, targets, 10);
      expect(result.target?.sourceId).toBe('v1');
      expect(result.point).toStrictEqual({ x_m: 1, y_m: 1 });
    });

    it('ignores targets outside tolerance', () => {
      const targets: SnapTarget[] = [
        target('vertex', 1, 1, 120, 120, 'v1'),
      ];
      const result = findSnapTarget(100, 100, { x_m: 0, y_m: 0 }, targets, 5);
      expect(result.target).toBeNull();
    });

    it('priority: vertex beats midpoint at same distance (E8.2)', () => {
      const targets: SnapTarget[] = [
        target('midpoint', 1, 1, 105, 100, 'mid-1'),
        target('vertex', 2, 2, 105, 100, 'v1'),
      ];
      const result = findSnapTarget(100, 100, { x_m: 0, y_m: 0 }, targets, 10);
      expect(result.target?.kind).toBe('vertex');
    });

    it('priority: intersection beats midpoint', () => {
      const targets: SnapTarget[] = [
        target('midpoint', 1, 1, 103, 100, 'mid-1'),
        target('intersection', 2, 2, 103, 100, 'int-1'),
      ];
      const result = findSnapTarget(100, 100, { x_m: 0, y_m: 0 }, targets, 10);
      expect(result.target?.kind).toBe('intersection');
    });

    it('priority: midpoint beats guide', () => {
      const targets: SnapTarget[] = [
        target('guide', 1, 1, 103, 100, 'g1'),
        target('midpoint', 2, 2, 103, 100, 'mid-1'),
      ];
      const result = findSnapTarget(100, 100, { x_m: 0, y_m: 0 }, targets, 10);
      expect(result.target?.kind).toBe('midpoint');
    });

    it('priority: guide beats grid', () => {
      const targets: SnapTarget[] = [
        target('grid', 1, 1, 103, 100, 'grid-1'),
        target('guide', 2, 2, 103, 100, 'guide-1'),
      ];
      const result = findSnapTarget(100, 100, { x_m: 0, y_m: 0 }, targets, 10);
      expect(result.target?.kind).toBe('guide');
    });

    it('same priority: closer distance wins', () => {
      const targets: SnapTarget[] = [
        target('vertex', 1, 1, 107, 100, 'v-far'),
        target('vertex', 2, 2, 103, 100, 'v-near'),
      ];
      const result = findSnapTarget(100, 100, { x_m: 0, y_m: 0 }, targets, 10);
      expect(result.target?.sourceId).toBe('v-near');
    });

    it('same priority and distance: sourceId tiebreak (E8.2)', () => {
      const targets: SnapTarget[] = [
        target('vertex', 2, 2, 105, 100, 'v-beta'),
        target('vertex', 1, 1, 105, 100, 'v-alpha'),
      ];
      const result = findSnapTarget(100, 100, { x_m: 0, y_m: 0 }, targets, 10);
      expect(result.target?.sourceId).toBe('v-alpha');
    });

    it('determinism: same inputs produce same result (INV-4)', () => {
      const targets: SnapTarget[] = [
        target('vertex', 1, 1, 103, 102, 'v1'),
        target('midpoint', 2, 2, 104, 101, 'mid-1'),
        target('grid', 3, 3, 105, 103, 'grid-1'),
      ];
      const r1 = findSnapTarget(100, 100, { x_m: 0, y_m: 0 }, targets, 10);
      const r2 = findSnapTarget(100, 100, { x_m: 0, y_m: 0 }, targets, 10);
      expect(r1).toStrictEqual(r2);
    });
  });

  describe('DEFAULT_SNAP_TOLERANCE_PX', () => {
    it('is 8 pixels (E8.2)', () => {
      expect(DEFAULT_SNAP_TOLERANCE_PX).toBe(8);
    });
  });

  describe('generateGridTargets', () => {
    const toScreen = (p: { x_m: number; y_m: number }): { x: number; y: number } => ({
      x: p.x_m * 10,
      y: p.y_m * 10,
    });

    it('generates grid points within bounds', () => {
      const targets = generateGridTargets(1, 0, 0, 3, 3, toScreen);
      // 4x4 = 16 points (0,0 to 3,3)
      expect(targets.length).toBe(16);
    });

    it('all targets are kind "grid"', () => {
      const targets = generateGridTargets(1, 0, 0, 2, 2, toScreen);
      for (const t of targets) {
        expect(t.kind).toBe('grid');
      }
    });

    it('returns empty for zero spacing', () => {
      expect(generateGridTargets(0, 0, 0, 10, 10, toScreen)).toStrictEqual([]);
    });

    it('returns empty for negative spacing', () => {
      expect(generateGridTargets(-1, 0, 0, 10, 10, toScreen)).toStrictEqual([]);
    });
  });

  describe('generateMidpointTargets', () => {
    const toScreen = (p: { x_m: number; y_m: number }): { x: number; y: number } => ({
      x: p.x_m * 10,
      y: p.y_m * 10,
    });

    it('generates midpoints of segments', () => {
      const segments = [
        { from: { x_m: 0, y_m: 0 }, to: { x_m: 10, y_m: 0 }, id: 'seg-1' },
      ];
      const targets = generateMidpointTargets(segments, toScreen);
      expect(targets).toHaveLength(1);
      expect(targets[0]?.point.x_m).toBe(5);
      expect(targets[0]?.point.y_m).toBe(0);
      expect(targets[0]?.kind).toBe('midpoint');
    });
  });

  describe('constrainOrthogonal', () => {
    const origin = { x_m: 0, y_m: 0 };

    it('constrains to horizontal when dx > dy', () => {
      const result = constrainOrthogonal(origin, { x_m: 5, y_m: 2 });
      expect(result.x_m).toBe(5);
      expect(result.y_m).toBe(0);
    });

    it('constrains to vertical when dy > dx', () => {
      const result = constrainOrthogonal(origin, { x_m: 2, y_m: 5 });
      expect(result.x_m).toBe(0);
      expect(result.y_m).toBe(5);
    });

    it('constrains to horizontal when equal (deterministic)', () => {
      const result = constrainOrthogonal(origin, { x_m: 5, y_m: 5 });
      expect(result.x_m).toBe(5);
      expect(result.y_m).toBe(0);
    });
  });

  describe('constrainAngle', () => {
    const origin = { x_m: 0, y_m: 0 };

    it('constrains to nearest 45° increment', () => {
      const result = constrainAngle(origin, { x_m: 4, y_m: 1 }, 45);
      // Actual angle ≈ 14° → snaps to 0° → along X axis
      expect(result.y_m).toBeCloseTo(0, 5);
      expect(result.x_m).toBeGreaterThan(0);
    });

    it('constrains to nearest 90° increment', () => {
      const result = constrainAngle(origin, { x_m: 1, y_m: 4 }, 90);
      // Actual angle ≈ 76° → snaps to 90° → along Y axis
      expect(result.x_m).toBeCloseTo(0, 5);
      expect(result.y_m).toBeGreaterThan(0);
    });

    it('returns cursor for zero angle step', () => {
      const cursor = { x_m: 3, y_m: 4 };
      expect(constrainAngle(origin, cursor, 0)).toStrictEqual(cursor);
    });

    it('returns cursor when at origin', () => {
      expect(constrainAngle(origin, origin, 45)).toStrictEqual(origin);
    });

    it('preserves distance from origin', () => {
      const cursor = { x_m: 3, y_m: 4 };
      const dist = Math.sqrt(9 + 16);
      const result = constrainAngle(origin, cursor, 45);
      const resultDist = Math.sqrt(result.x_m ** 2 + result.y_m ** 2);
      expect(resultDist).toBeCloseTo(dist, 5);
    });
  });
});
