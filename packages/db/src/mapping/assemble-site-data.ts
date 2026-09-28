/**
 * A5 — passage des lignes de la base au modèle en mémoire.
 *
 * Une seule implémentation, partagée par les deux chemins de lecture : le
 * service, qui interroge la base par l'ORM, et le navigateur, qui l'interroge
 * par l'API REST. Les deux rendent les mêmes colonnes ; le modèle qui en sort
 * est donc identique, quel que soit le chemin (invariant 1).
 *
 * Ce module est pur : aucune entrée-sortie, aucune horloge, aucun `node:`.
 */
import {
  readActiveLangs, readOpeningHours, computeEdgeLengths, isSiteZoneKind,
  isParkingSpaceKind, isPlanContentKind,
} from '@azimut/core-model';
import type {
  FootprintKind,
  SiteData,
  Organization, Site, Building, Level, Footprint, Volume,
  GraphNode, Edge, VerticalLink, BuildingLink, Category, Pictogram,
  Destination, DestinationName, TravelProfile,
  PlanSource, PlanCalibration, PlanContentKind,
  NodeKind, EdgeDirection, VerticalLinkKind, OccupancyStatus,
  PictogramRegistry, SiteZone, SiteZoneKind, ParkingSpace, ParkingSpaceKind,
  SiteRulesBinding,
} from '@azimut/core-model';
import type {
  SiteRowSet, } from './row-types.js';
import { num, isoString, asStringArray } from './row-scalars.js';
import { mapRulesBindingRows } from './map-rules-bindings.js';
import {
  mapSupportTypologyRow, mapSupportFaceRow, mapContentBlockRow,
  mapSupportVersionRow, mapSupportRow,
} from './map-signage-rows.js';
export {
  mapSupportTypologyRow, mapSupportFaceRow, mapContentBlockRow,
  mapSupportVersionRow, mapSupportRow,
};

/**
 * La nature d'une zone, ou la plus neutre des natures d'A5.2.
 *
 * Une valeur que le modèle ne connaît pas ne doit pas se faire passer pour un
 * parking : la nature commande les contrôles du domaine `PARK`, et retomber
 * sur `parking` inventerait un parking là où la base dit autre chose.
 * `technical` est le choix inverse — une zone que rien ne réclame.
 */
function toZoneKind(raw: string): SiteZoneKind {
  return isSiteZoneKind(raw) ? raw : 'technical';
}

/**
 * Le type d'une place, ou le plus neutre des cinq d'A5.3.
 *
 * `standard` est le défaut juste : une valeur inconnue lue comme `accessible`
 * ferait compter une place réservée qui n'existe pas, ce qu'un plan d'accueil
 * afficherait ensuite sans le revérifier.
 */
function toSpaceKind(raw: string): ParkingSpaceKind {
  return isParkingSpaceKind(raw) ? raw : 'standard';
}

/**
 * La nature du contenu d'un fond, ou `undetermined`. M2 (partie M) : un contenu
 * qui n'a pas été lu n'est « jamais présumé vectoriel » ; une valeur inconnue
 * n'a pas davantage été lue. La contrainte de la migration 0068 l'exclut déjà.
 */
function toPlanContentKind(raw: string): PlanContentKind {
  return isPlanContentKind(raw) ? raw : 'undetermined';
}

/**
 * Assemble le modèle du site depuis ses lignes.
 *
 * `face_templates` reste vide : les gabarits ne sont pas stockés en base, ils
 * sont compilés depuis les paquets de gabarits. C'est l'appelant qui les
 * fournit s'il en dispose.
 */
