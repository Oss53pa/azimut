import { describe, it, expect } from 'vitest';
import {
  COS_30,
  SIN_30,
  toIso,
  isoTx,
  computeWorldBounds,
  computeIsoTransform,
  projectTopFace,
  pointsStr,
  esc,
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

  it('handles zero-width world bounds (single point)', () => {
    const wb = { minX: 5, maxX: 5, minY: 5, maxY: 5, minZ: 0, maxZ: 0 };
    const t = computeIsoTransform(wb, 800, 600, 20);
    // Zero iso width/height → scale falls back to 1
    expect(t.scale).toBe(1);
    expect(isFinite(t.offsetX)).toBe(true);
    expect(isFinite(t.offsetY)).toBe(true);
  });
});

describe('pointsStr', () => {
  it('formats points as space-separated x,y pairs', () => {
    const pts = [{ x: 1.5, y: 2.3 }, { x: 4, y: 5 }];
    expect(pointsStr(pts)).toBe('1.5,2.3 4,5');
  });

  it('returns empty string for empty array', () => {
    expect(pointsStr([])).toBe('');
  });
});

describe('esc — XML escaping', () => {
  it('escapes ampersand, angle brackets, and double quotes', () => {
    expect(esc('A & B <C> "D"')).toBe('A &amp; B &lt;C&gt; &quot;D&quot;');
  });

  it('passes clean strings through unchanged', () => {
    expect(esc('hello world')).toBe('hello world');
  });

  it('handles empty string', () => {
    expect(esc('')).toBe('');
  });

  it('escapes consecutive special characters', () => {
    expect(esc('<<&&>>"')).toBe('&lt;&lt;&amp;&amp;&gt;&gt;&quot;');
  });
});

describe('computeWorldBounds — multi-level merging', () => {
  it('merges XY bounds across two levels', () => {
    const levels: LevelGeom[] = [
      { vertices: [{ x_m: 0, y_m: 0 }], elevation_m: 0, maxZ: 3 },
      { vertices: [{ x_m: 10, y_m: 20 }], elevation_m: 3, maxZ: 6 },
    ];
    const wb = computeWorldBounds(levels);
    expect(wb).not.toBeNull();
    expect(wb?.minX).toBe(0);
    expect(wb?.maxX).toBe(10);
    expect(wb?.minY).toBe(0);
    expect(wb?.maxY).toBe(20);
    expect(wb?.minZ).toBe(0);
    expect(wb?.maxZ).toBe(6);
  });

  it('handles negative coordinates', () => {
    const levels: LevelGeom[] = [{
      vertices: [
        { x_m: -5, y_m: -10 },
        { x_m: 5, y_m: 10 },
      ],
      elevation_m: -2,
      maxZ: 4,
    }];
    const wb = computeWorldBounds(levels);
    expect(wb?.minX).toBe(-5);
    expect(wb?.maxX).toBe(5);
    expect(wb?.minZ).toBe(-2);
    expect(wb?.maxZ).toBe(4);
  });
});

describe('computeIsoTransform — edge cases', () => {
  it('handles vertical-only extent (isoW = 0, isoH > 0)', () => {
    // Single XY point but different Z — projects to same iso X but different iso Y
    const wb = { minX: 5, maxX: 5, minY: 5, maxY: 5, minZ: 0, maxZ: 10 };
    const t = computeIsoTransform(wb, 800, 600, 20);
    expect(t.scale).toBeGreaterThan(0);
    expect(isFinite(t.offsetX)).toBe(true);
    expect(isFinite(t.offsetY)).toBe(true);
  });

  it('is deterministic (INV-4)', () => {
    const wb = { minX: 0, maxX: 10, minY: 0, maxY: 10, minZ: 0, maxZ: 5 };
    const t1 = computeIsoTransform(wb, 800, 600, 20);
    const t2 = computeIsoTransform(wb, 800, 600, 20);
    expect(t1).toStrictEqual(t2);
  });
});

describe('projectTopFace — edge cases', () => {
  it('returns empty array for empty vertices', () => {
    const t = { scale: 10, offsetX: 0, offsetY: 0 };
    expect(projectTopFace([], 5, t)).toEqual([]);
  });

  it('projects single vertex', () => {
    const t = { scale: 1, offsetX: 0, offsetY: 0 };
    const pts = projectTopFace([{ x_m: 0, y_m: 0 }], 0, t);
    expect(pts).toHaveLength(1);
    expect(pts[0]?.x).toBe(0);
    expect(pts[0]?.y).toBe(0);
  });
});
