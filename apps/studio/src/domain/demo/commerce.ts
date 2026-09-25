/**
 * Jeu de démonstration — modules 05 (régie) et 06 (enseignes locataires).
 *
 * Données synthétiques : aucun annonceur, aucun locataire, aucun contrat réel.
 * Les types déclarés ici sont des modèles de vue et non le modèle A5 ; les
 * contrôles, eux, sont ceux de `domain/ad-planning`, `domain/ad-creative-control`
 * et `domain/tenant-regulation`.
 */
import type { AdRulesPack } from '@azimut/engine-graph';
import type { SignProject, SignRegulation } from '../tenant-regulation.js';

/**
 * N5.2-R7 / I5.4 — paquet de règles publicitaires.
 *
 * Aucun n'est rattaché, et ce n'est pas un oubli du jeu d'essai : N5.7 pose que
 * le corpus réglementaire publicitaire par pays n'existe pas encore —
 * « mécanisme prêt, contenu absent ». M05.R7 veut qu'en son absence le module lève
 * une anomalie et n'invente aucune règle. En attacher un ici inventerait
 * justement ce que M05.R7 interdit d'inventer.
 */
export const DEMO_AD_RULES_PACK: AdRulesPack | null = null;

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
