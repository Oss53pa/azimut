import { describe, it, expect } from 'vitest';
import {
  fitMeasuredCalibration,
  auditCalibrationResiduals,
  applyAffine,
  MIN_CONTROL_POINTS,
} from '../affine-calibration.js';
import type { ControlPointPair, AffineTransform } from '../affine-calibration.js';

/** Construit des paires en appliquant une transformation connue, sans bruit. */
function pairsFrom(
  transform: AffineTransform,
  sources: readonly (readonly [number, number])[],
): ControlPointPair[] {
  return sources.map(([x_px, y_px], i) => ({
    id: `p${i}`,
    source: { x_px, y_px },
    target: applyAffine(transform, { x_px, y_px }),
  }));
}

/** Une similitude simple : 0,01 m par pixel, quart de tour, translation. */
const SIMILARITY: AffineTransform = { a: 0, b: -0.01, c: 12, d: 0.01, e: 0, f: -3 };

/** Une affine avec cisaillement, que le calage à deux points ne sait pas rendre. */
const SHEARED: AffineTransform = { a: 0.02, b: 0.004, c: -5, d: -0.001, e: 0.018, f: 40 };

const SOURCES = [
  [0, 0],
  [4000, 0],
  [4000, 2800],
  [0, 2800],
  [1500, 900],
] as const;

describe('fitMeasuredCalibration', () => {
  it('retrouve exactement une transformation connue sans bruit', () => {
    const result = fitMeasuredCalibration(pairsFrom(SHEARED, SOURCES));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { transform } = result.value;
    expect(transform.a).toBeCloseTo(SHEARED.a, 12);
    expect(transform.b).toBeCloseTo(SHEARED.b, 12);
    expect(transform.c).toBeCloseTo(SHEARED.c, 9);
    expect(transform.d).toBeCloseTo(SHEARED.d, 12);
    expect(transform.e).toBeCloseTo(SHEARED.e, 12);
    expect(transform.f).toBeCloseTo(SHEARED.f, 9);
  });

  it('rend un résidu nul quand les points sont exacts', () => {
    const result = fitMeasuredCalibration(pairsFrom(SIMILARITY, SOURCES));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.mean_residual_m).toBeLessThan(1e-9);
    expect(result.value.max_residual_m).toBeLessThan(1e-9);
    expect(result.value.control_point_count).toBe(SOURCES.length);
  });

  it('absorbe un cisaillement que quatre paramètres ne rendraient pas', () => {
    // Une similitude a une échelle isotrope et des axes orthogonaux. Sur
    // SHEARED, ni l'un ni l'autre : a·b + d·e n'est pas nul. Un calage à deux
    // points laisserait donc un résidu, l'affine non.
    const orthogonality = SHEARED.a * SHEARED.b + SHEARED.d * SHEARED.e;
    expect(Math.abs(orthogonality)).toBeGreaterThan(1e-6);

    const result = fitMeasuredCalibration(pairsFrom(SHEARED, SOURCES));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.max_residual_m).toBeLessThan(1e-9);
  });

  it('ne localise pas le point fautif : les moindres carrés étalent l’erreur', () => {
    // Propriété à connaître avant de lire un tableau de résidus. Un point
    // homologue grossièrement mal posé ne se trahit pas par un résidu plus
    // grand que les autres : l'ajustement déplace la transformation pour le
    // suivre en partie, et répartit ce qui reste sur tout le nuage.
    //
    // Sur quatre coins dont un déplacé d'un mètre, le résidu vaut exactement
    // un quart de mètre sur chacun des quatre. Le fautif est indiscernable.
    const corners = pairsFrom(SIMILARITY, SOURCES.slice(0, 4)).map((pair, i) =>
      i === 2
        ? { ...pair, target: { x_m: pair.target.x_m + 1, y_m: pair.target.y_m } }
        : pair,
    );

    const result = fitMeasuredCalibration(corners);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (const residual of result.value.residuals) {
      expect(residual.residual_m).toBeCloseTo(0.25, 9);
    }
    expect(result.value.max_residual_m).toBeCloseTo(0.25, 9);
  });

  it('un point déplacé ne porte pas forcément le plus gros résidu', () => {
    // Même erreur, un point de plus au centre : le résidu maximal passe à un
    // point sain. Un écran qui marquerait « le » point rouge comme fautif
    // désignerait ici le mauvais.
    const pairs = pairsFrom(SIMILARITY, SOURCES).map((pair, i) =>
      i === 2
        ? { ...pair, target: { x_m: pair.target.x_m + 1, y_m: pair.target.y_m } }
        : pair,
    );

    const result = fitMeasuredCalibration(pairs);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const worst = [...result.value.residuals].sort((l, r) => r.residual_m - l.residual_m)[0];
    expect(worst?.id).not.toBe('p2');
    // Tous les points portent l'erreur, aucun ne la porte entière.
    for (const residual of result.value.residuals) {
      expect(residual.residual_m).toBeLessThan(1);
    }
  });

  it('refuse moins de trois paires', () => {
    const result = fitMeasuredCalibration(pairsFrom(SIMILARITY, SOURCES.slice(0, 2)));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('CALIB.CONTROL_POINTS_INSUFFICIENT');
    expect(result.findings[0]?.params['minimum']).toBe(MIN_CONTROL_POINTS);
  });

  it('refuse des points alignés', () => {
    const aligned = pairsFrom(SIMILARITY, [
      [0, 0],
      [1000, 500],
      [2000, 1000],
      [3000, 1500],
    ]);
    const result = fitMeasuredCalibration(aligned);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('CALIB.CONTROL_POINTS_COLLINEAR');
  });

  it('refuse des points confondus', () => {
    const same = pairsFrom(SIMILARITY, [
      [700, 700],
      [700, 700],
      [700, 700],
    ]);
    const result = fitMeasuredCalibration(same);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('CALIB.CONTROL_POINTS_COLLINEAR');
  });

  it('est déterministe : deux ajustements du même état donnent le même résultat', () => {
    const pairs = pairsFrom(SHEARED, SOURCES);
    const first = fitMeasuredCalibration(pairs);
    const second = fitMeasuredCalibration(pairs);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('reste stable sur de grandes coordonnées de fond A0', () => {
    // Un A0 à 600 ppp approche 50 000 pixels de large. Sans centrage, les
    // équations normales y perdraient leurs décimales utiles.
    const wide = pairsFrom(SHEARED, [
      [0, 0],
      [49000, 0],
      [49000, 34000],
      [0, 34000],
    ]);
    const result = fitMeasuredCalibration(wide);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.max_residual_m).toBeLessThan(1e-6);
  });
});

