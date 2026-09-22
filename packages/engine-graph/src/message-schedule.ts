/**
 * H2.5 — Tableau des messages.
 *
 * Livrable central du wayfinding : pour chaque face de chaque support,
 * le contenu exact dans chaque langue, le pictogramme, la direction, le
 * niveau d'information et le point de décision qui le justifie.
 *
 * Il est **généré**, jamais saisi. Et il est généré en appelant
 * `resolveFaceContent`, la résolution de contenu existante, plutôt qu'en
 * la réécrivant : sans cela deux chemins de résolution coexisteraient et
 * pourraient diverger, ce que l'invariant 1 interdit.
 *
 * Déterminisme (invariant 4) : aucune horloge, aucun tirage aléatoire.
 * `generated_at` et `version` sont fournis par l'appelant, les
 * identifiants de ligne sont dérivés de leur position, et tout parcours
 * est trié.
 */

import type {
  ContentBlockKind,
  SiteData,
  TravelProfile,
} from '@azimut/core-model';
import { contentHash } from '@azimut/core-model';
import type { PlacedSupport } from './compute-quantities.js';

// ---------------------------------------------------------------------------
// Niveaux d'information (H2.3)
// ---------------------------------------------------------------------------

/** Les quatre niveaux de H2.3, du plus général au plus spécifique. */
export const INFORMATION_LEVELS = [1, 2, 3, 4] as const;

export type InformationLevel = (typeof INFORMATION_LEVELS)[number];

