/**
 * Tranche M · écran M2 — calage d'un fond de plan.
 *
 * Les anomalies d'ici citent `partieM-M2`, et non `M2` : le complément
 * atelier emploie `M2` pour son module de stationnement, et un jeton nu ne
 * dirait pas laquelle des deux règles est opposée.
 *
 * Deux points posés sur le fond et une distance réelle donnent la résolution
 * du fond ; l'azimut du nord donne son orientation. Tant que l'orientation
 * n'est pas saisie, le tracé des empreintes reste refusé (CALIB.AZIMUTH_INVALID) :
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
 * Écart minimal entre les deux points, en pixels.
 *
 * M2 (partie M), étape 2 : « Point B, requis, distinct de A d'au moins
 * 40 pixels ». La valeur était de 20 dans ce fichier, soit la moitié : elle
 * avait été posée avant que la partie M ne soit versée au dépôt.
 *
 * Le motif tient : en deçà, l'erreur de pose du curseur pèse plus lourd que la
 * mesure elle-même.
 */
export const MIN_POINT_SEPARATION_PX = 40;

/**
 * Densité du fond en pixels par millimètre de papier. Un PDF exporté à
 * 1 px = 1 mm vaut 1 ; toute autre densité est déclarée par l'appelant, jamais
 * devinée à partir du fichier.
 */
export const DEFAULT_PAPER_DENSITY_PX_PER_MM = 1;

export type CalibrationInput = {
  /**
   * M2 (partie M), étape 2 : les deux points sont requis, et un point non posé
   * lève `CALIB.POINT_REQUIRED`. Ils sont donc nullables : sans cela, l'écran
   * devait inventer une coordonnée pour appeler ce calcul, et l'absence se
   * serait confondue avec un clic à l'origine du fond.
   */
  readonly a: PlanPoint | null;
  readonly b: PlanPoint | null;
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

  // M2 (partie M), étape 2 : « Point A, clic dans la zone de travail, requis »
  // et « Point B, requis, distinct de A d'au moins 40 pixels ».
  const missing = [
    ...(input.a === null ? ['a'] : []),
    ...(input.b === null ? ['b'] : []),
  ];
  if (missing.length > 0) {
    findings.push({
      code: 'CALIB.POINT_REQUIRED',
      severity: 'blocking',
      entity: null,
      params: { missing: missing.join(',') },
      ruleRef: 'partieM-M2',
    });
  }

  // L'écart ne se mesure que si les deux points sont posés : le mesurer sur un
  // point absent produirait une seconde anomalie qui dit la même chose.
  const pixels = input.a !== null && input.b !== null
    ? pixelDistance(input.a, input.b)
    : null;
  if (pixels !== null && pixels < MIN_POINT_SEPARATION_PX) {
    findings.push({
      code: 'CALIB.POINTS_TOO_CLOSE',
      severity: 'blocking',
      entity: null,
      params: { pixel_distance: roundHalfAwayFromZero(pixels), minimum: MIN_POINT_SEPARATION_PX },
      ruleRef: 'partieM-M2',
    });
  }

  // M2 (partie M), étape 3 : « Azimut du nord, numérique, degrés, 0 à 360
  // exclus, convention compas » → `CALIB.AZIMUTH_INVALID`. Le domaine est
  // celui de D1.3, [0, 360[ : un azimut de 0 est le nord franc et se saisit.
  // Un azimut absent et un azimut hors domaine lèvent le même code, la partie
  // M n'en distinguant pas deux.
  const azimuth = input.north_azimuth_deg;
  if (azimuth === null || !Number.isFinite(azimuth) || azimuth < 0 || azimuth >= 360) {
    findings.push({
      code: 'CALIB.AZIMUTH_INVALID',
      severity: 'blocking',
      entity: null,
      params: azimuth === null ? { given: 'none' } : { given: azimuth },
      ruleRef: 'partieM-M2',
    });
  }

  if (findings.length > 0) return { ok: false, findings };

  // Les contrôles ci-dessus ont déjà écarté ces trois cas. Le redire au typage
  // plutôt que de forcer une valeur par défaut : un `?? 0` survivrait en
  // silence à une régression de ces contrôles et rendrait un calage faux.
  if (pixels === null || azimuth === null) {
    return { ok: false, findings: [{
      code: 'CALIB.POINT_REQUIRED',
      severity: 'blocking',
      entity: null,
      params: { missing: 'unreachable' },
      ruleRef: 'partieM-M2',
    }] };
  }

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
      north_azimuth_deg: azimuth,
    },
    warnings,
  };
}
