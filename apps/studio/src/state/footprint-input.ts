/**
 * M3 (partie M) — contrôles à la saisie du tracé des empreintes.
 *
 * « Un refus n'efface jamais le travail en cours. Il empêche la validation et
 * dit pourquoi. » C'est la différence entre ces contrôles et ceux de la
 * validation de complétude : ici on juge un contour en cours de tracé, pour
 * dire s'il peut être fermé, et le refus laisse la main.
 *
 * Les prédicats viennent de `core-model` : la validation du site les emploie
 * aussi, et deux implémentations du même test finiraient par diverger — l'écran
 * accepterait un contour que la validation refuse, ou pire, l'opérateur
 * corrigerait un tracé que rien ne reproche.
 */
import type { Finding, Outcome, Point } from '@azimut/core-model';
import {
  POLYGON_MIN_AREA_M2, isSelfIntersecting, quantizePoint, signedArea,
} from '@azimut/core-model';

/** M3 (partie M) : « cellule, circulation, technique, noyau vertical ». */
export const FOOTPRINT_KINDS = ['cell', 'circulation', 'technical', 'vertical_core'] as const;
export type FootprintKind = (typeof FOOTPRINT_KINDS)[number];

/** M3 (partie M) : « Code de cellule | requis, unique par niveau, 1 à 20 caractères ». */
export const UNIT_CODE_MIN = 1;
export const UNIT_CODE_MAX = 20;

export type FootprintDraft = {
  readonly vertices: readonly Point[];
  readonly unitCode: string;
  readonly kind: FootprintKind;
  readonly categoryId: string | null;
};

export type AcceptedFootprint = {
  /** Sommets quantifiés au millimètre (E4). */
  readonly vertices: readonly Point[];
  readonly unitCode: string;
  readonly kind: FootprintKind;
  readonly categoryId: string | null;
  /** M3 (partie M) : « Surface | calculé | lecture seule, m2, 1 décimale ». */
  readonly areaM2: number;
};

export type FootprintContext = {
  /** Les codes déjà portés au niveau, pour l'unicité de M3 (partie M). */
  readonly codesOnLevel: readonly string[];
  /** Les contours déjà tracés au niveau, pour le recouvrement. */
  readonly existing: readonly (readonly Point[])[];
};

/**
 * Juge un contour à la fermeture.
 *
 * Trois refus et un avertissement, exactement ceux de M3 (partie M). Le recouvrement est
 * un avertissement : « Empreintes superposées | avertissement, tracé accepté ».
 */
export function acceptFootprint(
  draft: FootprintDraft,
  context: FootprintContext,
): Outcome<AcceptedFootprint> {
  // E4 : la quantification se fait à la validation du geste, jamais pendant,
  // jamais au rendu. Les contrôles portent donc sur les valeurs quantifiées,
  // celles qui seront écrites — juger l'une et écrire l'autre laisserait
  // passer un contour dégénéré d'un micron.
  const vertices = draft.vertices.map(quantizePoint);
  const findings: Finding[] = [
    ...checkVertices(vertices),
    ...checkUnitCode(draft.unitCode, context.codesOnLevel),
  ];
  if (findings.length > 0) return { ok: false, findings };

  return {
    ok: true,
    value: {
      vertices,
      unitCode: draft.unitCode.trim(),
      kind: draft.kind,
      categoryId: draft.categoryId,
      areaM2: roundToOneDecimal(Math.abs(signedArea(vertices))),
    },
    warnings: [...overlapWarnings(vertices, context.existing)],
  };
}

function checkVertices(vertices: readonly Point[]): readonly Finding[] {
  if (vertices.length < 3) {
    return [finding('GEOM.POLYGON_TOO_FEW_VERTICES', { vertices: vertices.length })];
  }
  if (isSelfIntersecting(vertices)) {
    return [finding('GEOM.POLYGON_SELF_INTERSECTING', { vertices: vertices.length })];
  }
  const area = Math.abs(signedArea(vertices));
  if (area < POLYGON_MIN_AREA_M2) {
    return [finding('GEOM.POLYGON_DEGENERATE', { area_m2: area })];
  }
  return [];
}

