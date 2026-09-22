/**
 * M4 (partie M), « Affichage » — comment le graphe se distingue à l'œil.
 *
 * « Les nœuds sont différenciés par leur forme, jamais par la seule couleur.
 * Les arêtes non accessibles sont tracées en trait interrompu. Les
 * cheminements d'évacuation portent un liseré distinct. Aucune de ces
 * distinctions ne repose sur la couleur seule, contrôle vérifié en niveaux de
 * gris. »
 *
 * C'est M7.7 (partie M) — « aucune information n'est portée par la seule
 * couleur » — sur le cas le plus dense de la tranche. L'encodage est donc une
 * donnée, et un test vérifie qu'aucun trait distinctif n'est une couleur.
 */
import type { NodeKind } from '@azimut/core-model';

/** Les formes disponibles. Aucune n'est une couleur. */
export const NODE_SHAPES = [
  'circle', 'square', 'diamond', 'triangle', 'chevron', 'cross', 'hexagon',
] as const;
export type NodeShape = (typeof NODE_SHAPES)[number];

/**
 * La forme de chaque type de nœud.
 *
 * Deux types partagent une forme quand ils partagent une nature — les trois
 * liaisons verticales, par exemple, sont des chevrons — et se distinguent
 * alors par leur libellé, jamais par une teinte. Un lecteur qui ne perçoit
 * pas les couleurs lit le même plan qu'un autre.
 */
export const NODE_SHAPE: Readonly<Record<NodeKind, NodeShape>> = {
  entrance: 'triangle',
  emergency_exit: 'triangle',
  junction: 'circle',
  landing: 'square',
  elevator: 'chevron',
  stair: 'chevron',
  escalator: 'chevron',
  restroom: 'hexagon',
  security_post: 'cross',
  information_point: 'diamond',
  destination_access: 'square',
};

/** Le tracé d'une arête, selon ce qu'elle est. */
export type EdgeStroke = {
  /** Trait interrompu pour une arête non accessible. */
  readonly dashed: boolean;
  /** Liseré distinct pour un cheminement d'évacuation. */
  readonly outlined: boolean;
};

export function edgeStroke(edge: {
  readonly accessible: boolean;
  readonly evacuationRoute: boolean;
}): EdgeStroke {
  return {
    dashed: !edge.accessible,
    outlined: edge.evacuationRoute,
  };
}

/**
 * Les traits par lesquels une distinction se lit, hors couleur.
 *
 * Sert au contrôle : chaque distinction que M4 (partie M) nomme doit en
 * employer au moins un. Une distinction qui n'en emploierait aucun ne
 * survivrait pas au rendu en niveaux de gris.
 */
export const NON_COLOUR_CHANNELS = ['shape', 'dash', 'outline', 'label'] as const;
export type NonColourChannel = (typeof NON_COLOUR_CHANNELS)[number];

/** Le canal, hors couleur, qui porte chaque distinction de M4 (partie M). */
export const DISTINCTION_CHANNEL: Readonly<Record<string, NonColourChannel>> = {
  node_kind: 'shape',
  node_kind_within_shape: 'label',
  edge_not_accessible: 'dash',
  edge_evacuation_route: 'outline',
};
