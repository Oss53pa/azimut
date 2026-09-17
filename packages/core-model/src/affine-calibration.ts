/**
 * Calage mesuré d'un fond de plan — complément atelier, M1.4.
 *
 * Le calage à deux points (écran M2 de la tranche M, `plan-calibration` côté
 * atelier) donne une résolution et une orientation. Il ne dit rien de l'erreur
 * commise : un fond légèrement déformé, un scan de travers ou un plan
 * d'architecte recomposé se calent sans que rien ne le signale.
 *
 * Le calage mesuré répond à cela. L'opérateur pose au moins trois paires de
 * points homologues — un point du fond, le même point dans le repère métier du
 * niveau — et l'ajustement rend, avec la transformation, le résidu de chaque
 * point en mètres. Le résidu est la mesure de ce que le calage ne sait pas
 * représenter.
 *
 * Deux fonctions, et la séparation entre elles est volontaire :
 *
 * - `fitMeasuredCalibration` ajuste. Elle ne connaît aucun seuil et n'échoue
 *   que lorsque aucune transformation n'existe : moins de trois points, ou
 *   points alignés.
 * - `auditCalibrationResiduals` juge, avec les tolérances que l'appelant lui
 *   passe.
 *
 * Cette séparation n'est pas de l'élégance. Un calage hors tolérance doit
 * rester affichable pour que l'opérateur voie *quel* point est en rouge et le
 * reprenne (M1.4). Un ajustement qui refuserait de rendre ses résidus ne
 * laisserait rien à corriger.
 *
 * Aucun seuil n'est écrit ici. Les tolérances de résidu sont des arguments
 * obligatoires, sans valeur par défaut : la section 21 du complément en propose
 * (0,25 m en moyenne et 0,5 m par point, resserrées à 0,10 m et 0,20 m), mais
 * leur origine — norme opposable ou paramètre de produit — n'est pas tranchée.
 * Tant qu'elle ne l'est pas, INV-5 interdit de les inscrire dans le code, et un
 * défaut implicite trancherait en silence.
 */
import type { Point } from './geometry.js';
import type { Finding, Outcome } from './outcome.js';
import { roundMm } from './round.js';

/** Un point du fond de plan, dans les pixels du fichier source. */
export type PlanPixelPoint = {
  readonly x_px: number;
  readonly y_px: number;
};

/**
 * Une paire de points homologues : le même lieu physique, désigné une fois sur
 * le fond et une fois dans le repère métier du niveau (D1.1, mètres).
 */
export type ControlPointPair = {
  /** Identité stable, pour désigner le point fautif à l'opérateur. */
  readonly id: string;
  readonly source: PlanPixelPoint;
  readonly target: Point;
};

/**
 * Transformation affine du fond vers le repère métier, les six réels de M1.4 :
 *
 *   x_m = a·x_px + b·y_px + c
 *   y_m = d·x_px + e·y_px + f
 *
 * Six réels et non quatre : contrairement au calage à deux points, cette forme
 * absorbe le cisaillement et l'anisotropie d'échelle, qui sont précisément les
 * déformations qu'un plan recomposé présente.
 */
export type AffineTransform = {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
};

/** Résidu d'un point homologue : l'écart que l'ajustement laisse. */
export type ControlPointResidual = {
  readonly id: string;
  readonly residual_m: number;
};

export type MeasuredCalibration = {
  readonly transform: AffineTransform;
  /** Un résidu par paire, dans l'ordre où les paires ont été fournies. */
  readonly residuals: readonly ControlPointResidual[];
  readonly mean_residual_m: number;
  readonly max_residual_m: number;
  readonly control_point_count: number;
};

/** Tolérances de recette d'un calage. Fournies par l'appelant, jamais devinées. */
export type ResidualTolerance = {
  readonly mean_m: number;
  readonly point_m: number;
};