function checkUnitCode(code: string, existing: readonly string[]): readonly Finding[] {
  const trimmed = code.trim();
  if (trimmed.length < UNIT_CODE_MIN || trimmed.length > UNIT_CODE_MAX) {
    return [finding('DATA.UNIT_CODE_REQUIRED', {
      length: trimmed.length, min: UNIT_CODE_MIN, max: UNIT_CODE_MAX,
    })];
  }
  // L'unicité se juge sans la casse : « B12 » et « b12 » sont le même local
  // pour quiconque lit un plan.
  const key = trimmed.toLocaleUpperCase('fr');
  if (existing.some(other => other.trim().toLocaleUpperCase('fr') === key)) {
    return [finding('DATA.CODE_DUPLICATE', { code: trimmed })];
  }
  return [];
}

/**
 * M3 (partie M) : « Empreintes superposées | `GEOM.FOOTPRINTS_OVERLAP` | Avertissement,
 * tracé accepté. » Un recouvrement est parfois voulu — une mezzanine, un
 * volume traversant — donc il se signale sans refuser.
 */
function overlapWarnings(
  vertices: readonly Point[],
  existing: readonly (readonly Point[])[],
): readonly Finding[] {
  const overlapping = existing.filter(other => polygonsOverlap(vertices, other));
  return overlapping.length === 0
    ? []
    : [{
        code: 'GEOM.FOOTPRINTS_OVERLAP',
        severity: 'warning',
        entity: null,
        params: { overlaps: overlapping.length },
        ruleRef: null,
      }];
}

/**
 * Recouvrement : deux arêtes se croisent, ou l'un des contours contient un
 * sommet de l'autre — le second cas attrape l'empreinte entièrement incluse,
 * dont aucune arête ne croise celles de l'autre.
 */
function polygonsOverlap(a: readonly Point[], b: readonly Point[]): boolean {
  for (let i = 0; i < a.length; i += 1) {
    const p1 = a[i];
    const p2 = a[(i + 1) % a.length];
    if (p1 === undefined || p2 === undefined) continue;
    for (let j = 0; j < b.length; j += 1) {
      const p3 = b[j];
      const p4 = b[(j + 1) % b.length];
      if (p3 === undefined || p4 === undefined) continue;
      if (crossesStrictly(p1, p2, p3, p4)) return true;
    }
  }
  const firstA = a[0];
  const firstB = b[0];
  return (firstA !== undefined && pointInPolygon(firstA, b))
    || (firstB !== undefined && pointInPolygon(firstB, a));
}

function crossesStrictly(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d = (q: Point, r: Point, s: Point): number =>
    (r.x_m - q.x_m) * (s.y_m - q.y_m) - (r.y_m - q.y_m) * (s.x_m - q.x_m);
  const d1 = d(p3, p4, p1);
  const d2 = d(p3, p4, p2);
  const d3 = d(p1, p2, p3);
  const d4 = d(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0))
    && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function pointInPolygon(pt: Point, vertices: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i, i += 1) {
    const a = vertices[i];
    const b = vertices[j];
    if (a === undefined || b === undefined) continue;
    const straddles = (a.y_m > pt.y_m) !== (b.y_m > pt.y_m);
    if (!straddles) continue;
    const x = (b.x_m - a.x_m) * (pt.y_m - a.y_m) / (b.y_m - a.y_m) + a.x_m;
    if (pt.x_m < x) inside = !inside;
  }
  return inside;
}

/** M3 (partie M) : la surface s'affiche à une décimale. */
function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function finding(code: string, params: Record<string, string | number>): Finding {
  return { code, severity: 'blocking', entity: null, params, ruleRef: 'partieM-M3 (partie M)' };
}
