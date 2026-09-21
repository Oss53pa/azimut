/**
 * A5 — forme des lignes telles que la base les rend.
 *
 * Ces types décrivent les colonnes, pas le modèle métier : ils sont le contrat
 * entre la base et `assembleSiteData`. Les deux chemins de lecture les
 * satisfont — l'ORM côté service, l'API REST côté navigateur — ce qui permet
 * une seule implémentation du passage ligne → modèle (invariant 1).
 *
 * Deux conventions de PostgreSQL s'y lisent :
 *  - une colonne `numeric` revient en chaîne, jamais en nombre ;
 *  - un horodatage revient en `Date` par l'ORM, en chaîne ISO par l'API REST.
 *
 * Ce module ne dépend de rien : ni ORM, ni `node:`, ni réseau.
 */

/** Horodatage tel qu'il arrive, selon le chemin de lecture. */
export type TimestampValue = string | Date;

export type OrganizationRow = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
};

export type SiteRow = {
  readonly id: string;
  readonly org_id: string;
  readonly name: string;
  readonly country_code: string;
  readonly rules_pack_id: string | null;
  /** S1 — origine du repère site, NULL tant qu'aucun calage n'a eu lieu. */
  readonly origin_x: string | null;
  readonly origin_y: string | null;
  /** N1.2 — `text[]`, NULL quand rien n'est déclaré. */
  readonly active_langs: readonly string[] | null;
  readonly reference_elevation_m: string | null;
};

export type BuildingRow = {
  readonly id: string;
  readonly org_id: string;
  readonly site_id: string;
  readonly name: string;
  readonly independent_access: boolean;
  /** N1.2 — `jsonb`, forme libre du point de vue de la base. */
  readonly opening_hours: unknown;
  readonly default_edge_width_m: string | null;
};

export type LevelRow = {
  readonly id: string;
  readonly org_id: string;
  readonly building_id: string;
  readonly name: string;
  readonly ordinal: number;
  readonly elevation_m: string;
};

export type PlanSourceRow = {
  readonly id: string;
  readonly org_id: string;
  readonly level_id: string;
  readonly storage_path: string;
  readonly media_type: string;
  readonly uploaded_at: TimestampValue;
};

export type PlanCalibrationRow = {
  readonly id: string;
  readonly org_id: string;
  readonly plan_source_id: string;
  readonly scale_m_per_px: string;
  readonly origin_x: string;
  readonly origin_y: string;
  readonly rotation_deg: string;
  /** S1 — NULL sur une ligne antérieure à la migration 0022. */
  readonly calibrated_at: TimestampValue | null;
};

export type FootprintRow = {
  readonly id: string;
  readonly org_id: string;
  readonly level_id: string;
  readonly geometry: unknown;
  readonly kind: string;
  readonly unit_code: string | null;
};

export type VolumeRow = {
  readonly id: string;
  readonly org_id: string;
  readonly footprint_id: string;
  readonly base_elevation_m: string;
  readonly height_m: string;
  readonly material_key: string;
  readonly render_order: number | null;
};

export type NodeRow = {
  readonly id: string;
  readonly org_id: string;
  readonly level_id: string;
  readonly kind: string;
  readonly position: unknown;
  readonly label: string;
};

export type EdgeRow = {
  readonly id: string;
  readonly org_id: string;
  readonly from_node_id: string;
  readonly to_node_id: string;
  readonly width_m: string;
  readonly slope_pct: string;
  readonly accessible: boolean;
  readonly direction: string;
  readonly evacuation_route: boolean;
  readonly length_m: string;
};

export type VerticalLinkRow = {
  readonly id: string;
  readonly org_id: string;
  readonly edge_id: string;
  readonly kind: string;
  readonly capacity: number;
  readonly accessible: boolean;
};

export type CategoryRow = {
  readonly id: string;
  readonly org_id: string;
  readonly sector_key: string;
  readonly code: string;
  readonly parent_id: string | null;
};

export type PictogramRow = {
  readonly id: string;
  readonly org_id: string;
  readonly category_id: string;
  readonly source: string;
  readonly standard_ref: string;
  readonly svg_path: string;
  readonly registry: string;
};

export type DestinationRow = {
  readonly id: string;
  readonly org_id: string;
  readonly footprint_id: string;
  readonly node_id: string;
  readonly category_id: string;
  readonly occupant_name: string;
  readonly occupancy_status: string;
  readonly display_priority: number;
  /** N1.2 / S5 — `date`, rendue en chaîne `AAAA-MM-JJ` par les deux chemins. */
  readonly valid_from: string | null;
  readonly valid_to: string | null;
};

