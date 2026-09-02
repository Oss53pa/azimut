import { describe, it, expect } from 'vitest';
import {
  COS_30,
  SIN_30,
  toIso,
  isoTx,
  computeWorldBounds,
  computeIsoTransform,
  projectTopFace,
} from '../projection.js';
import type { LevelGeom } from '../projection.js';

describe('D5.1 — isometric projection constants', () => {
  it('COS_30 matches specification', () => {
    expect(COS_30).toBe(0.8660254037844386);
  });

  it('SIN_30 matches specification', () => {
    expect(SIN_30).toBe(0.5);
  });
});

describe('D5.1 — toIso', () => {
  it('projects origin to origin', () => {
    const p = toIso(0, 0, 0, 1);
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);
  });

  it('applies the spec formula u = (x - y) * cos30, v = (x + y) * sin30 - z', () => {
    const p = toIso(4, 2, 1, 1);
    const expectedU = (4 - 2) * COS_30;
    const expectedV = (4 + 2) * SIN_30 - 1;
    expect(p.x).toBeCloseTo(expectedU, 3);
    expect(p.y).toBeCloseTo(expectedV, 3);
  });

  it('respects scale factor', () => {
    const p1 = toIso(1, 0, 0, 1);
    const p2 = toIso(1, 0, 0, 2);
    expect(p2.x).toBeCloseTo(p1.x * 2, 3);
    expect(p2.y).toBeCloseTo(p1.y * 2, 3);
  });
});

describe('D5.1 — isoTx', () => {
  it('applies offset after projection', () => {
    const t = { scale: 1, offsetX: 100, offsetY: 200 };
    const p = isoTx(0, 0, 0, t);
    expect(p.x).toBe(100);
    expect(p.y).toBe(200);
  });
});

describe('projectTopFace', () => {
  it('projects all vertices at given height', () => {
    const vertices = [
      { x_m: 0, y_m: 0 },
      { x_m: 1, y_m: 0 },
      { x_m: 1, y_m: 1 },
    ];
    const t = { scale: 10, offsetX: 0, offsetY: 0 };
    const projected = projectTopFace(vertices, 5, t);
    expect(projected).toHaveLength(3);
    for (const p of projected) {
      expect(typeof p.x).toBe('number');
      expect(typeof p.y).toBe('number');
    }
  });
});

describe('computeWorldBounds', () => {
  it('returns null for empty levels', () => {
    expect(computeWorldBounds([])).toBeNull();
  });

  it('returns null for levels with no vertices', () => {
    const levels: LevelGeom[] = [
      { vertices: [], elevation_m: 0, maxZ: 3 },
    ];
    expect(computeWorldBounds(levels)).toBeNull();
  });

  it('computes bounds from vertices', () => {
    const levels: LevelGeom[] = [{
      vertices: [
        { x_m: -1, y_m: 2 },
        { x_m: 3, y_m: -4 },
      ],
      elevation_m: 0,
      maxZ: 5,
    }];
    const wb = computeWorldBounds(levels);
    expect(wb).not.toBeNull();
    expect(wb?.minX).toBe(-1);
    expect(wb?.maxX).toBe(3);
    expect(wb?.minY).toBe(-4);
    expect(wb?.maxY).toBe(2);
    expect(wb?.minZ).toBe(0);
    expect(wb?.maxZ).toBe(5);
  });
});

describe('computeIsoTransform', () => {
  it('produces a finite transform', () => {
    const wb = { minX: 0, maxX: 10, minY: 0, maxY: 10, minZ: 0, maxZ: 5 };
    const t = computeIsoTransform(wb, 800, 600, 20);
    expect(isFinite(t.scale)).toBe(true);
    expect(isFinite(t.offsetX)).toBe(true);
    expect(isFinite(t.offsetY)).toBe(true);
    expect(t.scale).toBeGreaterThan(0);
  });
});
