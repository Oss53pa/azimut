import type { Polygon, Point } from './geometry.js';

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
};
