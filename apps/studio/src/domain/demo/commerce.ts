/**
 * Jeu de démonstration — modules 05 (régie) et 06 (enseignes locataires).
 *
 * Données synthétiques : aucun annonceur, aucun locataire, aucun contrat réel.
 * Les types déclarés ici sont des modèles de vue et non le modèle A5 ; les
 * contrôles, eux, sont ceux de `domain/ad-planning`, `domain/ad-creative-control`
 * et `domain/tenant-regulation`.
 */
import type { PlacementBooking, PlacementOption } from '../ad-planning.js';
import type { Creative, CreativeSpec } from '../ad-creative-control.js';
import type { SignProject, SignRegulation } from '../tenant-regulation.js';

/** Un emplacement publicitaire commercialisable. Modèle de vue. */
export type Placement = {
  readonly id: string;
  readonly typology: string;
  readonly area_m2: number;
  readonly level_ordinal: number;
  readonly advertiser: string | null;
};

/** Décision humaine rendue sur un visuel, après les contrôles automatiques. */
export const CREATIVE_VERDICTS = ['approved', 'refused', 'human_review'] as const;
export type CreativeVerdict = (typeof CREATIVE_VERDICTS)[number];

export type CreativeSubmission = {
  readonly creative: Creative;
  readonly placement_id: string;
  readonly verdict: CreativeVerdict;
};

export const DEMO_PLACEMENTS: readonly Placement[] = [
  { id: 'AP-N0-01', typology: 'caisson_lumineux', area_m2: 2, level_ordinal: 0, advertiser: 'Groupe Vaudel' },
  { id: 'AP-N0-04', typology: 'totem_numerique', area_m2: 1.4, level_ordinal: 0, advertiser: 'Studio Lampas' },
  { id: 'AP-N1-02', typology: 'bache_galerie', area_m2: 6, level_ordinal: 1, advertiser: 'Maison Berthier' },
  { id: 'AP-N2-07', typology: 'mobilier', area_m2: 1, level_ordinal: 2, advertiser: null },
  { id: 'AP-N-1-03', typology: 'caisson_lumineux', area_m2: 2, level_ordinal: -1, advertiser: null },
];

/**
 * Deux réservations fermes se chevauchent sur AP-N0-04 : le conflit est
 * calculé par `guardPlacementBookings`, il n'est pas écrit ici.
 */
export const DEMO_BOOKINGS: readonly PlacementBooking[] = [
  { id: 'bk-0101', placement_id: 'AP-N0-01', state: 'occupied', from_date: '2026-09-01', to_date: '2026-12-31' },
  { id: 'bk-0102', placement_id: 'AP-N0-04', state: 'reserved', from_date: '2026-10-01', to_date: '2026-11-30' },
  { id: 'bk-0103', placement_id: 'AP-N0-04', state: 'reserved', from_date: '2026-11-01', to_date: '2027-01-31' },
  { id: 'bk-0104', placement_id: 'AP-N1-02', state: 'occupied', from_date: '2026-09-15', to_date: '2027-02-28' },
  { id: 'bk-0105', placement_id: 'AP-N2-07', state: 'option', from_date: '2026-10-01', to_date: '2026-12-31' },
  { id: 'bk-0106', placement_id: 'AP-N-1-03', state: 'maintenance', from_date: '2026-09-10', to_date: '2026-09-20' },
];

export const DEMO_OPTIONS: readonly PlacementOption[] = [
  { id: 'op-0044', placement_id: 'AP-N2-07', expires_at: '2026-09-22' },
  { id: 'op-0045', placement_id: 'AP-N-1-03', expires_at: '2026-09-05' },
  { id: 'op-0046', placement_id: 'AP-N0-04', expires_at: '2026-12-01' },
];

/** Fiche technique d'un emplacement : elle est générée, jamais saisie (H4.2). */
export const DEMO_CREATIVE_SPEC: CreativeSpec = {
  format: 'pdf',
  min_resolution_dpi: 150,
  safe_zone_mm: 10,
  color_profile: 'CMYK',
  max_weight_bytes: 50 * 1024 * 1024,
};

