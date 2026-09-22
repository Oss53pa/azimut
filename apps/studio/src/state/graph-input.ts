/**
 * M4 (partie M) — contrôles à la saisie du graphe.
 *
 * Trois refus, et l'un d'eux est particulier : « Arête entre niveaux sans
 * liaison verticale | `GRAPH.VERTICAL_LINK_MISSING` | Refus, avec proposition
 * de créer la liaison. » Le refus porte donc une correction, et ne se contente
 * pas de dire non — c'est le seul des trois où l'écran sait quoi proposer.
 *
 * La longueur n'est jamais saisie. M4 (partie M) : « La longueur est recalculée à toute
 * modification de position. Un champ de longueur saisissable serait une source
 * permanente d'incohérence. » Elle vient donc de `edgeLengthBetween`, la même
 * fonction que la validation de complétude emploie (M01.S6, partie N).
 */
import type { EdgeEnd, Finding, NodeKind, Outcome, Point } from '@azimut/core-model';
import { EDGE_MIN_LENGTH_M, edgeLengthBetween, quantizePoint } from '@azimut/core-model';

/** A5.3 : les onze types de nœud, liste fermée. */
export const NODE_KINDS: readonly NodeKind[] = [
  'entrance', 'junction', 'landing', 'elevator', 'stair', 'escalator',
  'emergency_exit', 'restroom', 'security_post', 'information_point',
  'destination_access',
];

/** A5.3 : les quatre natures de liaison verticale. */
export const VERTICAL_LINK_KINDS = ['elevator', 'stair', 'escalator', 'ramp'] as const;
export type VerticalLinkKind = (typeof VERTICAL_LINK_KINDS)[number];

/** A5.3 : les trois sens d'une arête. M4 (partie M) donne « les deux » par défaut. */
export const EDGE_DIRECTIONS = ['both', 'forward', 'backward'] as const;
export type EdgeDirection = (typeof EDGE_DIRECTIONS)[number];

/**
 * M4 (partie M) : « Pente | numérique, pourcentage | -20 à +20 ».
 *
 * C'est une borne de saisie, non un seuil de conformité : une pente
 * réglementaire vient du paquet de règles (INV-5). Celle-ci écarte la faute de
 * frappe — une rampe à 200 % n'existe pas — et rien de plus.
 */
export const SLOPE_MIN_PCT = -20;
export const SLOPE_MAX_PCT = 20;

/** Vrai quand la pente tient dans les bornes de saisie de M4 (partie M). */
export function isAdmissibleSlopePct(value: number): boolean {
  return Number.isFinite(value) && value >= SLOPE_MIN_PCT && value <= SLOPE_MAX_PCT;
}

