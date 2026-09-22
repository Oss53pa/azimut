import { describe, it, expect } from 'vitest';
import { computeCalibration, MIN_POINT_SEPARATION_PX } from '../plan-calibration.js';
import type { PlanPoint } from '../plan-calibration.js';

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
    expect(result.findings.map(f => f.code)).toContain('CALIB.AZIMUTH_INVALID');
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

/**
 * M2 (partie M), étape 2 et étape 3 — les contrôles de saisie que la
 * spécification nomme, et que le dépôt n'avait pas.
 *
 * Trois écarts relevés au versement de la partie M : l'écart minimal entre les
 * deux points valait 20 pixels là où M2 en demande 40 ; `CALIB.POINT_REQUIRED`
 * n'existait pas ; et l'azimut manquant levait `CALIB.NORTH_MISSING`, un code
 * inventé, là où M2 nomme `CALIB.AZIMUTH_INVALID`.
 */
describe('M2 (partie M) — contrôles de saisie du calage', () => {
  const base = {
    a: { x_px: 0, y_px: 0 },
    b: { x_px: 100, y_px: 0 },
    real_distance_m: 10,
    north_azimuth_deg: 0,
  };

  describe('étape 2 — les deux points', () => {
    it('refuse un point A non posé', () => {
      const r = computeCalibration({ ...base, a: null });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.findings.map(f => f.code)).toContain('CALIB.POINT_REQUIRED');
    });

    it('nomme lequel des deux manque', () => {
      const r = computeCalibration({ ...base, b: null });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        const f = r.findings.find(x => x.code === 'CALIB.POINT_REQUIRED');
        expect(f?.params['missing']).toBe('b');
      }
    });

    /**
     * Un point absent ne doit pas produire aussi « points trop proches » : deux
     * anomalies pour un seul fait rendent l'écran illisible.
     */
    it('un point absent ne lève pas en plus « points trop proches »', () => {
      const r = computeCalibration({ ...base, a: null, b: null });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.findings.map(f => f.code)).not.toContain('CALIB.POINTS_TOO_CLOSE');
    });

    it('exige les 40 pixels de M2, et non 20', () => {
      expect(MIN_POINT_SEPARATION_PX).toBe(40);
      const a30 = computeCalibration({ ...base, b: { x_px: 30, y_px: 0 } });
      expect(a30.ok).toBe(false);
      if (!a30.ok) expect(a30.findings.map(f => f.code)).toContain('CALIB.POINTS_TOO_CLOSE');
      expect(computeCalibration({ ...base, b: { x_px: 40, y_px: 0 } }).ok).toBe(true);
    });
  });

  describe('étape 3 — azimut du nord', () => {
    it('accepte le nord franc, qui vaut zéro (D1.3)', () => {
      expect(computeCalibration({ ...base, north_azimuth_deg: 0 }).ok).toBe(true);
    });

    it('accepte une valeur strictement inférieure à 360', () => {
      expect(computeCalibration({ ...base, north_azimuth_deg: 359.99 }).ok).toBe(true);
    });

    it('refuse 360, hors du domaine [0, 360[ de D1.3', () => {
      const r = computeCalibration({ ...base, north_azimuth_deg: 360 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.findings.map(f => f.code)).toContain('CALIB.AZIMUTH_INVALID');
    });

    it('refuse une valeur négative', () => {
      const r = computeCalibration({ ...base, north_azimuth_deg: -1 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.findings.map(f => f.code)).toContain('CALIB.AZIMUTH_INVALID');
    });

    it('un azimut absent lève le même code, la partie M n’en distinguant pas deux', () => {
      const r = computeCalibration({ ...base, north_azimuth_deg: null });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.findings.map(f => f.code)).toContain('CALIB.AZIMUTH_INVALID');
    });
  });
});

/**
 * M2 (partie M), critère d'acceptation 1 : « Un plan calé restitue une
 * distance connue à moins de 1 % d'erreur. »
 *
 * Le critère ne porte pas sur les deux points du calage, qui sont exacts par
 * construction, mais sur une **troisième** distance, mesurée après coup au
 * travers de la résolution retenue. C'est le seul aller-retour qui éprouve
 * quelque chose : poser, calculer l'échelle, puis remesurer ailleurs.
 */
describe('M2 (partie M) critère 1 — une distance connue est restituée', () => {
  /** Mesure une distance en mètres depuis la résolution calculée. */
  function measured_m(resolution_px_per_m: number, a: PlanPoint, b: PlanPoint): number {
    const dx = b.x_px - a.x_px;
    const dy = b.y_px - a.y_px;
    return Math.hypot(dx, dy) / resolution_px_per_m;
  }

  function calibrate(pixels: number, real_m: number): number {
    const out = computeCalibration({
      a: { x_px: 0, y_px: 0 },
      b: { x_px: pixels, y_px: 0 },
      real_distance_m: real_m,
      north_azimuth_deg: 0,
    });
    if (!out.ok) throw new Error(out.findings.map(f => f.code).join(','));
    return out.value.resolution_px_per_m;
  }

  it('restitue une distance tierce à moins de 1 % d’erreur', () => {
    // Calage : 200 pixels valent 20 mètres, soit 10 px/m.
    const resolution = calibrate(200, 20);
    // Une distance connue ailleurs sur le plan : 537 pixels valent 53,7 m.
    const found = measured_m(resolution, { x_px: 120, y_px: 40 }, { x_px: 657, y_px: 40 });
    expect(Math.abs(found - 53.7) / 53.7).toBeLessThan(0.01);
  });

  it('restitue une distance oblique à moins de 1 % d’erreur', () => {
    const resolution = calibrate(200, 20);
    // 300 par 400 pixels : 500 pixels d'hypoténuse, donc 50 mètres.
    const found = measured_m(resolution, { x_px: 10, y_px: 10 }, { x_px: 310, y_px: 410 });
    expect(Math.abs(found - 50) / 50).toBeLessThan(0.01);
  });

  it('tient sur un calage à échelle serrée, où l’erreur relative grandit', () => {
    // 41 pixels pour 2 mètres : au-dessus des 40 pixels exigés, et le pire cas
    // praticable. L'écart relatif doit rester sous le pour-cent.
    const resolution = calibrate(41, 2);
    const found = measured_m(resolution, { x_px: 0, y_px: 0 }, { x_px: 410, y_px: 0 });
    expect(Math.abs(found - 20) / 20).toBeLessThan(0.01);
  });
});