export function assembleSiteData(rows: SiteRowSet): SiteData {
  const organization: Organization = {
    id: rows.organization.id,
    name: rows.organization.name,
    slug: rows.organization.slug,
  };

  const site: Site = {
    id: rows.site.id,
    org_id: rows.site.org_id,
    name: rows.site.name,
    country_code: rows.site.country_code,
    timezone: rows.site.timezone,
    ...(rows.site.legal_entity_id !== null
      ? { legal_entity_id: rows.site.legal_entity_id }
      : {}),
    // M01.S1 — les deux colonnes vont ensemble ; le CHECK de la migration 0021
    // l'impose en base, et une origine à moitié lue n'entre pas au modèle.
    ...(rows.site.origin_x_m !== null && rows.site.origin_y_m !== null
      ? { origin_x_m: num(rows.site.origin_x_m), origin_y_m: num(rows.site.origin_y_m) }
      : {}),
    // N1.2 — les valeurs inconnues sont écartées à la frontière ; le CHECK de
    // la migration 0020 les interdit déjà en base, cette lecture tient pour
    // les données arrivées avant lui.
    active_langs: readActiveLangs(rows.site.active_langs),
    ...(rows.site.reference_elevation_m !== null
      ? { reference_elevation_m: num(rows.site.reference_elevation_m) }
      : {}),
  };

  const buildings: Building[] = rows.buildings.map(b => {
    // N1.2 — la colonne est du `jsonb` : la base n'en garantit pas la forme,
    // et `readOpeningHours` écarte ce qui n'est pas lisible.
    const hours = readOpeningHours(b.opening_hours);
    return {
      id: b.id,
      org_id: b.org_id,
      site_id: b.site_id,
      name: b.name,
      independent_access: b.independent_access,
      ...(hours !== undefined ? { opening_hours: hours } : {}),
      ...(b.default_edge_width_m !== null
        ? { default_edge_width_m: num(b.default_edge_width_m) }
        : {}),
    };
  });

  const levels: Level[] = rows.levels.map(l => ({
    id: l.id,
    org_id: l.org_id,
    building_id: l.building_id,
    name: l.name,
    ordinal: l.ordinal,
    elevation_m: num(l.elevation_m),
  }));

  const planSources: PlanSource[] = rows.plan_sources.map(p => ({
    id: p.id,
    org_id: p.org_id,
    level_id: p.level_id,
    storage_path: p.storage_path,
    media_type: p.media_type,
    content_kind: toPlanContentKind(p.content_kind),
    uploaded_at: isoString(p.uploaded_at),
  }));

  const planCalibrations: PlanCalibration[] = rows.plan_calibrations.map(c => ({
    id: c.id,
    org_id: c.org_id,
    plan_source_id: c.plan_source_id,
    scale_m_per_px: num(c.scale_m_per_px),
    // A5.2 — les deux coordonnées vont ensemble ; le CHECK de la migration
    // 0032 l'impose, et une origine à moitié lue n'entre pas au modèle.
    ...(c.origin_x_px !== null && c.origin_y_px !== null
      ? { origin_x_px: num(c.origin_x_px), origin_y_px: num(c.origin_y_px) }
      : {}),
    ...(c.reference_distance_m !== null
      ? { reference_distance_m: num(c.reference_distance_m) }
      : {}),
    rotation_deg: num(c.rotation_deg),
    ...(c.calibrated_at !== null
      ? { calibrated_at: isoString(c.calibrated_at) }
      : {}),
  }));

  const footprints: Footprint[] = rows.footprints.map(f => ({
    id: f.id,
    org_id: f.org_id,
    level_id: f.level_id,
    geometry: f.geometry as Footprint['geometry'],
    // La colonne est du texte ; le CHECK de la migration 0019 la restreint aux
    // cinq natures de N1.2. La restriction de type est donc adossée à une
    // contrainte de la base, comme pour `node.kind` ou `occupancy_status`.
    kind: f.kind as FootprintKind,
    // Colonne additive : une ligne antérieure à la migration 0018 la rend
    // nulle, et le champ reste alors absent du modèle plutôt que vide.
    ...(f.unit_code !== null ? { unit_code: f.unit_code } : {}),
  }));

  const volumes: Volume[] = rows.volumes.map(v => ({
    id: v.id,
    org_id: v.org_id,
    footprint_id: v.footprint_id,
    base_elevation_m: num(v.base_elevation_m),
    height_m: num(v.height_m),
    material_key: v.material_key,
    render_order: v.render_order,
  }));

  const nodes: GraphNode[] = rows.nodes.map(n => ({
    id: n.id,
    org_id: n.org_id,
    level_id: n.level_id,
    kind: n.kind as NodeKind,
    position: n.position as GraphNode['position'],
    label: n.label,
  }));

  /**
   * M01.S6 — la longueur d'une arête est calculée, jamais saisie. La colonne
   * `length_m` n'est donc pas lue : elle est un cache que l'application ne
   * croit pas. Deux nœuds déplacés d'un centimètre rendent toute valeur
   * stockée fausse, et un itinéraire faux ne se voit pas.
   *
   * Une arête dont une extrémité est inconnue n'a pas de longueur calculable ;
   * la valeur stockée lui reste, faute de mieux, et le nœud manquant est
   * signalé par `validateGraph`.
   */
  const edgeLengths = computeEdgeLengths({ levels, nodes, edges: rows.edges });

  const edges: Edge[] = rows.edges.map(e => ({
    id: e.id,
    org_id: e.org_id,
    from_node_id: e.from_node_id,
    to_node_id: e.to_node_id,
    width_m: num(e.width_m),
    slope_pct: num(e.slope_pct),
    accessible: e.accessible,
    direction: e.direction as EdgeDirection,
    evacuation_route: e.evacuation_route,
    length_m: edgeLengths.get(e.id) ?? num(e.length_m),
  }));

  const verticalLinks: VerticalLink[] = rows.vertical_links.map(v => ({
    id: v.id,
    org_id: v.org_id,
    edge_id: v.edge_id,
    kind: v.kind as VerticalLinkKind,
    capacity: v.capacity,
    accessible: v.accessible,
  }));

  const buildingLinks: BuildingLink[] = rows.building_links.map(b => ({
    id: b.id,
    org_id: b.org_id,
    edge_id: b.edge_id,
    from_building_id: b.from_building_id,
    to_building_id: b.to_building_id,
    sheltered: b.sheltered,
  }));

  const categories: Category[] = rows.categories.map(c => ({
    id: c.id,
    org_id: c.org_id,
    sector_key: c.sector_key,
    code: c.code,
    parent_id: c.parent_id,
  }));

  const pictograms: Pictogram[] = rows.pictograms.map(p => ({
    id: p.id,
    org_id: p.org_id,
    category_id: p.category_id,
    source: p.source,
    standard_ref: p.standard_ref,
    svg_path: p.svg_path,
    registry: p.registry as PictogramRegistry,
    function_key: p.function_key,
    rules_pack_id: p.rules_pack_id,
  }));

  const destinations: Destination[] = rows.destinations.map(d => ({
    id: d.id,
    org_id: d.org_id,
    footprint_id: d.footprint_id,
    node_id: d.node_id,
    category_id: d.category_id,
    occupant_name: d.occupant_name,
    occupancy_status: d.occupancy_status as OccupancyStatus,
    display_priority: d.display_priority,
    ...(d.valid_from !== null ? { valid_from: d.valid_from } : {}),
    ...(d.valid_to !== null ? { valid_to: d.valid_to } : {}),
  }));

  const destinationNames: DestinationName[] = rows.destination_names.map(n => ({
    id: n.id,
    org_id: n.org_id,
    destination_id: n.destination_id,
    lang: n.lang as DestinationName['lang'],
    value: n.value,
  }));

  const travelProfiles: TravelProfile[] = rows.travel_profiles.map(p => ({
    id: p.id,
    org_id: p.org_id,
    site_id: p.site_id,
    key: p.key,
    name: p.name,
    excluded_edge_kinds: asStringArray(p.excluded_edge_kinds) ?? [],
    require_accessible: p.require_accessible,
    honor_hours: p.honor_hours,
  }));

  // A5.2, version 18 — les zones du socle. Elles n'étaient pas assemblées : une
  // zone ne portait qu'un nom et une nature, et aucun moteur ne les lisait.
  // `footprint_ids` et la section S8 changent cela — un parking **est** une
  // zone, et les contrôles du domaine `PARK` n'ont plus d'autre source.
  // A5.3 — ce que les empreintes de place portent en plus. Une ligne par
  // empreinte ; une empreinte sans ligne reste une place standard sans repère
  // de travée, comme une arête sans `vertical_link` reste une arête.
  const parkingSpaces: ParkingSpace[] = rows.parking_spaces.map(s => ({
    id: s.id,
    org_id: s.org_id,
    footprint_id: s.footprint_id,
    space_kind: toSpaceKind(s.space_kind),
    row_label: s.row_label,
  }));

  const zones: SiteZone[] = rows.zones.map(z => ({
    id: z.id,
    org_id: z.org_id,
    level_id: z.level_id,
    name: z.name,
    kind: toZoneKind(z.kind),
    footprint_ids: asStringArray(z.footprint_ids) ?? [],
  }));

  // A5.8 — les paquets du site, depuis la table qui fait foi.
  const rulesBindings: SiteRulesBinding[] = mapRulesBindingRows(rows.rules_bindings);

  return {
    organization,
    site,
    rules_bindings: rulesBindings,
    buildings,
    levels,
    plan_sources: planSources,
    plan_calibrations: planCalibrations,
    footprints,
    volumes,
    graph: {
      nodes, edges, vertical_links: verticalLinks, building_links: buildingLinks,
    },
    categories,
    pictograms,
    destinations,
    destination_names: destinationNames,
    travel_profiles: travelProfiles,
    support_types: rows.support_typologies.map(mapSupportTypologyRow),
    supports: rows.supports.map(mapSupportRow),
    support_faces: rows.support_faces.map(mapSupportFaceRow),
    content_blocks: rows.content_blocks.map(mapContentBlockRow),
    support_versions: rows.support_versions.map(mapSupportVersionRow),
    face_templates: [],
    zones,
    parking_spaces: parkingSpaces,
  };
}
