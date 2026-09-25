import type {
  SiteData,
  TravelProfile,
  FaceTemplate,
} from '@azimut/core-model';
import { contentHash, rulesPacksInRoleOrder } from '@azimut/core-model';
import type { BoundRulesPacks } from '@azimut/core-model';
import type { ResolvedFace } from './resolve-face.js';

function pickNodeFields(
  node: SiteData['graph']['nodes'][number],
): Record<string, unknown> {
  return {
    id: node.id,
    level_id: node.level_id,
    kind: node.kind,
    position: node.position,
    label: node.label,
  };
}

function pickEdgeFields(
  edge: SiteData['graph']['edges'][number],
): Record<string, unknown> {
  return {
    id: edge.id,
    from_node_id: edge.from_node_id,
    to_node_id: edge.to_node_id,
    width_m: edge.width_m,
    slope_pct: edge.slope_pct,
    accessible: edge.accessible,
    direction: edge.direction,
    evacuation_route: edge.evacuation_route,
    length_m: edge.length_m,
  };
}

function pickVerticalLinkFields(
  vl: SiteData['graph']['vertical_links'][number],
): Record<string, unknown> {
  return {
    id: vl.id,
    edge_id: vl.edge_id,
    kind: vl.kind,
    capacity: vl.capacity,
    accessible: vl.accessible,
  };
}

function pickProfileFields(
  profile: TravelProfile,
): Record<string, unknown> {
  return {
    key: profile.key,
    excluded_edge_kinds: [...profile.excluded_edge_kinds].sort(),
    require_accessible: profile.require_accessible,
    honor_hours: profile.honor_hours,
  };
}

/**
 * Les trois collections du graphe, triées et réduites à leurs champs.
 *
 * D7.1 ne fait qu'une différence entre les deux empreintes du graphe : le
 * profil. Le reste est identique, et l'écrire deux fois ferait deux empreintes
 * qui divergeraient au premier champ ajouté d'un seul côté.
 *
 * **Les liaisons entre bâtiments n'y entrent pas**, et D7.1 dit pourquoi :
 * « aucun calcul de parcours ne lit aujourd'hui leur attribut de passage
 * couvert ». Une empreinte d'invalidation ne porte que ce dont un résultat
 * dépend ; y mettre une donnée qu'aucun calcul ne lit ferait recalculer tous
 * les parcours d'un site à chaque fois qu'on déclare une passerelle couverte,
 * sans qu'un seul change.
 *
 * **Réserve, et elle est du document :** « Le jour où un profil en tiendrait
 * compte, elles devraient y entrer, faute de quoi un changement de passage
 * laisserait des parcours faux en cache. » Le jour où un profil préférera les
 * cheminements couverts — une option de `travel_profile`, un coût qui lit
 * `sheltered` — ce module est le premier à reprendre, avant le profil
 * lui-même. `compute-hashes.test.ts` garde cette réserve visible.
 */
function graphParts(graph: SiteData['graph']): {
  nodes: Record<string, unknown>[];
  edges: Record<string, unknown>[];
  vertical_links: Record<string, unknown>[];
} {
  return {
    nodes: [...graph.nodes]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(pickNodeFields),
    edges: [...graph.edges]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(pickEdgeFields),
    vertical_links: [...graph.vertical_links]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(pickVerticalLinkFields),
  };
}

export function computeInputsHash(
  site: SiteData,
  profile: TravelProfile,
): string {
  return contentHash({
    ...graphParts(site.graph),
    profile: pickProfileFields(profile),
  });
}

/**
 * A5.3 et D7.2 — l'empreinte du graphe d'un site, **sans profil**.
 *
 * Elle est portée par chaque enregistrement de `graph_validation` : une
 * validation de complétude ne vaut que pour le graphe dont elle porte
 * l'empreinte. C'est ce qui rend la règle M02.W11 vérifiable sans qu'on ait à
 * supprimer un enregistrement quand le graphe change — il cesse simplement de
 * correspondre.
 *
 * Le profil en est exclu parce que la complétude n'en dépend pas : un graphe
 * n'est pas complet pour un profil et incomplet pour un autre.
 *
 * Elle prend le graphe et non le site : c'est tout ce dont D7.2 a besoin, et
 * exiger un `SiteData` entier obligerait l'appelant à en fabriquer une coquille
 * là où il n'a qu'un graphe.
 */
export function computeGraphHash(graph: SiteData['graph']): string {
  return contentHash(graphParts(graph));
}

export type ContentHashInput = {
  readonly resolved: ResolvedFace;
  readonly template: FaceTemplate;
  /** Charter identity — the charter itself, per D7.1 "charte et sa version". */
  readonly charter_id: string | null;
  readonly charter_version: string | null;
  /**
   * D7.1 — « les paquets de règles rattachés au site, socle et surcouche,
   * chacun avec sa clé et sa version ». Les deux rattachements, jamais le seul
   * résultat de leur fusion.
   */
  readonly rules_packs: BoundRulesPacks;
  readonly active_langs: readonly string[];
  readonly dimensions: {
    readonly width_mm: number;
    readonly height_mm: number;
  };
};

export function computeContentHash(
  input: ContentHashInput,
): string {
  return contentHash({
    resolved: input.resolved,
    template_id: input.template.id,
    template_blocks: input.template.blocks,
    charter_id: input.charter_id,
    charter_version: input.charter_version,
    rules_packs: rulesPacksInRoleOrder(input.rules_packs),
    active_langs: [...input.active_langs].sort(),
    dimensions: input.dimensions,
  });
}