describe('auditCalibrationResiduals', () => {
  const tolerance = { mean_m: 0.1, point_m: 0.2 };

  function fitOf(pairs: readonly ControlPointPair[]) {
    const result = fitMeasuredCalibration(pairs);
    if (!result.ok) throw new Error('ajustement refusé');
    return result.value;
  }

  it('ne rend rien quand le calage tient dans les tolérances', () => {
    expect(auditCalibrationResiduals(fitOf(pairsFrom(SIMILARITY, SOURCES)), tolerance)).toEqual([]);
  });

  it('signale le résidu moyen et nomme le point hors tolérance', () => {
    const pairs = pairsFrom(SIMILARITY, SOURCES).map((pair, i) =>
      i === 1
        ? { ...pair, target: { x_m: pair.target.x_m, y_m: pair.target.y_m + 2 } }
        : pair,
    );

    const findings = auditCalibrationResiduals(fitOf(pairs), tolerance);
    expect(findings.some((f) => f.code === 'CALIB.RESIDUAL_MEAN_EXCEEDED')).toBe(true);

    const perPoint = findings.filter((f) => f.code === 'CALIB.RESIDUAL_POINT_EXCEEDED');
    expect(perPoint.length).toBeGreaterThan(0);
    expect(perPoint.some((f) => f.entity?.id === 'p1')).toBe(true);
    expect(perPoint[0]?.entity?.kind).toBe('control_point');
  });

  it('rapporte les résidus en millimètres entiers', () => {
    const pairs = pairsFrom(SIMILARITY, SOURCES).map((pair, i) =>
      i === 1
        ? { ...pair, target: { x_m: pair.target.x_m, y_m: pair.target.y_m + 2 } }
        : pair,
    );

    for (const finding of auditCalibrationResiduals(fitOf(pairs), tolerance)) {
      for (const value of Object.values(finding.params)) {
        expect(Number.isInteger(value)).toBe(true);
      }
    }
  });

  it('un calage hors tolérance reste lisible : l’ajustement rend ses résidus', () => {
    // C'est la raison d'être de la séparation entre ajustement et recette.
    const pairs = pairsFrom(SIMILARITY, SOURCES).map((pair, i) =>
      i === 3 ? { ...pair, target: { x_m: pair.target.x_m + 9, y_m: pair.target.y_m } } : pair,
    );
    const fit = fitOf(pairs);
    expect(fit.residuals).toHaveLength(SOURCES.length);
    expect(auditCalibrationResiduals(fit, tolerance).length).toBeGreaterThan(0);
  });
});
