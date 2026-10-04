import type { Point } from '@azimut/core-model';
import { codePointCompare, quantizePoint } from '@azimut/core-model';
import { fitEllipse, fitPolygon, fitSegment } from './fit-shapes.js';
import type { EllipseFit } from './fit-shapes.js';
import { RECOGNITION_THRESHOLDS } from './recognition-thresholds.js';
import type { Strictness } from './recognition-thresholds.js';
import {
  centroid, chordDeviation, crossesOutline, distance, pathLength, pointInPolygon,
} from './stroke-geometry.js';

/**
 * J1 (partie J) — reconnaissance de forme : « l'encre est une méthode de
 * saisie, pas une donnée ».
 *
 * À la levée du stylet, le trait est analysé et rend ses candidates, de la
 * plus probable à la moins probable. La plus probable est appliquée, les
 * autres restent accessibles en un geste (J1.1, arbitrage). Toute candidate est
 * déjà quantifiée au millimètre : une forme tracée au stylet et la même tracée
 * à la souris donnent des données strictement identiques.
 *
 * Ce que la reconnaissance ne fait pas (J2) : elle ne devine pas la nature
 * métier d'une forme — c'est l'outil actif qui en décide —, ne reconstruit pas
 * un plan, ne lit pas l'écriture.
 *
 * Aucune candidate ne supprime par défaut : un trait qui barre une forme
 * propose la suppression en seconde position, derrière le segment qu'il
 * dessine. Une suppression appliquée par erreur coûterait plus qu'un geste
 * d'arbitrage.
 */

export type InkNode = { readonly id: string; readonly at: Point };
export type InkShape = { readonly id: string; readonly outline: readonly Point[] };

export type InkContext = {
  /** Échelle de la vue au moment du tracé : pixels écran par mètre. */
  readonly pxPerMeter: number;
  readonly strictness: Strictness;
  /** Pas des angles remarquables, en degrés. */
  readonly angleStep_deg: number;
  /** Tolérance de sélection du pointeur employé, en pixels (G3.2). */
  readonly hit_px: number;
  /** Les nœuds déjà posés, pour reconnaître une arête. */
  readonly nodes: readonly InkNode[];
  /** Les formes déjà posées, pour reconnaître une suppression ou une sélection. */
  readonly shapes: readonly InkShape[];
};

export type InkCandidate =
  | { readonly kind: 'node'; readonly at: Point }
  | { readonly kind: 'segment'; readonly from: Point; readonly to: Point; readonly constraint: 'free' | 'axis' | 'angle' }
  | { readonly kind: 'edge'; readonly fromNodeId: string; readonly toNodeId: string }
  | { readonly kind: 'polygon'; readonly vertices: readonly Point[] }
  | { readonly kind: 'rectangle'; readonly vertices: readonly Point[] }
  | ({ readonly kind: 'ellipse' } & Omit<EllipseFit, 'error'>)
  | { readonly kind: 'strike'; readonly shapeIds: readonly string[] }
  | { readonly kind: 'lasso'; readonly shapeIds: readonly string[]; readonly nodeIds: readonly string[] };

/** Le nœud le plus proche d'un point, s'il est à portée du pointeur. */
function nodeNear(at: Point, context: InkContext): InkNode | null {
  let best: InkNode | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const node of context.nodes) {
    const d = distance(at, node.at) * context.pxPerMeter;
    if (d <= context.hit_px && (d < bestDistance || (d === bestDistance && best !== null
      && codePointCompare(node.id, best.id) < 0))) {
      best = node;
      bestDistance = d;
    }
  }
  return best;
}

function sortedIds<T extends { readonly id: string }>(items: readonly T[]): readonly string[] {
  return items.map(item => item.id).sort(codePointCompare);
}

