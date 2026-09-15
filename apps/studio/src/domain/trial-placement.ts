/**
 * Implantation d'essai — H2.5.
 *
 * Le tableau des messages se calcule à partir de supports implantés. Tant
 * qu'aucune implantation n'est enregistrée pour le site, l'écran en propose
 * une : un support de la typologie choisie à chaque point de décision calculé
 * par le moteur.
 *
 * Ce n'est pas une donnée inventée, c'est la première passe canonique d'un plan
 * de jalonnement — et elle est entièrement dérivée du graphe. L'écran le dit à
 * l'utilisateur ; rien n'est écrit dans le site.
 *
 * Déterminisme : l'identifiant d'un support d'essai vient du nœud, jamais d'un
 * compteur, d'une horloge ou d'un tirage.
 */
import type { SiteData, TravelProfile } from '@azimut/core-model';
import { deriveDecisionPoints, type PlacedSupport } from '@azimut/engine-graph';

export type TrialPlacement = {
  readonly supports: readonly PlacedSupport[];
  /** Points de décision retenus, dans l'ordre où le moteur les rend. */
  readonly decision_point_count: number;
  /** Vrai quand le moteur n'a pas pu dériver les points de décision. */
  readonly derived: boolean;
};

export function trialSupportId(nodeId: string): string {
  return `sup-essai-${nodeId}`;
}

/**
 * Place un support de la typologie `supportTypeKey` sur chaque point de
 * décision du site. Les supports sont triés par identifiant de nœud pour que
 * deux appels sur le même état de données rendent la même liste.
 */
export function trialPlacement(
  site: SiteData,
  profile: TravelProfile,
  supportTypeKey: string,
): TrialPlacement {
  const points = deriveDecisionPoints(site, profile, site.destinations);
  if (!points.ok) {
    return { supports: [], decision_point_count: 0, derived: false };
  }

  const supports = [...points.value]
    .sort((a, b) => a.node_id.localeCompare(b.node_id))
    .map((point): PlacedSupport => ({
      id: trialSupportId(point.node_id),
      node_id: point.node_id,
      support_type_key: supportTypeKey,
    }));

  return {
    supports,
    decision_point_count: points.value.length,
    derived: true,
  };
}

/**
 * Supports réellement implantés sur le site, convertis au format attendu par
 * les moteurs. Le lien vers la typologie n'est pas encore porté par le modèle
 * A5 (`support` n'a pas de colonne typologie en mémoire) : la typologie passée
 * en argument s'applique donc à tous. Dès que le modèle la portera, cette
 * fonction lira la colonne au lieu de recevoir la clé.
 */
export function placedSupports(
  site: SiteData,
  supportTypeKey: string,
): readonly PlacedSupport[] {
  return [...site.supports]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((s): PlacedSupport => ({
      id: s.id,
      node_id: s.node_id,
      support_type_key: supportTypeKey,
    }));
}
