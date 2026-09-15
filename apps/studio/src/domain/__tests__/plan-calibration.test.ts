import { describe, it, expect } from 'vitest';
import { computeCalibration, MIN_POINT_SEPARATION_PX } from '../plan-calibration.js';

const A = { x_px: 100, y_px: 100 };

describe('M2 — calage du fond de plan', () => {
  it('déduit la résolution et l’échelle de deux points et d’une distance', () => {
    // 214 px pour 42,5 m : la résolution vaut 214/42,5 px/m.
    const result = computeCalibration({
      a: A,
      b: { x_px: 314, y_px: 100 },
      real_distance_m: 42.5,
      north_azimuth_deg: 0,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pixel_distance).toBeCloseTo(214, 6);
    expect(result.value.resolution_px_per_m).toBeCloseTo(214 / 42.5, 9);
    // 1000 / (214/42,5) ≈ 198,6 → 1:199
    expect(result.value.scale_denominator).toBe(199);
    expect(result.warnings).toEqual([]);
  });

  it('refuse une distance nulle ou négative', () => {
    const result = computeCalibration({
      a: A, b: { x_px: 300, y_px: 100 }, real_distance_m: 0, north_azimuth_deg: 0,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.map(f => f.code)).toContain('CALIB.DISTANCE_INVALID');
  });

  it('refuse deux points trop proches', () => {
    const result = computeCalibration({
      a: A,
      b: { x_px: A.x_px + MIN_POINT_SEPARATION_PX - 1, y_px: A.y_px },
      real_distance_m: 10,
      north_azimuth_deg: 0,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.map(f => f.code)).toContain('CALIB.POINTS_TOO_CLOSE');
  });

  it('refuse le calage tant que le nord n’est pas saisi', () => {
    const result = computeCalibration({
      a: A, b: { x_px: 314, y_px: 100 }, real_distance_m: 42.5, north_azimuth_deg: null,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.map(f => f.code)).toContain('CALIB.NORTH_MISSING');
  });

  it('avertit sans refuser quand la résolution sort de la plage de vraisemblance', () => {
    const result = computeCalibration({
      a: A, b: { x_px: 100_000, y_px: 100 }, real_distance_m: 1, north_azimuth_deg: 0,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.map(f => f.code)).toEqual(['CALIB.SCALE_IMPLAUSIBLE']);
  });

  it('rend deux fois le même résultat pour la même saisie', () => {
    const input = {
      a: A, b: { x_px: 314, y_px: 220 }, real_distance_m: 42.5, north_azimuth_deg: 137,
    };
    expect(computeCalibration(input)).toEqual(computeCalibration(input));
  });
});
