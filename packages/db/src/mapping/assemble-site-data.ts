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
import type {
  SiteData,
  Organization, Site, Building, Level, Footprint, Volume,
  GraphNode, Edge, VerticalLink, Category, Pictogram,
  Destination, DestinationName, TravelProfile,
  Support, SupportType, SupportFace, ContentBlockInstance, SupportVersion,
  NodeKind, EdgeDirection, VerticalLinkKind, OccupancyStatus,
  PictogramRegistry, SupportVersionState, DimensionsSource,
  Parking, ParkingSpace, ParkingSpaceKind, UncoveredArea, VehicleGate,
  ObjectStatus, Point, Polygon,
} from '@azimut/core-model';
import type {
  SiteRowSet, TimestampValue,
  SupportRow, SupportTypologyRow, SupportFaceRow,
  SupportContentBlockRow, SupportVersionRow,
} from './row-types.js';

/**
 * Un statut que le code ne reconnaît pas ne devient jamais `existant`.
 *
 * `existant` est le seul statut qui autorise un objet à paraître dans un
 * livrable (P1). Une valeur mal orthographiée en base, ou venue d'une version
 * ultérieure du modèle, doit donc retomber sur un statut qui retient l'objet,
 * pas sur celui qui le publie. `a_verifier` dit exactement cela : on ne sait
 * pas, quelqu'un doit regarder.
 */
function toObjectStatus(raw: string): ObjectStatus {
  switch (raw) {
    case 'existant':
    case 'proposition':
    case 'retire':
      return raw;
    default:
      return 'a_verifier';
  }
}

function toSpaceKind(raw: string): ParkingSpaceKind {
  return raw === 'pmr' || raw === 'livraison' ? raw : 'standard';
}

/** Une colonne `numeric` revient en chaîne : la conversion est explicite. */
function num(value: string): number {
  return Number(value);
}

