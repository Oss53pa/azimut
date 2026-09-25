import type { Footprint, Pictogram } from '@azimut/core-model';
import { roundSvg, footprintCentre, PICTOGRAM_GRID_UNITS } from '@azimut/core-model';

/** Un point du repère d'affichage, en pixels. Celui que rendent les `tx` locaux. */
export type ScreenPoint = { readonly x: number; readonly y: number };

/**
 * La marque d'une place accessible, posée sur le plan — S-39.
 *
 * « Place accessible : elle porte le pictogramme du registre de sécurité
 * désigné par la fonction d'accessibilité, section A5.4, jamais un symbole
 * maison, section A1.2, invariant 3. »
 *
 * Partagé par le plan de niveau et le plan orienté, qui doivent poser la même
 * marque de la même façon : deux tracés différents pour un même pictogramme
 * normalisé seraient déjà une dérive.
 *
 * Ce module ne choisit pas le pictogramme : `accessibleSpaceMark` le résout
 * depuis la fonction désignée, A5.4, et le lui passe. Il le dessine, centré
 * sur l'empreinte et mis à l'échelle de la place. Sans pictogramme il n'est
 * pas appelé, et rien n'est dessiné — la règle interdit le symbole de
 * remplacement, et s'abstenir est le seul repli qu'elle laisse.
 */

/** La part du plus petit côté d'une place qu'occupe sa marque. */
const MARK_SIDE_RATIO = 0.6;

function escapeSvg(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Le côté de la marque, en pixels, déduit du plus petit côté de la place.
 *
 * Mesuré sur l'empreinte projetée, et non sur l'échelle de la vue : le plan
 * orienté tourne la géométrie, et une marque dimensionnée avant la rotation
 * n'aurait plus la bonne taille après.
 */
function markSidePx(vertices: readonly ScreenPoint[]): number {
  const xs = vertices.map(v => v.x);
  const ys = vertices.map(v => v.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  return Math.min(width, height) * MARK_SIDE_RATIO;
}

/**
 * Le fragment SVG de la marque, ou la chaîne vide.
 *
 * Vide quand la place est trop petite pour porter une marque lisible : une
 * marque d'un pixel de côté n'est pas une marque, et un plan très dézoomé en
 * produirait une par place.
 */
export function accessibleMarkSvg(
  footprint: Footprint,
  projected: readonly ScreenPoint[],
  pictogram: Pictogram,
  fill: string,
): string {
  const centre = footprintCentre(footprint);
  if (centre === null || projected.length === 0) return '';

  const side = markSidePx(projected);
  if (side < 4) return '';

  const xs = projected.map(p => p.x);
  const ys = projected.map(p => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;

  const scale = roundSvg(side / PICTOGRAM_GRID_UNITS);
  const x = roundSvg(cx - side / 2);
  const y = roundSvg(cy - side / 2);

  return (
    `<g transform="translate(${x},${y}) scale(${scale})">` +
    `<path d="${escapeSvg(pictogram.svg_path)}" fill="${escapeSvg(fill)}" />` +
    `</g>`
  );
}
