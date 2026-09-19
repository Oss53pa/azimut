/**
 * Tranche M · écran M2 — calage d'un fond de plan.
 *
 * Les anomalies d'ici citent `partieM-M2`, et non `M2` : le complément
 * atelier emploie `M2` pour son module de stationnement, et un jeton nu ne
 * dirait pas laquelle des deux règles est opposée.
 *
 * Deux points posés sur le fond et une distance réelle donnent la résolution
 * du fond ; l'azimut du nord donne son orientation. Tant que l'orientation
 * n'est pas saisie, le tracé des empreintes reste refusé (CALIB.NORTH_MISSING) :
 * une empreinte tracée sur un fond non orienté est fausse sans que rien ne le
 * signale.
 *
 * Aucune valeur d'origine normative ici. La plage de vraisemblance est un
 * garde-fou de saisie, pas un seuil réglementaire : elle est passée en
 * argument, avec une valeur par défaut déclarée et commentée.
 */
import type { Finding, Outcome } from '@azimut/core-model';
import { roundHalfAwayFromZero } from '@azimut/core-model';

export type PlanPoint = {
  readonly x_px: number;
  readonly y_px: number;
};

/**
 * Plage de vraisemblance d'une résolution de fond de plan, en pixels par
 * mètre réel. En deçà, un plan de bâtiment tiendrait dans une vignette ; au
 * delà, un mètre occuperait une image entière. Ce n'est pas une norme, c'est
 * la détection d'une distance saisie dans la mauvaise unité.
 */
export const DEFAULT_PLAUSIBLE_RESOLUTION = {
  min_px_per_m: 0.05,
  max_px_per_m: 500,
} as const;

/**
 * Écart minimal entre les deux points, en pixels. En deçà, l'erreur de pose
 * du curseur pèse plus lourd que la mesure elle-même.
 */
export const MIN_POINT_SEPARATION_PX = 20;

/**
 * Densité du fond en pixels par millimètre de papier. Un PDF exporté à
 * 1 px = 1 mm vaut 1 ; toute autre densité est déclarée par l'appelant, jamais
 * devinée à partir du fichier.
 */
export const DEFAULT_PAPER_DENSITY_PX_PER_MM = 1;

export type CalibrationInput = {
  readonly a: PlanPoint;
  readonly b: PlanPoint;
  readonly real_distance_m: number;
  readonly north_azimuth_deg: number | null;
  readonly paper_density_px_per_mm?: number;
  readonly plausible?: { readonly min_px_per_m: number; readonly max_px_per_m: number };
};

export type Calibration = {
  /** Écart entre les deux points, en pixels du fond. */
  readonly pixel_distance: number;
  /** Résolution du fond : pixels par mètre réel. */
  readonly resolution_px_per_m: number;
  /** Dénominateur de l'échelle de plan : 1:N. */
  readonly scale_denominator: number;
  readonly north_azimuth_deg: number;
};

function pixelDistance(a: PlanPoint, b: PlanPoint): number {
  return Math.hypot(b.x_px - a.x_px, b.y_px - a.y_px);
}

/**
 * Calcule le calage. Rend une anomalie bloquante quand la mesure ne peut pas
 * être exploitée, et un avertissement CALIB.SCALE_IMPLAUSIBLE quand elle l'est
 * mais sort de la plage de vraisemblance — l'opérateur peut passer outre, et
 * le passage outre reste visible.
 */
export function computeCalibration(input: CalibrationInput): Outcome<Calibration> {
  const findings: Finding[] = [];

  if (input.real_distance_m <= 0) {
    findings.push({
      code: 'CALIB.DISTANCE_INVALID',
      severity: 'blocking',
      entity: null,
      params: { real_distance_m: input.real_distance_m },
      ruleRef: 'partieM-M2',
    });
  }

  const pixels = pixelDistance(input.a, input.b);
  if (pixels < MIN_POINT_SEPARATION_PX) {
    findings.push({
      code: 'CALIB.POINTS_TOO_CLOSE',
      severity: 'blocking',
      entity: null,
      params: { pixel_distance: roundHalfAwayFromZero(pixels), minimum: MIN_POINT_SEPARATION_PX },
      ruleRef: 'partieM-M2',
    });
  }

  if (input.north_azimuth_deg === null) {
    findings.push({
      code: 'CALIB.NORTH_MISSING',
      severity: 'blocking',
      entity: null,
      params: {},
      ruleRef: 'partieM-M2',
    });
  }

  if (findings.length > 0) return { ok: false, findings };

  const resolution = pixels / input.real_distance_m;
  const density = input.paper_density_px_per_mm ?? DEFAULT_PAPER_DENSITY_PX_PER_MM;
  const plausible = input.plausible ?? DEFAULT_PLAUSIBLE_RESOLUTION;

  const warnings: Finding[] = [];
  if (resolution < plausible.min_px_per_m || resolution > plausible.max_px_per_m) {
    warnings.push({
      code: 'CALIB.SCALE_IMPLAUSIBLE',
      severity: 'warning',
      entity: null,
      params: {
        resolution_px_per_m: resolution,
        min_px_per_m: plausible.min_px_per_m,
        max_px_per_m: plausible.max_px_per_m,
      },
      ruleRef: 'partieM-M2',
    });
  }

  // 1 mm de papier vaut N mm réels. Un mètre réel occupe resolution/density
  // millimètres de papier, donc N = 1000 × densité / résolution.
  const denominator = roundHalfAwayFromZero((1000 * density) / resolution);

  return {
    ok: true,
    value: {
      pixel_distance: pixels,
      resolution_px_per_m: resolution,
      scale_denominator: denominator,
      // Le bloc de garde ci-dessus a déjà écarté le cas nul.
      north_azimuth_deg: input.north_azimuth_deg ?? 0,
    },
    warnings,
  };
}