function isoString(value: TimestampValue): string {
  return typeof value === 'string' ? value : value.toISOString();
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asStringArray(value: unknown): readonly string[] | undefined {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : undefined;
}

const VERSION_STATES: readonly SupportVersionState[] = [
  'draft', 'in_review', 'approved', 'superseded',
];

function versionState(value: string): SupportVersionState {
  return (VERSION_STATES as readonly string[]).includes(value)
    ? (value as SupportVersionState)
    : 'draft';
}

/**
 * A5.6 — la base ne stocke aucune dimension par défaut au niveau de la
 * typologie : elles vivent sur l'instance. `faces` reste donc vide, et
 * l'appelant retombe sur les dimensions de l'instance puis sur une taille
 * de face par défaut.
 */
export function mapSupportTypologyRow(row: SupportTypologyRow): SupportType {
  return {
    id: row.id,
    org_id: row.org_id,
    key: row.key,
    name: row.name,
    face_count: row.face_count,
    ...(row.template_key !== null ? { template_key: row.template_key } : {}),
    faces: [],
  };
}

/** A5.6 — `face_index` vaut 0 quand la colonne additive est nulle. */
export function mapSupportFaceRow(row: SupportFaceRow): SupportFace {
  const langs = asStringArray(row.langs);
  return {
    id: row.id,
    org_id: row.org_id,
    support_id: row.support_id,
    face_index: row.face_index ?? 0,
    ...(row.template_key !== null ? { template_key: row.template_key } : {}),
    ...(langs !== undefined ? { langs } : {}),
  };
}

/** A5.6 — `block_index` retombe sur l'`ordinal` antérieur. */
export function mapContentBlockRow(row: SupportContentBlockRow): ContentBlockInstance {
  const binding = asRecord(row.binding);
  const freeText = asRecord(row.free_text);
  return {
    id: row.id,
    org_id: row.org_id,
    face_id: row.face_id,
    block_index: row.block_index ?? row.ordinal,
    kind: row.kind,
    ...(binding !== undefined ? { binding } : {}),
    ...(freeText !== undefined ? { free_text: freeText } : {}),
  };
}

/** A5.6 — l'état est garanti par la contrainte CHECK de la base. */
export function mapSupportVersionRow(row: SupportVersionRow): SupportVersion {
  return {
    id: row.id,
    org_id: row.org_id,
    support_id: row.support_id,
    version: row.version,
    state: versionState(row.state),
    ...(row.artwork_path !== null ? { artwork_path: row.artwork_path } : {}),
    ...(row.content_hash !== null ? { content_hash: row.content_hash } : {}),
    created_at: isoString(row.created_at),
    ...(row.created_by !== null ? { created_by: row.created_by } : {}),
  };
}

/**
 * A5.6 — registre, contexte et distance de lecture sont des colonnes additives
 * et nullables : une ligne antérieure retombe sur les valeurs les plus
 * permissives — registre de wayfinding, contexte intérieur, distance nulle —
 * pour qu'un support non relevé n'emprunte jamais en silence une règle plus
 * stricte que sa donnée ne le permet. Les vraies valeurs viennent du relevé.
 */
export function mapSupportRow(row: SupportRow): Support {
  const dimensionsSource: DimensionsSource | undefined =
    row.dimensions_source === 'overridden' ? 'overridden'
      : row.dimensions_source === 'computed' ? 'computed'
        : undefined;
  return {
    id: row.id,
    org_id: row.org_id,
    site_id: row.site_id,
    node_id: row.node_id,
    registry: row.registry === 'safety' ? 'safety' : 'wayfinding',
    context: row.context === 'exterior' ? 'exterior' : 'interior',
    reading_distance_m: row.reading_distance_m !== null ? num(row.reading_distance_m) : 0,
    azimuth_deg: num(row.azimuth_deg),
    ...(row.width_mm !== null ? { width_mm: row.width_mm } : {}),
    ...(row.height_mm !== null ? { height_mm: row.height_mm } : {}),
    ...(dimensionsSource !== undefined ? { dimensions_source: dimensionsSource } : {}),
  };
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
    rules_pack_id: rows.site.rules_pack_id,
  };

  const buildings: Building[] = rows.buildings.map(b => ({
    id: b.id,
    org_id: b.org_id,
    site_id: b.site_id,
    name: b.name,
    independent_access: b.independent_access,
  }));

  const levels: Level[] = rows.levels.map(l => ({
    id: l.id,
    org_id: l.org_id,
    building_id: l.building_id,
    name: l.name,
    ordinal: l.ordinal,
    elevation_m: num(l.elevation_m),
  }));

  const footprints: Footprint[] = rows.footprints.map(f => ({
    id: f.id,
    org_id: f.org_id,
    level_id: f.level_id,
    geometry: f.geometry as Footprint['geometry'],
    kind: f.kind,
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
    length_m: num(e.length_m),
  }));

  const verticalLinks: VerticalLink[] = rows.vertical_links.map(v => ({
    id: v.id,
    org_id: v.org_id,
    edge_id: v.edge_id,
    kind: v.kind as VerticalLinkKind,
    capacity: v.capacity,
    accessible: v.accessible,
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

  // Complément atelier M2 — stationnement.
  const parkings: Parking[] = rows.parkings.map(p => ({
    id: p.id,
    org_id: p.org_id,
    level_id: p.level_id,
    geometry: p.geometry as Parking['geometry'],
    name: p.name,
    free: p.free,
    declared_capacity: p.declared_capacity,
    provenance: { status: toObjectStatus(p.status), source: p.source },
  }));

  const parkingSpaces: ParkingSpace[] = rows.parking_spaces.map(s => ({
    id: s.id,
    org_id: s.org_id,
    parking_id: s.parking_id,
    kind: toSpaceKind(s.kind),
    row: s.row_label,
    provenance: { status: toObjectStatus(s.status), source: s.source },
    // Colonne facultative : absente du modèle plutôt que présente et vide,
    // comme les autres champs optionnels de ce module.
    ...(s.geometry === null || s.geometry === undefined
      ? {}
      : { geometry: s.geometry as Polygon }),
  }));

  const parkingUncovered: UncoveredArea[] = rows.parking_uncovered.map(a => ({
    id: a.id,
    org_id: a.org_id,
    parking_id: a.parking_id,
    reason: a.reason,
  }));

  const vehicleGates: VehicleGate[] = rows.vehicle_gates.map(g => ({
    id: g.id,
    org_id: g.org_id,
    level_id: g.level_id,
    code: g.code,
    role: g.role,
    width_m: num(g.width_m),
    position: g.position as Point,
    provenance: { status: toObjectStatus(g.status), source: g.source },
  }));

  return {
    organization,
    site,
    buildings,
    levels,
    footprints,
    volumes,
    graph: { nodes, edges, vertical_links: verticalLinks },
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
    parkings,
    parking_spaces: parkingSpaces,
    parking_uncovered: parkingUncovered,
    vehicle_gates: vehicleGates,
  };
}
