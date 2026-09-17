import type { Polygon, Point } from './geometry.js';
import type { Parking, ParkingSpace, UncoveredArea, Provenance } from './parking.js';

export type Organization = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
};

export type Site = {
  readonly id: string;
  readonly org_id: string;
  readonly name: string;
  readonly country_code: string;
  readonly rules_pack_id: string | null;
};

export type Building = {
  readonly id: string;
  readonly org_id: string;
  readonly site_id: string;
  readonly name: string;
  readonly independent_access: boolean;
};

export type Level = {
  readonly id: string;
  readonly org_id: string;
  readonly building_id: string;
  readonly name: string;
  readonly ordinal: number;
  readonly elevation_m: number;
};

export type FootprintKind = string;

export type Footprint = {
  readonly id: string;
  readonly org_id: string;
  readonly level_id: string;
  readonly geometry: Polygon;
  readonly kind: FootprintKind;
};

export type Volume = {
  readonly id: string;
  readonly org_id: string;
  readonly footprint_id: string;
  readonly base_elevation_m: number;
  readonly height_m: number;
  readonly material_key: string;
  /**
   * K2.1 — Optional manual painter order. Null/absent by default (the computed
   * depth sort applies); when set, it takes precedence over the computed sort.
   */
  readonly render_order?: number | null;
};

export type NodeKind =
  | 'entrance'
  | 'junction'
  | 'landing'
  | 'elevator'
  | 'stair'
  | 'escalator'
  | 'emergency_exit'
  | 'restroom'
  | 'security_post'
  | 'information_point'
  | 'destination_access';

export type GraphNode = {
  readonly id: string;
  readonly org_id: string;
  readonly level_id: string;
  readonly kind: NodeKind;
  readonly position: Point;
  readonly label: string;
};

export type EdgeDirection = 'both' | 'forward' | 'backward';

export type Edge = {
  readonly id: string;
  readonly org_id: string;
  readonly from_node_id: string;
  readonly to_node_id: string;
  readonly width_m: number;
  readonly slope_pct: number;
  readonly accessible: boolean;
  readonly direction: EdgeDirection;
  readonly evacuation_route: boolean;
  readonly length_m: number;
};

export type VerticalLinkKind =
  | 'elevator'
  | 'stair'
  | 'escalator'
  | 'ramp';

export type VerticalLink = {
  readonly id: string;
  readonly org_id: string;
  readonly edge_id: string;
  readonly kind: VerticalLinkKind;
  readonly capacity: number;
  readonly accessible: boolean;
};

export type Category = {
  readonly id: string;
  readonly org_id: string;
  readonly sector_key: string;
  readonly code: string;
  readonly parent_id: string | null;
};

export type PictogramRegistry = 'safety' | 'wayfinding';

export type Pictogram = {
  readonly id: string;
  readonly org_id: string;
  readonly category_id: string;
  readonly source: string;
  readonly standard_ref: string;
  readonly svg_path: string;
  readonly registry: PictogramRegistry;
};

export type OccupancyStatus =
  | 'occupied'
  | 'vacant'
  | 'reserved'
  | 'under_fit_out';

export type Destination = {
  readonly id: string;
  readonly org_id: string;
  readonly footprint_id: string;
  readonly node_id: string;
  readonly category_id: string;
  readonly occupant_name: string;
  readonly occupancy_status: OccupancyStatus;
  readonly display_priority: number;
};

export type DestinationName = {
  readonly id: string;
  readonly org_id: string;
  readonly destination_id: string;
  readonly lang: 'fr' | 'en';
  readonly value: string;
};

export type SupportTypeFace = {
  readonly side: string;
  readonly default_width_mm: number;
  readonly default_height_mm: number;
};

/**
 * A support typology (A5.6 `support_typology`) — the template of a physical
 * support model. `template_key` binds it to a face template. `faces` carries
 * the typology's default face sizes, a convenience seed for composition: the
 * authoritative per-support dimensions live on the `Support` instance (A5.6),
 * so a typology loaded from the database (which stores no per-face default)
 * simply has no `faces` and the instance dimensions, then a fallback, apply.
 */
export type SupportType = {
  readonly id: string;
  readonly org_id: string;
  readonly key: string;
  readonly name: string;
  readonly face_count: number;
  readonly template_key?: string;
  readonly faces: readonly SupportTypeFace[];
};

/**
 * Reading context of a support — indoors or outdoors. It scopes the rules
 * (D3.3/D3.5 `context` dimension: interior thresholds differ from exterior).
 * The spec does not derive it from geometry: whether a panel is indoors is a
 * placement fact a surveyor records, like the azimuth and mounting, so it is
 * carried explicitly on the support rather than inferred from footprints.
 */
export type SupportContext = 'interior' | 'exterior';

/**
 * A support instance (A5.6 `support`) — a physical panel placed on a node.
 * Carries the per-instance normative inputs the typology cannot hold: the
 * reading distance that feeds the legibility formula, the registry that scopes
 * the rules (and drives the safety hardening), and the reading context. Minimal
 * A5.6 subset: the remaining columns (typology link, dimensions_source,
 * substrate, mounting) are additive and not yet modelled in memory.
 */
/** A5.6 — whether a support's dimensions are engine-computed or hand-set. */
export type DimensionsSource = 'computed' | 'overridden';

export type Support = {
  readonly id: string;
  readonly org_id: string;
  readonly site_id: string;
  readonly node_id: string;
  readonly registry: PictogramRegistry;
  readonly context: SupportContext;
  readonly reading_distance_m: number;
  readonly azimuth_deg: number;
  /**
   * A5.6 — dimensions carried by the instance (mm). When set they override the
   * typology's default face size; when absent the typology default is used.
   */
  readonly width_mm?: number;
  readonly height_mm?: number;
  readonly dimensions_source?: DimensionsSource;
};