/**
 * Trois paires au minimum, comme M1.4 le demande : en deçà, l'affine n'est pas
 * déterminée.
 *
 * Mais trois paires ne suffisent pas à *mesurer*. Chaque paire donne deux
 * équations et l'affine compte six inconnues : à trois points, le système est
 * exactement déterminé, l'ajustement passe par les trois points, et le résidu
 * vaut zéro quelle que soit la qualité de la saisie. Un opérateur qui pose trois
 * points de travers lit un résidu nul et croit son calage parfait.
 *
 * Le résidu ne devient une mesure qu'à partir de la quatrième paire, où deux
 * degrés de liberté restent pour le porter. `fitMeasuredCalibration` le
 * signale.
 */
export const MIN_CONTROL_POINTS = 3;

/**
 * Nombre de paires à partir duquel le résidu mesure quelque chose. Ce n'est pas
 * un seuil de recette, c'est le rang à partir duquel le système est surdéterminé.
 */
export const MEASURING_CONTROL_POINTS = MIN_CONTROL_POINTS + 1;

/**
 * Garde d'alignement. Après centrage, `det / (Suu · Svv)` vaut le sinus carré
 * de l'angle entre les deux directions du nuage : 1 pour un nuage bien réparti,
 * 0 pour des points parfaitement alignés. Le seuil ne rejette que
 * l'alignement vrai, à la précision du calcul flottant près ; il ne juge pas la
 * qualité d'une répartition. Ce n'est pas un seuil d'origine normative, c'est
 * la limite en deçà de laquelle le système n'a pas de solution unique.
 */
const COLLINEARITY_GUARD = 1e-9;

/** Applique la transformation à un point du fond. */
export function applyAffine(transform: AffineTransform, source: PlanPixelPoint): Point {
  return {
    x_m: transform.a * source.x_px + transform.b * source.y_px + transform.c,
    y_m: transform.d * source.x_px + transform.e * source.y_px + transform.f,
  };
}

type Centroid = {
  readonly sx: number;
  readonly sy: number;
  readonly tx: number;
  readonly ty: number;
};

function centroidOf(pairs: readonly ControlPointPair[]): Centroid {
  let sx = 0;
  let sy = 0;
  let tx = 0;
  let ty = 0;
  for (const pair of pairs) {
    sx += pair.source.x_px;
    sy += pair.source.y_px;
    tx += pair.target.x_m;
    ty += pair.target.y_m;
  }
  const n = pairs.length;
  return { sx: sx / n, sy: sy / n, tx: tx / n, ty: ty / n };
}

/**
 * Ajuste la transformation affine au sens des moindres carrés.
 *
 * Le calcul est mené sur les coordonnées centrées sur leur barycentre. Ce n'est
 * pas une optimisation : les abscisses d'un fond A0 se comptent en dizaines de
 * milliers de pixels, et les équations normales élèvent au carré. Centrer
 * annule le terme constant, ramène le système à deux inconnues par axe, et
 * évite de soustraire deux grands nombres presque égaux. La translation se
 * retrouve ensuite par les barycentres, exactement.
 *
 * Les deux axes partagent la même matrice normale et ne diffèrent que par le
 * second membre : une seule passe sur les points suffit aux sept sommes.
 */
