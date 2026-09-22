import type { Polygon, Point } from './geometry.js';
import type { Parking, ParkingSpace, UncoveredArea, Provenance } from './parking.js';
import type { PlanSource, PlanCalibration } from './plan.js';
import type { ActiveLang } from './lang.js';
import type { OpeningHours } from './opening-hours.js';

import type {
  SupportType,
  Support,
  SupportFace,
  ContentBlockInstance,
  SupportVersion,
  FaceTemplate,
} from './site-signage.js';
export type {
  SupportTypeFace,
  SupportType,
  SupportContext,
  DimensionsSource,
  Support,
  SupportFace,
  ContentBlockInstance,
  SupportVersionState,
  SupportVersion,
  ContentBlockKind,
  ContentBlockDef,
  FaceTemplate,
  ProofStatus,
  Proof,
  ApprovalDecision,
  Approval,
} from './site-signage.js';
export {
  SUPPORT_VERSION_STATES,
} from './site-signage.js';

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
  /**
   * N1.2 — langues actives. Au moins une est attendue ; une liste vide dit que
   * rien n'est déclaré, et non que le français s'applique. Voir `lang.ts`.
   */
  readonly active_langs: readonly ActiveLang[];
  /**
   * M01.S1 / D1.1 / N1.2 — origine du repère site, en mètres.
   *
   * Les deux nombres sont ceux du premier calage du site, recopiés ici, et
   * jamais modifiés ensuite. Absents tant qu'aucun calage n'a eu lieu : un
   * repère non posé ne se lit pas comme un repère à l'origine (0, 0). Les deux
   * colonnes s'apparient par `siteOrigin` et se protègent par
   * `guardSiteOrigin` — voir `plan.ts`.
   */
  readonly origin_x_m?: number;
  readonly origin_y_m?: number;
  /**
   * D1.1 / N1.2 — altitude du niveau de référence, à laquelle Z vaut 0.
   * Absente quand l'altitude absolue du site n'est pas relevée : les
   * `level.elevation_m` restent justes, ils sont relatifs à ce niveau.
   */
  readonly reference_elevation_m?: number;
};

export type Building = {
  readonly id: string;
  readonly org_id: string;
  readonly site_id: string;
  readonly name: string;
  readonly independent_access: boolean;
  /** N1.2 — horaires d'ouverture. Absents quand rien n'est déclaré. Voir `opening-hours.ts`. */
  readonly opening_hours?: OpeningHours;
  /**
   * N1.2 — largeur héritée par les arêtes du bâtiment à leur création.
   *
   * Une valeur de saisie, pas une valeur de calcul : `edge.width_m` reste la
   * seule largeur qu'un moteur lit (M01.S6 pour la longueur, même principe). Une
   * arête déjà tracée ne change pas de largeur parce que celle-ci change.
   */
  readonly default_edge_width_m?: number;
};

export type Level = {
  readonly id: string;
  readonly org_id: string;
  readonly building_id: string;
  readonly name: string;
  readonly ordinal: number;
  readonly elevation_m: number;
};

/**
 * N1.2 — natures d'empreinte, énuméré fermé.
 *
 * La liste fait foi : une nature hors liste n'est pas représentable. La base
 * porte la même contrainte par un CHECK (migration 0019), comme pour toute
 * autre énumération du schéma — `node.kind`, `vertical_link.kind`,
 * `destination.occupancy_status`. Un test structurel vérifie que les deux
 * listes coïncident.
 *
 * Conséquence assumée pour les imports : une nature étrangère doit être
 * traduite vers l'une de ces cinq, ou refusée avec un code. Elle ne peut plus
 * être portée telle quelle jusqu'au modèle, où elle échappait à tout contrôle.
 */
export const FOOTPRINT_KINDS = [
  'cell',
  'circulation',
  'technical',
  'vertical_core',
  'outdoor',
] as const;

export type FootprintKind = (typeof FOOTPRINT_KINDS)[number];

/**
 * Restreint une chaîne venue de l'extérieur — base, import, fichier — à une
 * nature connue. À employer à toute frontière qui reçoit du texte libre.
 */
export function isFootprintKind(value: string): value is FootprintKind {
  return (FOOTPRINT_KINDS as readonly string[]).includes(value);
}

/**
 * A5.2 — natures de zone, énuméré fermé.
 *
 * Une zone du socle est une division technique du niveau. Elle ne se confond
 * pas avec la zone d'orientation du module 02, qui a sa table et ses propres
 * natures : un même espace peut relever de deux zones d'orientation selon le
 * parcours, ce qu'une zone du socle ne permet pas.
 */
export const ZONE_KINDS = [
  'commercial',
  'food',
  'service',
  'technical',
  'parking',
  'outdoor',
] as const;

export type SiteZoneKind = (typeof ZONE_KINDS)[number];

export function isSiteZoneKind(value: string): value is SiteZoneKind {
  return (ZONE_KINDS as readonly string[]).includes(value);
}

/** A5.2 — natures d'ouverture, énuméré fermé. */
export const OPENING_KINDS = [
  'door',
  'automatic_door',
  'emergency_door',
  'shop_front',
  'bay',
] as const;

export type OpeningKind = (typeof OPENING_KINDS)[number];

export function isOpeningKind(value: string): value is OpeningKind {
  return (OPENING_KINDS as readonly string[]).includes(value);
}

/** Nature portant un code d'unité obligatoire (règle M01.S3). */
export const CELL_FOOTPRINT_KIND = 'cell';

/** Vrai pour une empreinte de cellule, seule nature que M01.S3 contraint. */
export function isCellFootprint(kind: FootprintKind): boolean {
  return kind === CELL_FOOTPRINT_KIND;
}

export type Footprint = {
  readonly id: string;
  readonly org_id: string;
  readonly level_id: string;
  readonly geometry: Polygon;
  readonly kind: FootprintKind;
  /**
   * N1.2 — code d'unité locative. Requis quand la nature est `cell`, unique
   * par niveau ; absent pour les autres natures.
   *
   * Le champ est facultatif au modèle et la contrainte vit dans les contrôles
   * (`DATA.UNIT_CODE_REQUIRED`, `DATA.CODE_DUPLICATE`) : une empreinte relevée
   * avant que son code soit connu se charge et se signale, elle ne disparaît
   * pas.
   */
  readonly unit_code?: string;
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
  /**
   * N1.2 / M01.S5 — période d'occupation, dates ISO 8601 `AAAA-MM-JJ`.
   *
   * L'historique est conservé : une cellule peut porter plusieurs occupants
   * successifs, chacun avec sa période. `valid_to` absent désigne l'occupant
   * en cours, dont la sortie n'est pas connue ; `valid_from` absent, une
   * occupation dont l'entrée n'a pas été relevée.
   */
  readonly valid_from?: string;
  readonly valid_to?: string;
};

export type DestinationName = {
  readonly id: string;
  readonly org_id: string;
  readonly destination_id: string;
  /** Même énuméré que `site.active_langs` : voir `lang.ts`. */
  readonly lang: ActiveLang;
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
  /**
   * A5.2 — fonds de plan importés et leurs calages. Séparés du reste de la
   * scène parce qu'ils ne sont pas de la géométrie métier : ils disent
   * seulement comment un fond se lit en mètres. Voir `plan.ts`.
   */
  readonly plan_sources: readonly PlanSource[];
  readonly plan_calibrations: readonly PlanCalibration[];
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