export const DEMO_CREATIVES: readonly CreativeSubmission[] = [
  {
    placement_id: 'AP-N0-01',
    verdict: 'refused',
    creative: {
      id: 'cr-0231',
      format: 'pdf',
      resolution_dpi: 118,
      safe_zone_mm: 10,
      color_profile: 'CMYK',
      weight_bytes: 12_400_000,
    },
  },
  {
    placement_id: 'AP-N1-02',
    verdict: 'human_review',
    creative: {
      id: 'cr-0244',
      format: 'pdf',
      resolution_dpi: 300,
      safe_zone_mm: 12,
      color_profile: 'CMYK',
      weight_bytes: 28_900_000,
    },
  },
  {
    placement_id: 'AP-N2-07',
    verdict: 'approved',
    creative: {
      id: 'cr-0250',
      format: 'pdf',
      resolution_dpi: 220,
      safe_zone_mm: 14,
      color_profile: 'CMYK',
      weight_bytes: 6_100_000,
    },
  },
  {
    placement_id: 'AP-N0-04',
    verdict: 'refused',
    creative: {
      id: 'cr-0255',
      format: 'png',
      resolution_dpi: 96,
      safe_zone_mm: 4,
      color_profile: 'RGB',
      weight_bytes: 61_000_000,
    },
  },
];

// ---------------------------------------------------------------------------
// Module 06 — enseignes locataires
// ---------------------------------------------------------------------------

export const SIGN_DOSSIER_STATES = ['submitted', 'instructing', 'approved', 'refused'] as const;
export type SignDossierState = (typeof SIGN_DOSSIER_STATES)[number];

export type SignDossier = {
  readonly id: string;
  readonly cell_code: string;
  readonly tenant: string;
  readonly state: SignDossierState;
  readonly submitted_on: string;
  readonly project: SignProject;
  /** Pièces attendues au dossier ; `false` = manquante. */
  readonly parts: readonly { readonly key: string; readonly provided: boolean }[];
};

/** Règlement d'enseigne du site. Paramétré par site, jamais écrit en dur ailleurs. */
export const DEMO_SIGN_REGULATION: SignRegulation = {
  max_height_mm: 900,
  max_overhang_mm: 120,
  allowed_materials: ['laiton', 'acier', 'bois'],
  allowed_lighting: ['retro_eclaire', 'indirect'],
  forbidden_features: ['clignotement', 'neon_nu'],
};

export const DEMO_SIGN_DOSSIERS: readonly SignDossier[] = [
  {
    id: 'ts-0118',
    cell_code: 'c-n0-118',
    tenant: 'Optique Valmy',
    state: 'instructing',
    submitted_on: '2026-09-11',
    project: {
      id: 'ts-0118',
      height_mm: 1120,
      overhang_mm: 95,
      material: 'plexiglas',
      lighting: 'retro_eclaire',
      features: ['neon_nu'],
    },
    parts: [
      { key: 'elevation', provided: true },
      { key: 'section', provided: true },
      { key: 'material_samples', provided: false },
    ],
  },
  {
    id: 'ts-0031',
    cell_code: 'c-n1-031',
    tenant: 'Prêt-à-porter Sextant',
    state: 'approved',
    submitted_on: '2026-09-08',
    project: {
      id: 'ts-0031',
      height_mm: 740,
      overhang_mm: 80,
      material: 'laiton',
      lighting: 'indirect',
      features: [],
    },
    parts: [
      { key: 'elevation', provided: true },
      { key: 'section', provided: true },
      { key: 'material_samples', provided: true },
    ],
  },
  {
    id: 'ts-0009',
    cell_code: 'c-n2-009',
    tenant: 'Table du Marché',
    state: 'submitted',
    submitted_on: '2026-09-14',
    project: {
      id: 'ts-0009',
      height_mm: 880,
      overhang_mm: 140,
      material: 'bois',
      lighting: 'retro_eclaire',
      features: [],
    },
    parts: [
      { key: 'elevation', provided: true },
      { key: 'section', provided: false },
      { key: 'material_samples', provided: true },
    ],
  },
];