export type DestinationNameRow = {
  readonly id: string;
  readonly org_id: string;
  readonly destination_id: string;
  readonly lang: string;
  readonly value: string;
};

export type TravelProfileRow = {
  readonly id: string;
  readonly org_id: string;
  readonly site_id: string;
  readonly key: string;
  readonly name: string;
  readonly excluded_edge_kinds: unknown;
  readonly require_accessible: boolean;
  readonly honor_hours: boolean;
};

export type SupportRow = {
  readonly id: string;
  readonly org_id: string;
  readonly site_id: string;
  readonly node_id: string;
  readonly registry: string | null;
  readonly context: string | null;
  readonly reading_distance_m: string | null;
  readonly azimuth_deg: string;
  readonly width_mm: number | null;
  readonly height_mm: number | null;
  readonly dimensions_source: string | null;
};

export type SupportTypologyRow = {
  readonly id: string;
  readonly org_id: string;
  readonly key: string;
  readonly name: string;
  readonly face_count: number;
  readonly template_key: string | null;
};

export type SupportFaceRow = {
  readonly id: string;
  readonly org_id: string;
  readonly support_id: string;
  readonly face_index: number | null;
  readonly template_key: string | null;
  readonly langs: unknown;
};

export type SupportContentBlockRow = {
  readonly id: string;
  readonly org_id: string;
  readonly face_id: string;
  readonly block_index: number | null;
  readonly ordinal: number;
  readonly kind: string;
  readonly binding: unknown;
  readonly free_text: unknown;
};

export type SupportVersionRow = {
  readonly id: string;
  readonly org_id: string;
  readonly support_id: string;
  readonly version: number;
  readonly state: string;
  readonly artwork_path: string | null;
  readonly content_hash: string | null;
  readonly created_at: TimestampValue;
  readonly created_by: string | null;
};

/** Toutes les lignes d'un site, telles qu'un chemin de lecture les rassemble. */
/** Complément atelier M2 — lignes du stationnement. */
export type ParkingRow = {
  readonly id: string;
  readonly org_id: string;
  readonly level_id: string;
  readonly geometry: unknown;
  readonly name: string;
  readonly free: boolean;
  readonly declared_capacity: number;
  readonly status: string;
  readonly source: string;
};

export type ParkingSpaceRow = {
  readonly id: string;
  readonly org_id: string;
  readonly parking_id: string;
  readonly kind: string;
  readonly row_label: string;
  readonly geometry: unknown;
  readonly status: string;
  readonly source: string;
};

export type ParkingUncoveredAreaRow = {
  readonly id: string;
  readonly org_id: string;
  readonly parking_id: string;
  readonly geometry: unknown;
  readonly reason: string;
};

export type VehicleGateRow = {
  readonly id: string;
  readonly org_id: string;
  readonly level_id: string;
  readonly code: string;
  readonly role: string;
  readonly width_m: string;
  readonly position: unknown;
  readonly status: string;
  readonly source: string;
};

export type SiteRowSet = {
  readonly organization: OrganizationRow;
  readonly site: SiteRow;
  readonly buildings: readonly BuildingRow[];
  readonly levels: readonly LevelRow[];
  readonly plan_sources: readonly PlanSourceRow[];
  readonly plan_calibrations: readonly PlanCalibrationRow[];
  readonly footprints: readonly FootprintRow[];
  readonly volumes: readonly VolumeRow[];
  readonly nodes: readonly NodeRow[];
  readonly edges: readonly EdgeRow[];
  readonly vertical_links: readonly VerticalLinkRow[];
  readonly categories: readonly CategoryRow[];
  readonly pictograms: readonly PictogramRow[];
  readonly destinations: readonly DestinationRow[];
  readonly destination_names: readonly DestinationNameRow[];
  readonly travel_profiles: readonly TravelProfileRow[];
  readonly supports: readonly SupportRow[];
  readonly support_typologies: readonly SupportTypologyRow[];
  readonly support_faces: readonly SupportFaceRow[];
  readonly content_blocks: readonly SupportContentBlockRow[];
  readonly support_versions: readonly SupportVersionRow[];
  readonly parkings: readonly ParkingRow[];
  readonly parking_spaces: readonly ParkingSpaceRow[];
  readonly parking_uncovered: readonly ParkingUncoveredAreaRow[];
  readonly vehicle_gates: readonly VehicleGateRow[];
};