function recognizeOpen(points: readonly Point[], context: InkContext): readonly InkCandidate[] {
  const limits = RECOGNITION_THRESHOLDS[context.strictness];
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) return [];
  const candidates: InkCandidate[] = [];

  // « Trait rejoignant deux formes » : une arête entre deux nœuds distincts.
  const from = nodeNear(first, context);
  const to = nodeNear(last, context);
  if (from !== null && to !== null && from.id !== to.id) {
    candidates.push({ kind: 'edge', fromNodeId: from.id, toNodeId: to.id });
  }

  if (chordDeviation(points) <= limits.straightness) {
    candidates.push({
      kind: 'segment',
      ...fitSegment(first, last, { ...limits, angleStep_deg: context.angleStep_deg }),
    });
    // « Trait barrant une forme » : les deux bouts hors de la forme, le trait
    // en traverse le contour.
    const struck = context.shapes.filter(shape =>
      !pointInPolygon(first, shape.outline) && !pointInPolygon(last, shape.outline)
      && crossesOutline(first, last, shape.outline));
    if (struck.length > 0) candidates.push({ kind: 'strike', shapeIds: sortedIds(struck) });
  }
  return candidates;
}

function recognizeClosed(points: readonly Point[], context: InkContext): readonly InkCandidate[] {
  const limits = RECOGNITION_THRESHOLDS[context.strictness];
  const ring = points.slice(0, -1);

  const shapes: InkCandidate[] = [];
  const polygon = fitPolygon(ring, { ...limits, vertex_m: limits.vertex_px / context.pxPerMeter });
  const ellipse = fitEllipse(ring, limits.circle_ratio);
  const roundish = ellipse !== null && ellipse.error <= limits.ellipse_fit;
  const rectangle = polygon !== null && polygon.orthogonal && polygon.vertices.length === 4;

  const ellipseCandidate = (fit: EllipseFit): InkCandidate => ({
    kind: 'ellipse', center: fit.center, rx_m: fit.rx_m, ry_m: fit.ry_m,
    rotation_deg: fit.rotation_deg, circle: fit.circle,
  });
  if (rectangle) shapes.push({ kind: 'rectangle', vertices: polygon.vertices });
  if (roundish && !rectangle) shapes.push(ellipseCandidate(ellipse));
  if (polygon !== null) shapes.push({ kind: 'polygon', vertices: polygon.vertices });
  if (roundish && rectangle) shapes.push(ellipseCandidate(ellipse));

  // « Boucle autour de plusieurs formes » : une sélection.
  const enclosedShapes = context.shapes.filter(shape =>
    shape.outline.length > 0 && shape.outline.every(p => pointInPolygon(p, ring)));
  const enclosedNodes = context.nodes.filter(node => pointInPolygon(node.at, ring));
  const enclosed = enclosedShapes.length + enclosedNodes.length;
  if (enclosed === 0) return shapes;
  const lasso: InkCandidate = {
    kind: 'lasso', shapeIds: sortedIds(enclosedShapes), nodeIds: sortedIds(enclosedNodes),
  };
  return enclosed >= 2 ? [lasso, ...shapes] : [...shapes, lasso];
}

/**
 * Les candidates d'un trait, de la plus probable à la moins probable. Liste
 * vide si le trait ne ressemble à aucune forme de J1.2.
 *
 * La pression n'est pas lue : un tracé destiné à devenir une donnée n'en
 * dépend jamais (J0.1).
 */
export function recognize(points: readonly Point[], context: InkContext): readonly InkCandidate[] {
  if (points.length === 0 || !(context.pxPerMeter > 0)) return [];
  const limits = RECOGNITION_THRESHOLDS[context.strictness];
  const length_px = pathLength(points) * context.pxPerMeter;

  // « Point appuyé » : un nœud.
  if (length_px <= limits.tap_px) return [{ kind: 'node', at: quantizePoint(centroid(points)) }];

  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) return [];
  const gap_px = distance(first, last) * context.pxPerMeter;
  const closed = gap_px <= limits.close_px && length_px > 3 * limits.close_px;
  return closed ? recognizeClosed(points, context) : recognizeOpen(points, context);
}
