/**
 * Calage mesuré, côté atelier — complément atelier M1.4, écran M2.
 *
 * Le moteur d'ajustement vit dans `core-model` et ne connaît que des paires de
 * coordonnées. Ce module fait le pont avec ce que l'opérateur manipule à
 * l'écran : un point posé sur le fond, et l'amer du site auquel il correspond.
 *
 * Le point du repère métier n'est jamais saisi au clavier. Il est *choisi*
 * parmi les nœuds du graphe, dont la position est déjà connue en mètres.
 * Saisir une coordonnée à la main reviendrait à inventer un point de référence,
 * alors que le site en porte déjà : c'est ce que M1.4 nomme quand il cite
 * l'angle de bâtiment, l'entrée, l'ascenseur et le portail.
 */
import {
  fitMeasuredCalibration,
  auditCalibrationResiduals,
  MIN_CONTROL_POINTS,
} from '@azimut/core-model';
import type {
  ControlPointPair,
  Finding,
  GraphNode,
  MeasuredCalibration,
  NodeKind,
  PlanPixelPoint,
  ResidualTolerance,
  SiteData,
} from '@azimut/core-model';

export { MIN_CONTROL_POINTS };

/**
 * Natures de nœud utilisables comme amer.
 *
 * Un croisement (`junction`) ou un accès de destination est une abstraction du
 * graphe : rien ne le désigne sur un plan d'architecte, et deux opérateurs ne
 * le placeraient pas au même endroit. Les natures retenues correspondent à un
 * objet bâti que l'on montre du doigt.
 */
export const LANDMARK_NODE_KINDS: readonly NodeKind[] = [
  'entrance',
  'elevator',
  'stair',
  'escalator',
  'emergency_exit',
];

/** Une paire en cours de saisie : un amer choisi, un point posé sur le fond. */
export type PairDraft = {
  readonly node_id: string;
  readonly source: PlanPixelPoint;
};

export type MeasuredCalibrationState = {
  /** L'ajustement, absent tant qu'il ne peut pas être calculé. */
  readonly calibration: MeasuredCalibration | null;
  /** Anomalies d'ajustement, puis de recette si une tolérance est déclarée. */
  readonly findings: readonly Finding[];
  /** Amers restant à poser avant que l'ajustement soit possible. */
  readonly missing_pairs: number;
  /**
   * Vrai quand aucune tolérance n'est déclarée : les résidus sont affichés,
   * mais aucun verdict n'est rendu.
   */
  readonly unjudged: boolean;
};

/** Les nœuds d'un niveau utilisables comme amer, ordonnés de façon stable. */
export function landmarkNodes(site: SiteData, levelId: string): readonly GraphNode[] {
  return site.graph.nodes
    .filter((node) => node.level_id === levelId && LANDMARK_NODE_KINDS.includes(node.kind))
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id));
}

/**
 * Résout les brouillons en paires exploitables. Un brouillon dont l'amer n'est
 * plus au graphe est écarté sans bruit : il a pu disparaître entre la saisie et
 * le calcul, et le signaler comme une anomalie de calage désignerait la
 * mauvaise cause.
 */
export function buildControlPairs(
  site: SiteData,
  drafts: readonly PairDraft[],
): readonly ControlPointPair[] {
  const byId = new Map(site.graph.nodes.map((node) => [node.id, node]));
  const pairs: ControlPointPair[] = [];
  for (const draft of drafts) {
    const node = byId.get(draft.node_id);
    if (node === undefined) continue;
    pairs.push({ id: node.id, source: draft.source, target: node.position });
  }
  return pairs;
}

/**
 * Ajuste et, si une tolérance est déclarée, juge.
 *
 * `tolerance` vaut `null` tant que l'opérateur n'a pas déclaré ses seuils. Le
 * calage est alors calculé et ses résidus affichés, mais aucune anomalie de
 * recette n'est rendue : la valeur des seuils n'est pas tranchée (INV-5), et
 * un seuil implicite trancherait à la place de celui qui décide.
 */
export function evaluateMeasuredCalibration(
  site: SiteData,
  drafts: readonly PairDraft[],
  tolerance: ResidualTolerance | null,
): MeasuredCalibrationState {
  const pairs = buildControlPairs(site, drafts);
  const result = fitMeasuredCalibration(pairs);
  const missing = Math.max(MIN_CONTROL_POINTS - pairs.length, 0);

  if (!result.ok) {
    return {
      calibration: null,
      // Tant qu'il manque des amers, l'écran le dit par son compteur ; répéter
      // l'anomalie ferait passer une saisie en cours pour une erreur.
      findings: missing > 0 ? [] : result.findings,
      missing_pairs: missing,
      unjudged: tolerance === null,
    };
  }

  // Les avertissements de l'ajustement passent toujours, tolérance ou non :
  // « le résidu ne mesure rien » n'est pas un verdict de recette, c'est ce qu'il
  // faut savoir pour lire le tableau des résidus.
  const audit = tolerance === null ? [] : auditCalibrationResiduals(result.value, tolerance);

  return {
    calibration: result.value,
    findings: [...result.warnings, ...audit],
    missing_pairs: 0,
    unjudged: tolerance === null,
  };
}
