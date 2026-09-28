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
import { supportTypologyOf, type SiteData, type TravelProfile } from '@azimut/core-model';
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
 * les moteurs. Chaque support porte sa typologie (A5.6, `support.typology_id`)
 * quand il en a une ; la clé passée en argument ne s'applique qu'aux supports
 * qui n'en portent pas, ou qui en portent une inconnue du site. L'écran qui
 * fait cette supposition la montre, par `untypedSupportCount`.
 */
export function placedSupports(
  site: SiteData,
  fallbackTypeKey: string,
): readonly PlacedSupport[] {
  return [...site.supports]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((s): PlacedSupport => ({
      id: s.id,
      node_id: s.node_id,
      support_type_key: supportTypologyOf(site.support_types, s)?.key ?? fallbackTypeKey,
    }));
}

/** Supports sans typologie connue : ceux auxquels une typologie est supposée. */
export function untypedSupportCount(site: SiteData): number {
  return site.supports.filter(s => supportTypologyOf(site.support_types, s) === null).length;
}
