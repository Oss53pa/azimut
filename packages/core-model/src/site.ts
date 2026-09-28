import type { ParkingSpace } from './parking.js';
import type { Polygon, Point } from './geometry.js';
import type { PlanSource, PlanCalibration } from './plan.js';
import type { ActiveLang } from './lang.js';
import type { OpeningHours } from './opening-hours.js';
import type { TemporaryClosure } from './temporary-closure.js';
import type { FootprintKind, SiteZone } from './site-kinds.js';

export {
  FOOTPRINT_KINDS, isFootprintKind, ZONE_KINDS, isSiteZoneKind, OPENING_KINDS, isOpeningKind,
  CELL_FOOTPRINT_KIND, isCellFootprint,
  PARKING_SPACE_FOOTPRINT_KIND, isParkingSpaceFootprint, PARKING_ZONE_KIND, isParkingZone,
} from './site-kinds.js';
export type { FootprintKind, SiteZoneKind, OpeningKind, SiteZone } from './site-kinds.js';

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
  supportTypologyOf,
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
  /**
   * O4 et A5.2 — fuseau du site, requis.
   *
   * Tous les horaires, disponibilités d'arêtes, plages de fermeture et
   * échéances s'y interprètent. Les horodatages techniques restent en temps
   * universel.
   */
  readonly timezone: string;
  /**
   * Q5 — entité juridique émettrice, facultative à la création et requise
   * avant l'émission de la première facture. Elle ne sert qu'à facturer.
   */
  readonly legal_entity_id?: string;
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

/**
 * A5.3 et M01.S10 — le passage entre deux bâtiments.
 *
 * « Toute arête dont les deux extrémités appartiennent à des bâtiments
 * différents porte une ligne `building_link`, qui déclare si le passage est
 * couvert. » Règle symétrique de celle des liaisons verticales : la
 * connectivité est portée par l'arête, l'attribut de passage par la liaison.
 *
 * **Limite déclarée**, celle que la règle nomme elle-même : aucun calcul ne
 * lit `sheltered` aujourd'hui. L'attribut est conservé parce qu'un cheminement
 * extérieur non couvert change le parcours réel d'un visiteur, et qu'aucune
 * autre donnée ne le porte.
 */
export type BuildingLink = {
  readonly id: string;
  readonly org_id: string;
  readonly edge_id: string;
  readonly from_building_id: string;
  readonly to_building_id: string;
  readonly sheltered: boolean;
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
  /**
   * À quoi sert ce pictogramme, et non d'où il vient — A5.4.
   *
   * C'est par elle qu'un moteur demande « le pictogramme d'accessibilité »
   * sans connaître son code. Voir `pictogram-functions.ts`, qui porte le
   * vocabulaire et la résolution. `null` pour un pictogramme qui ne sert
   * aucune fonction nommée, ce qui est le cas courant.
   */
  readonly function_key: string | null;
  /**
   * Le paquet de règles qui porte ce pictogramme — A5.4.
   *
   * Requis pour le registre de sécurité, d'où vient toute désignation de ce
   * registre ; c'est aussi la portée de son unicité : une fonction y est
   * désignée au plus une fois par paquet. `null` pour un pictogramme
   * d'orientation, qui ne relève d'aucun paquet.
   */
  readonly rules_pack_id: string | null;
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
  /** M01.S10. La table existait en base sans que rien ne la lise. */
  readonly building_links: readonly BuildingLink[];
};

/** A5.8 — le rôle d'un paquet rattaché à un site. */
export type RulesPackRole = 'base' | 'overlay';

/**
 * A5.8 — le rattachement d'un site à un paquet de règles.
 *
 * « Cette table fait foi pour le rattachement d'un site à ses paquets. Un site
 * porte au plus un socle et au plus une surcouche pays. » Le site ne porte plus
 * de colonne de paquet : A5.2 la retire, « une colonne unique ici serait une
 * seconde source pour la même chose ». Voir `rules-bindings.ts`.
 */
export type SiteRulesBinding = {
  readonly id: string;
  readonly rules_pack_id: string;
  readonly role: RulesPackRole;
};

export type SiteData = {
  readonly organization: Organization;
  readonly site: Site;
  /**
   * A5.8 — les paquets rattachés au site, zéro, un ou deux. Requis au type :
   * un site sans rattachement le dit par une liste vide, et un jeu d'essai
   * qui l'oublierait ne compilerait pas au lieu de passer pour non rattaché.
   */
  readonly rules_bindings: readonly SiteRulesBinding[];
  readonly buildings: readonly Building[];
  readonly levels: readonly Level[];
  /**
   * A5.2 — fonds de plan importés et leurs calages. Séparés du reste de la
   * scène parce qu'ils ne sont pas de la géométrie métier : ils disent
   * seulement comment un fond se lit en mètres. Voir `plan.ts`.
   */
  readonly plan_sources: readonly PlanSource[];
  readonly plan_calibrations: readonly PlanCalibration[];
  /**
   * A5.2 — zones du socle, avec les empreintes qu'elles couvrent.
   *
   * Absentes de l'entrée des moteurs jusqu'à la version 17 : une zone ne
   * portait alors qu'un nom et une nature, et aucun contrôle n'avait de raison
   * de la lire. `footprint_ids` change cela, et `DATA.PARKING_SPACE_WITHOUT_ZONE`
   * est le premier contrôle qui s'en sert.
   *
   * Facultatif au type, parce que tous les jeux d'essai antérieurs à la
   * version 17 n'en portent pas, et qu'exiger le champ transformerait une
   * absence de zone en erreur de compilation là où le modèle admet un site
   * sans zone déclarée.
   */
  readonly zones?: readonly SiteZone[];
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
   * A5.3 — ce que les empreintes de place portent en plus, quand elles le
   * portent. Une ligne par empreinte, au plus ; une empreinte sans extension
   * reste une place standard sans repère de travée.
   *
   * Le stationnement n'a plus d'autre entrée ici. Les parkings sont des zones,
   * les places des empreintes, et les capacités annoncées des faits d'A5.11 —
   * section S8, règles S-35 à S-37.
   */
  readonly parking_spaces: readonly ParkingSpace[];
  /**
   * O11 — les fermetures temporaires du site. Facultatif au type pour les
   * jeux d'essai qui n'en portent pas : absent vaut aucune fermeture.
   */
  readonly temporary_closures?: readonly TemporaryClosure[];
};
