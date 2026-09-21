import type { PictogramRegistry } from './site.js';

/**
 * A5.6 — la famille signalétique du modèle : type de support, support, face,
 * bloc de contenu, gabarit, version, épreuve et approbation.
 *
 * Sortie de `site.ts`, qui franchissait les quatre cents lignes (A2.4). La
 * coupure suit la matière : d'un côté le site et son graphe, de l'autre ce
 * qu'on y pose. `site.ts` les réexporte, si bien qu'aucun appelant ne change.
 */
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
/** A5.6 / G7 — états d'une version de support, énuméré fermé. */
export const SUPPORT_VERSION_STATES = [
  'draft', 'in_review', 'approved', 'superseded',
] as const;

export type SupportVersionState = (typeof SUPPORT_VERSION_STATES)[number];

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
