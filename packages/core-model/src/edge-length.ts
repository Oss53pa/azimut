import type { Point } from './geometry.js';
import { roundMetres } from './round.js';

/**
 * S6 — « La longueur d'une arête est calculée, jamais saisie, et recalculée à
 * toute modification de position. »
 *
 * Une arête n'a pas de géométrie propre : elle relie deux nœuds et rien
 * d'autre. Sa longueur est donc entièrement déterminée par ses extrémités, et
 * une valeur stockée qui en diffère est fausse — elle fausse silencieusement
 * tout itinéraire, puisque le calcul de parcours somme des longueurs.
 *
 * Trois dimensions, pas deux. Deux nœuds superposés sur des niveaux différents
 * — le cas d'un ascenseur ou d'un escalier — sont à la distance qui sépare les
 * deux niveaux, pas à distance nulle. Mesurer dans le plan seul en ferait une
 * arête de longueur zéro, c'est à dire une anomalie inventée par la mesure.
 *
 * `slope_pct` n'entre pas dans le calcul. C'est un attribut déclaré de
 * l'arête ; l'employer ici ajouterait une seconde source à une longueur qui en
 * a déjà une, et les deux finiraient par se contredire. La dénivelée est déjà
 * portée par l'altitude des niveaux.
 */

/** Une extrémité d'arête : sa position dans le plan, l'altitude de son niveau. */
export type EdgeEnd = {
  readonly position: Point;
  readonly elevation_m: number;
};

/**
 * Distance entre les deux extrémités, en mètres, arrondie au millimètre.
 *
 * L'arrondi n'est pas un confort d'affichage : D1.5 pose que deux points
 * distants de moins d'un millimètre sont le même point, donc une longueur ne
 * veut rien dire en deçà. Il rend surtout la valeur calculée exactement
 * comparable à une valeur écrite, ce qui permet de vérifier qu'aucune longueur
 * n'a été saisie sans passer par une tolérance.
 */
export function edgeLengthBetween(from: EdgeEnd, to: EdgeEnd): number {
  return roundMetres(Math.hypot(
    to.position.x_m - from.position.x_m,
    to.position.y_m - from.position.y_m,
    to.elevation_m - from.elevation_m,
  ));
}

/** Ce que le calcul lit du site, et rien de plus. */
export type EdgeLengthInput = {
  readonly levels: readonly {
    readonly id: string;
    readonly elevation_m: number;
  }[];
  readonly nodes: readonly {
    readonly id: string;
    readonly level_id: string;
    readonly position: Point;
  }[];
  readonly edges: readonly {
    readonly id: string;
    readonly from_node_id: string;
    readonly to_node_id: string;
  }[];
};

/**
 * Longueur de chaque arête, par identifiant.
 *
 * Une arête dont une extrémité est inconnue n'entre pas dans le résultat : sa
 * longueur n'est pas calculable, et en inventer une masquerait le nœud
 * manquant que `validateGraph` signale. Un niveau inconnu vaut une altitude
 * nulle — le nœud existe, sa position dans le plan reste vraie, et c'est le
 * niveau orphelin qui est l'anomalie, pas l'arête.
 */
export function computeEdgeLengths(
  input: EdgeLengthInput,
): ReadonlyMap<string, number> {
  const elevationOf = new Map<string, number>();
  for (const level of input.levels) {
    elevationOf.set(level.id, level.elevation_m);
  }

  const endOf = new Map<string, EdgeEnd>();
  for (const node of input.nodes) {
    endOf.set(node.id, {
      position: node.position,
      elevation_m: elevationOf.get(node.level_id) ?? 0,
    });
  }

  const lengths = new Map<string, number>();
  for (const edge of input.edges) {
    const from = endOf.get(edge.from_node_id);
    const to = endOf.get(edge.to_node_id);
    if (from === undefined || to === undefined) continue;
    lengths.set(edge.id, edgeLengthBetween(from, to));
  }
  return lengths;
}