export function fitMeasuredCalibration(
  pairs: readonly ControlPointPair[],
): Outcome<MeasuredCalibration> {
  if (pairs.length < MIN_CONTROL_POINTS) {
    return {
      ok: false,
      findings: [
        {
          code: 'CALIB.CONTROL_POINTS_INSUFFICIENT',
          severity: 'blocking',
          entity: null,
          params: { count: pairs.length, minimum: MIN_CONTROL_POINTS },
          ruleRef: 'atelier-M1.4',
        },
      ],
    };
  }

  const centroid = centroidOf(pairs);

  let suu = 0;
  let svv = 0;
  let suv = 0;
  let sup = 0;
  let svp = 0;
  let suq = 0;
  let svq = 0;

  for (const pair of pairs) {
    const u = pair.source.x_px - centroid.sx;
    const v = pair.source.y_px - centroid.sy;
    const p = pair.target.x_m - centroid.tx;
    const q = pair.target.y_m - centroid.ty;
    suu += u * u;
    svv += v * v;
    suv += u * v;
    sup += u * p;
    svp += v * p;
    suq += u * q;
    svq += v * q;
  }

  const scatter = suu * svv;
  const det = scatter - suv * suv;
  if (scatter <= 0 || det <= COLLINEARITY_GUARD * scatter) {
    return {
      ok: false,
      findings: [
        {
          code: 'CALIB.CONTROL_POINTS_COLLINEAR',
          severity: 'blocking',
          entity: null,
          params: { count: pairs.length },
          ruleRef: 'atelier-M1.4',
        },
      ],
    };
  }

  const a = (sup * svv - suv * svp) / det;
  const b = (suu * svp - sup * suv) / det;
  const d = (suq * svv - suv * svq) / det;
  const e = (suu * svq - suq * suv) / det;
  const transform: AffineTransform = {
    a,
    b,
    c: centroid.tx - a * centroid.sx - b * centroid.sy,
    d,
    e,
    f: centroid.ty - d * centroid.sx - e * centroid.sy,
  };

  const residuals: ControlPointResidual[] = [];
  let total = 0;
  let max = 0;
  for (const pair of pairs) {
    const fitted = applyAffine(transform, pair.source);
    const residual = Math.hypot(fitted.x_m - pair.target.x_m, fitted.y_m - pair.target.y_m);
    residuals.push({ id: pair.id, residual_m: residual });
    total += residual;
    if (residual > max) max = residual;
  }

  const warnings: Finding[] = [];
  if (pairs.length < MEASURING_CONTROL_POINTS) {
    warnings.push({
      code: 'CALIB.RESIDUAL_NOT_MEASURED',
      severity: 'warning',
      entity: null,
      params: { count: pairs.length, measuring_minimum: MEASURING_CONTROL_POINTS },
      ruleRef: 'atelier-M1.4',
    });
  }

  return {
    ok: true,
    value: {
      transform,
      residuals,
      mean_residual_m: total / pairs.length,
      max_residual_m: max,
      control_point_count: pairs.length,
    },
    warnings,
  };
}

/**
 * Confronte un calage ajusté à ses tolérances de recette.
 *
 * Rend une anomalie par point hors tolérance, en plus de celle du résidu moyen,
 * pour que l'écran sache lesquels marquer (M1.4). Une liste vide vaut calage
 * accepté. Les résidus sont rapportés en millimètres entiers, par D1.4 : un
 * résidu s'annonce au millimètre, pas avec quinze décimales.
 *
 * **Un point marqué n'est pas un point fautif.** Les moindres carrés déplacent
 * la transformation pour suivre en partie chaque point, y compris un point mal
 * posé, et répartissent le reste sur tout le nuage. Sur quatre coins dont un
 * déplacé d'un mètre, le résidu vaut un quart de mètre sur les quatre ; avec un
 * cinquième point, le résidu maximal se trouve sur un point sain. Le marquage
 * dit « ce calage ne tient pas », jamais « c'est ce point-là qu'il faut
 * reprendre ». Un écran qui présenterait le point rouge comme le coupable
 * désignerait régulièrement le mauvais.
 */
export function auditCalibrationResiduals(
  calibration: MeasuredCalibration,
  tolerance: ResidualTolerance,
): Finding[] {
  const findings: Finding[] = [];

  if (calibration.mean_residual_m > tolerance.mean_m) {
    findings.push({
      code: 'CALIB.RESIDUAL_MEAN_EXCEEDED',
      severity: 'blocking',
      entity: null,
      params: {
        mean_residual_mm: roundMm(calibration.mean_residual_m * 1000),
        tolerance_mm: roundMm(tolerance.mean_m * 1000),
      },
      ruleRef: 'atelier-M1.4',
    });
  }

  for (const residual of calibration.residuals) {
    if (residual.residual_m > tolerance.point_m) {
      findings.push({
        code: 'CALIB.RESIDUAL_POINT_EXCEEDED',
        severity: 'blocking',
        entity: { kind: 'control_point', id: residual.id },
        params: {
          residual_mm: roundMm(residual.residual_m * 1000),
          tolerance_mm: roundMm(tolerance.point_m * 1000),
        },
        ruleRef: 'atelier-M1.4',
      });
    }
  }

  return findings;
}