export function isInformationLevel(value: number): value is InformationLevel {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

/**
 * Rattachement d'une typologie à un ou plusieurs niveaux (H2.3).
 * Déclaré en donnée, jamais déduit d'un nom de typologie.
 */
export type TypologyInformationLevels = {
  readonly support_type_key: string;
  readonly levels: readonly InformationLevel[];
};

/**
 * Niveau porté par une ligne, réduit depuis les niveaux déclarés pour
 * la typologie.
 *
 * H11 donne un seul `information_level` par ligne alors qu'une typologie
 * peut en déclarer plusieurs, et la correspondance bloc → niveau n'est
 * spécifiée nulle part. La règle appliquée ici, faute de mieux, est le
 * niveau le plus général déclaré. Elle est isolée dans cette fonction
 * pour être remplacée d'une seule ligne quand la correspondance sera
 * arrêtée.
 */
export function reduceInformationLevel(
  levels: readonly InformationLevel[],
): InformationLevel | null {
  if (levels.length === 0) return null;
  return [...levels].sort((a, b) => a - b)[0] ?? null;
}

// ---------------------------------------------------------------------------
// Principes de wayfinding déclarés (H2.6)
// ---------------------------------------------------------------------------

/**
 * Principes paramétrables par site. Aucune valeur par défaut : une règle
 * absente vaut « non contrôlée », jamais un seuil inventé.
 */
export type WayfindingRules = {
  /** Nombre maximal de destinations par face. null = non contrôlé. */
  readonly max_destinations_per_face: number | null;
};

export const NO_WAYFINDING_RULES: WayfindingRules = {
  max_destinations_per_face: null,
};

// ---------------------------------------------------------------------------
// Lignes et tableau
// ---------------------------------------------------------------------------

/** Une mention portée par un bloc : une destination, une direction. */
export type MessageEntry = {
  readonly destination_id: string | null;
  /** Texte par langue. Clé de langue telle qu'elle figure à l'annuaire. */
  readonly text: Readonly<Record<string, string>>;
  readonly direction: string | null;
  readonly distance_m: number | null;
};

export type MessageLine = {
  /** Identifiant stable, dérivé de la position (H2.5). */
  readonly id: string;
  readonly support_id: string;
  readonly face_index: number;
  readonly block_index: number;
  readonly block_kind: ContentBlockKind;
  /** Contenu structuré du bloc — le `content jsonb` de H11. */
  readonly entries: readonly MessageEntry[];
  readonly pictogram_id: string | null;
  readonly direction: string | null;
  readonly information_level: InformationLevel | null;
  /**
   * N2.2 — **requis**. Le point de décision qui justifie la ligne.
   *
   * M02.W4 : une ligne sans justification est une anomalie bloquante, et le
   * critère N2.7-4 va plus loin — une telle ligne ne peut pas être créée.
   * C'est ce qui empêche un panneau de dire quelque chose que rien ne motive,
   * et c'est pourquoi ce champ n'est pas nullable.
   */
  readonly decision_point_id: string;
  readonly stale: boolean;
};

/**
 * N2.2 et R12 (partie R) — les quatre états d'un tableau, et eux seuls.
 *
 * Le vocabulaire des bons à tirer, `pending` et `rejected`, ne convient pas :
 * R12 fait reposer l'émission pour revue sur `in_review`, qui n'y existe pas,
 * et un rejet y ramène au brouillon au lieu de créer un état propre. Le
 * circuit est le même, au sens de M02.W7, mais les états sont ceux-ci.
 */
export const SCHEDULE_STATES = ['draft', 'in_review', 'approved', 'superseded'] as const;

export type ScheduleState = (typeof SCHEDULE_STATES)[number];

export function isScheduleState(value: string): value is ScheduleState {
  return SCHEDULE_STATES.some(state => state === value);
}

export type MessageSchedule = {
  readonly site_id: string;
  readonly version: number;
  /** Même circuit de validation que les bons à tirer (M02.W7, R12). */
  readonly state: ScheduleState;
  /** ISO-8601, fourni par l'appelant, jamais lu ici. */
  readonly generated_at: string;
  readonly inputs_hash: string;
  readonly lines: readonly MessageLine[];
};

/** Identifiant de ligne : déterministe, lisible, stable entre versions. */
export function messageLineId(
  supportId: string,
  faceIndex: number,
  blockIndex: number,
): string {
  return `${supportId}#${String(faceIndex)}#${String(blockIndex)}`;
}

// ---------------------------------------------------------------------------
// Empreinte des entrées
// ---------------------------------------------------------------------------

export type ScheduleInputs = {
  readonly site: SiteData;
  readonly supports: readonly PlacedSupport[];
  readonly profile: TravelProfile;
  readonly informationLevels: readonly TypologyInformationLevels[];
  readonly rules: WayfindingRules;
};

/**
 * Empreinte de tout ce dont le tableau dépend. Un changement du graphe,
 * de l'annuaire, des supports, des gabarits ou des principes la change,
 * ce qui rend la péremption détectable (H2.5).
 */
export function computeScheduleInputsHash(inputs: ScheduleInputs): string {
  const { site, supports, profile, informationLevels, rules } = inputs;

  return contentHash({
    site_id: site.site.id,
    nodes: [...site.graph.nodes]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(n => ({ id: n.id, kind: n.kind, level_id: n.level_id, position: n.position })),
    edges: [...site.graph.edges]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(e => ({
        id: e.id,
        from: e.from_node_id,
        to: e.to_node_id,
        direction: e.direction,
        accessible: e.accessible,
        length_m: e.length_m,
      })),
    destinations: [...site.destinations]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(d => ({
        id: d.id,
        node_id: d.node_id,
        category_id: d.category_id,
        occupancy_status: d.occupancy_status,
        display_priority: d.display_priority,
      })),
    destination_names: [...site.destination_names]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(n => ({ destination_id: n.destination_id, lang: n.lang, value: n.value })),
    pictograms: [...site.pictograms]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(p => ({ id: p.id, category_id: p.category_id, registry: p.registry })),
    support_types: [...site.support_types]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(t => ({ key: t.key, faces: t.faces.map(f => f.side) })),
    face_templates: [...site.face_templates]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(t => ({
        id: t.id,
        support_type_key: t.support_type_key,
        side: t.side,
        blocks: [...t.blocks]
          .sort((a, b) => a.ordinal - b.ordinal || a.kind.localeCompare(b.kind))
          .map(b => ({ kind: b.kind, ordinal: b.ordinal, region: b.region, config: b.config })),
      })),
    supports: [...supports]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(s => ({ id: s.id, node_id: s.node_id, support_type_key: s.support_type_key })),
    profile: {
      key: profile.key,
      excluded_edge_kinds: [...profile.excluded_edge_kinds].sort(),
      require_accessible: profile.require_accessible,
    },
    information_levels: [...informationLevels]
      .sort((a, b) => a.support_type_key.localeCompare(b.support_type_key))
      .map(l => ({ key: l.support_type_key, levels: [...l.levels].sort((a, b) => a - b) })),
    rules,
  });
}