/** M4 (partie M) : « Largeur utile | supérieure à 0 ». */
export function isAdmissibleWidthM(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

// ---------------------------------------------------------------------------
// Nœud
// ---------------------------------------------------------------------------

export type NodeDraft = {
  readonly kind: NodeKind;
  readonly label: string;
  readonly position: Point;
};

export type AcceptedNode = {
  readonly kind: NodeKind;
  readonly label: string;
  /** Position quantifiée au millimètre (E4). */
  readonly position: Point;
};

/**
 * M4 (partie M) : « Le type se choisit avant le geste, jamais après. »
 *
 * Le type est donc porté par l'outil actif, et `NodeKind` est une union
 * fermée : un type inconnu ne franchit pas le typage. Rien à contrôler ici
 * qu'un code d'anomalie devrait dire — et M4 (partie M) n'en donne aucun pour ce champ.
 *
 * Ce que cette fonction fait, c'est quantifier : E4 veut la quantification à
 * la validation du geste, et la position d'un nœud posé au pointeur en a
 * besoin autant qu'un sommet d'empreinte.
 */
export function acceptNode(draft: NodeDraft): AcceptedNode {
  return {
    kind: draft.kind,
    label: draft.label.trim(),
    position: quantizePoint(draft.position),
  };
}


// ---------------------------------------------------------------------------
// Arête
// ---------------------------------------------------------------------------

/** Une extrémité d'arête, avec le niveau auquel elle appartient. */
export type EdgeEndpoint = EdgeEnd & {
  readonly nodeId: string;
  readonly levelId: string;
};

export type EdgeDraft = {
  readonly from: EdgeEndpoint;
  readonly to: EdgeEndpoint;
  readonly widthM: number;
  readonly slopePct: number;
  readonly accessible: boolean;
  readonly direction: EdgeDirection;
  readonly evacuationRoute: boolean;
  /** Vrai quand une liaison verticale accompagne l'arête. */
  readonly hasVerticalLink: boolean;
};

export type AcceptedEdge = {
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly widthM: number;
  readonly slopePct: number;
  readonly accessible: boolean;
  readonly direction: EdgeDirection;
  readonly evacuationRoute: boolean;
  /** Calculée, jamais saisie (M4 (partie M), A5.3). */
  readonly lengthM: number;
};

/**
 * La correction que le refus propose, quand il en sait une.
 *
 * M4 (partie M) est seul à le demander pour `GRAPH.VERTICAL_LINK_MISSING` : « Refus, avec
 * proposition de créer la liaison. » Un refus qui sait quoi faire et se tait
 * oblige l'opérateur à deviner.
 */
export type EdgeRemedy = {
  readonly kind: 'create_vertical_link';
  readonly fromLevelId: string;
  readonly toLevelId: string;
};

export type EdgeRejection = {
  readonly findings: readonly Finding[];
  readonly remedy: EdgeRemedy | null;
};

export function acceptEdge(draft: EdgeDraft): Outcome<AcceptedEdge> & { readonly remedy?: EdgeRemedy } {
  const rejection = rejectEdge(draft);
  if (rejection !== null) {
    const findings = [...rejection.findings];
    return rejection.remedy === null
      ? { ok: false, findings }
      : { ok: false, findings, remedy: rejection.remedy };
  }

  return {
    ok: true,
    value: {
      fromNodeId: draft.from.nodeId,
      toNodeId: draft.to.nodeId,
      widthM: draft.widthM,
      slopePct: draft.slopePct,
      accessible: draft.accessible,
      direction: draft.direction,
      evacuationRoute: draft.evacuationRoute,
      lengthM: edgeLengthBetween(draft.from, draft.to),
    },
    warnings: [],
  };
}

function rejectEdge(draft: EdgeDraft): EdgeRejection | null {
  // A5.3 : « Une arête relie deux nœuds distincts. » Le contrôle passe avant
  // la longueur : une boucle est de longueur nulle, et lever les deux dirait
  // deux fois le même fait.
  if (draft.from.nodeId === draft.to.nodeId) {
    return {
      findings: [finding('GRAPH.EDGE_SELF_LOOP', { node: draft.from.nodeId })],
      remedy: null,
    };
  }

  const crossesLevels = draft.from.levelId !== draft.to.levelId;
  if (crossesLevels && !draft.hasVerticalLink) {
    return {
      findings: [finding('GRAPH.VERTICAL_LINK_MISSING', {
        from_level: draft.from.levelId,
        to_level: draft.to.levelId,
      })],
      remedy: {
        kind: 'create_vertical_link',
        fromLevelId: draft.from.levelId,
        toLevelId: draft.to.levelId,
      },
    };
  }

  const length = edgeLengthBetween(draft.from, draft.to);
  if (length < EDGE_MIN_LENGTH_M) {
    return {
      findings: [finding('GRAPH.EDGE_ZERO_LENGTH', {
        length_m: length, minimum_m: EDGE_MIN_LENGTH_M,
      })],
      remedy: null,
    };
  }

  return null;
}

function finding(code: string, params: Record<string, string | number>): Finding {
  return { code, severity: 'blocking', entity: null, params, ruleRef: 'partieM-M4 (partie M)' };
}

// ---------------------------------------------------------------------------
// M4 (partie M) — l'axe de circulation
// ---------------------------------------------------------------------------

/**
 * « Axe de circulation | `X` | Tracé continu produisant nœuds et arêtes en une
 * passe. »
 *
 * Critère d'acceptation 1 : « Un axe tracé en une passe produit les nœuds et
 * arêtes attendus, sans doublon. » Le doublon est le piège : un axe qui repasse
 * par un point déjà posé ne doit pas y créer un second nœud, sans quoi le
 * graphe se déconnecte visuellement sans qu'on le voie.
 */
export type AxisPoint = {
  readonly position: Point;
  /** L'identifiant du nœud existant sous le point, quand il y en a un. */
  readonly existingNodeId: string | null;
};

export type AxisVertex =
  | { readonly kind: 'existing'; readonly nodeId: string; readonly position: Point }
  | { readonly kind: 'new'; readonly index: number; readonly position: Point };

export type AxisResult = {
  readonly vertices: readonly AxisVertex[];
  /** Les arêtes de l'axe, par couples d'indices dans `vertices`. */
  readonly segments: readonly (readonly [number, number])[];
};

/**
 * Déroule un axe en nœuds et arêtes.
 *
 * Trois règles, et chacune évite un doublon :
 *  · un point posé sur un nœud existant réutilise ce nœud ;
 *  · deux points consécutifs à la même position quantifiée n'en font qu'un, et
 *    ne produisent pas d'arête de longueur nulle ;
 *  · un point qui repasse sur une position déjà vue dans le même axe réutilise
 *    le sommet déjà créé — un axe en boucle se ferme au lieu de se dédoubler.
 */
export function unfoldAxis(points: readonly AxisPoint[]): AxisResult {
  const vertices: AxisVertex[] = [];
  const byKey = new Map<string, number>();
  const order: number[] = [];
  let created = 0;

  for (const point of points) {
    const position = quantizePoint(point.position);
    const key = point.existingNodeId ?? positionKey(position);
    const seen = byKey.get(key);

    if (seen !== undefined) {
      // Un point qui retombe sur un sommet déjà posé le réutilise. Deux points
      // consécutifs identiques ne produisent donc aucune arête.
      if (order[order.length - 1] !== seen) order.push(seen);
      continue;
    }

    const index = vertices.length;
    vertices.push(point.existingNodeId !== null
      ? { kind: 'existing', nodeId: point.existingNodeId, position }
      : { kind: 'new', index: created++, position });
    byKey.set(key, index);
    order.push(index);
  }

  const segments: (readonly [number, number])[] = [];
  for (let i = 1; i < order.length; i += 1) {
    const from = order[i - 1];
    const to = order[i];
    if (from === undefined || to === undefined || from === to) continue;
    segments.push([from, to]);
  }

  return { vertices, segments };
}

/** La clé d'une position quantifiée. Le millimètre est la maille du modèle. */
function positionKey(p: Point): string {
  return `${p.x_m.toFixed(3)},${p.y_m.toFixed(3)}`;
}
