import { describe, it, expect } from 'vitest';
import {
  POINT_COINCIDENCE_M,
  ANGLE_EQUALITY_DEG,
  EDGE_MIN_LENGTH_M,
  POLYGON_MIN_AREA_M2,
} from '../tolerance.js';

describe('tolerance constants', () => {
  it('POINT_COINCIDENCE_M is a positive sub-millimetre value', () => {
    expect(POINT_COINCIDENCE_M).toBeGreaterThan(0);
    expect(POINT_COINCIDENCE_M).toBeLessThan(0.01);
  });

  it('ANGLE_EQUALITY_DEG is a small positive angle', () => {
    expect(ANGLE_EQUALITY_DEG).toBeGreaterThan(0);
    expect(ANGLE_EQUALITY_DEG).toBeLessThan(1);
  });

  it('EDGE_MIN_LENGTH_M is positive and at least POINT_COINCIDENCE_M', () => {
    expect(EDGE_MIN_LENGTH_M).toBeGreaterThan(0);
    expect(EDGE_MIN_LENGTH_M).toBeGreaterThanOrEqual(POINT_COINCIDENCE_M);
  });

  it('POLYGON_MIN_AREA_M2 is positive', () => {
    expect(POLYGON_MIN_AREA_M2).toBeGreaterThan(0);
  });

  it('all values are finite numbers', () => {
    const all = [POINT_COINCIDENCE_M, ANGLE_EQUALITY_DEG, EDGE_MIN_LENGTH_M, POLYGON_MIN_AREA_M2];
    for (const v of all) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });
});