/**
 * A5.6 `support_face` — one face of a support instance. Binds to a face
 * template for its layout (`template_key`) and declares the active languages.
 * Loaded for A5.6 completeness; composition still runs off the type-level
 * FaceTemplate + message schedule, so nothing consumes this yet.
 */
export type SupportFace = {
  readonly id: string;
  readonly org_id: string;
  readonly support_id: string;
  readonly face_index: number;
  readonly template_key?: string;
  readonly langs?: readonly string[];
};

/**
 * A5.6 `content_block` — one block of a support face. `kind` is the block
 * category ('resolved' | 'free' | 'pictogram' | 'map' | 'legend'); it is kept
 * as a raw string because the pre-A5.6 column may still hold a render kind and
 * nothing consumes it yet. `binding` describes how a resolved block resolves;
 * `free_text` carries a free block's text. Both are opaque JSON here.
 */
export type ContentBlockInstance = {
  readonly id: string;
  readonly org_id: string;
  readonly face_id: string;
  readonly block_index: number;
  readonly kind: string;
  readonly binding?: Record<string, unknown>;
  readonly free_text?: Record<string, unknown>;
};

/** A5.6 `support_version` state — the approval lifecycle of a support. */
export type SupportVersionState =
  | 'draft' | 'in_review' | 'approved' | 'superseded';

/**
 * A5.6 `support_version` — a versioned state of a support (its proof/approval
 * spine), with the content hash and the produced artwork path. Loaded for
 * completeness; the compile/approval flow does not read it yet.
 */
export type SupportVersion = {
  readonly id: string;
  readonly org_id: string;
  readonly support_id: string;
  readonly version: number;
  readonly state: SupportVersionState;
  readonly artwork_path?: string;
  readonly content_hash?: string;
  readonly created_at: string;
  readonly created_by?: string;
};

export type ContentBlockKind =
  | 'header'
  | 'destination_list'
  | 'pictogram'
  | 'arrow'
  | 'map'
  | 'legend'
  | 'free_text'
  | 'logo'
  | 'emergency_info';

export type ContentBlockDef = {
  readonly kind: ContentBlockKind;
  readonly ordinal: number;
  readonly region: {
    readonly x_pct: number;
    readonly y_pct: number;
    readonly w_pct: number;
    readonly h_pct: number;
  };
  readonly config: Record<string, unknown>;
};

export type FaceTemplate = {
  readonly id: string;
  readonly org_id: string;
  readonly support_type_key: string;
  readonly side: string;
  readonly name: string;
  readonly blocks: readonly ContentBlockDef[];
};

export type ProofStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'superseded';

export type Proof = {
  readonly id: string;
  readonly org_id: string;
  readonly face_id: string;
  readonly version: number;
  readonly storage_path: string;
  readonly status: ProofStatus;
  readonly submitted_at: string;
  readonly reviewed_at: string | null;
  readonly reviewer_id: string | null;
};

export type ApprovalDecision = 'approved' | 'rejected';

export type Approval = {
  readonly id: string;
  readonly org_id: string;
  readonly proof_id: string;
  readonly decision: ApprovalDecision;
  readonly reviewer_id: string;
  readonly comment: string;
  readonly decided_at: string;
};

export type TravelProfile = {
  readonly id: string;
  readonly org_id: string;
  readonly site_id: string;
  readonly key: string;
  readonly name: string;
  readonly excluded_edge_kinds: readonly string[];
  readonly require_accessible: boolean;
  readonly honor_hours: boolean;
};

export type SiteGraph = {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly Edge[];
  readonly vertical_links: readonly VerticalLink[];
};

/** Complément atelier M2 — un portail ou un accès véhicule. */
export type VehicleGate = {
  readonly id: string;
  readonly org_id: string;
  readonly level_id: string;
  /** Code du plan source : V1 à V5 sur Cosmos Angré. */
  readonly code: string;
  readonly role: string;
  readonly width_m: number;
  readonly position: Point;
  readonly provenance: Provenance;
};

export type SiteData = {
  readonly organization: Organization;
  readonly site: Site;
  readonly buildings: readonly Building[];
  readonly levels: readonly Level[];
  readonly footprints: readonly Footprint[];
  readonly volumes: readonly Volume[];
  readonly graph: SiteGraph;
  readonly categories: readonly Category[];
  readonly pictograms: readonly Pictogram[];
  readonly destinations: readonly Destination[];
  readonly destination_names: readonly DestinationName[];
  readonly travel_profiles: readonly TravelProfile[];
  readonly support_types: readonly SupportType[];
  readonly supports: readonly Support[];
  readonly support_faces: readonly SupportFace[];
  readonly content_blocks: readonly ContentBlockInstance[];
  readonly support_versions: readonly SupportVersion[];
  readonly face_templates: readonly FaceTemplate[];
  /**
   * Complément atelier M2 — le stationnement fait partie de la géométrie du
   * site, au même titre que les empreintes : un parking se dessine sur un plan
   * et se compte. Il entre donc ici, et non dans un registre à part comme le
   * vocabulaire, qui lui n'est pas de la géométrie.
   */
  readonly parkings: readonly Parking[];
  readonly parking_spaces: readonly ParkingSpace[];
  readonly parking_uncovered: readonly UncoveredArea[];
  readonly vehicle_gates: readonly VehicleGate[];
};
