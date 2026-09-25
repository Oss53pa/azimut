/**
 * Jeu de démonstration — modules 08 (exploitation) et 09 (budget). Celui du
 * module 07 est servi par le dépôt de référence (`data/reference-worksite.ts`).
 *
 * Données synthétiques : aucun fabricant, aucun relevé, aucun coût réel. Les
 * contrôles employés sont ceux de `domain/install-reserves`, `domain/survey-sync`
 * et `domain/cost-reference`.
 *
 * Les montants sont stockés en unité mineure avec leur devise (H8) : jamais un
 * flottant d'euros, jamais une conversion implicite à l'affichage.
 */
import type { SurveyRecord } from '../survey-sync.js';

// ---------------------------------------------------------------------------
// Module 08 — exploitation
// ---------------------------------------------------------------------------

export type InspectionRound = {
  readonly survey: SurveyRecord;
  readonly zone: string;
  readonly surveyed_on: string | null;
  readonly surveyor: string | null;
  readonly observation_count: number;
};

export const OBSERVATION_SEVERITIES = ['blocking', 'warning'] as const;
export type ObservationSeverity = (typeof OBSERVATION_SEVERITIES)[number];

export type FieldObservation = {
  readonly id: string;
  readonly support_id: string;
  readonly nature_key: string;
  readonly severity: ObservationSeverity;
  readonly round_id: string;
};

export const DEMO_ROUNDS: readonly InspectionRound[] = [
  {
    survey: { id: 'ir-0142', sync_state: 'synced' },
    zone: 'N0 galerie sud', surveyed_on: '2026-09-14', surveyor: 'a.dieng', observation_count: 6,
  },
  {
    survey: { id: 'ir-0143', sync_state: 'pending' },
    zone: 'N-1 parking', surveyed_on: '2026-09-15', surveyor: 'a.dieng', observation_count: 11,
  },
  {
    survey: { id: 'ir-0144', sync_state: 'pending' },
    zone: 'N2 restauration', surveyed_on: '2026-09-15', surveyor: 'l.marchand', observation_count: 3,
  },
];

export const DEMO_OBSERVATIONS: readonly FieldObservation[] = [
  { id: 'if-0611', support_id: 'S-N-1-02', nature_key: 'operations.nature.lamp_out', severity: 'blocking', round_id: 'ir-0143' },
  { id: 'if-0612', support_id: 'S-N0-09', nature_key: 'operations.nature.soiled', severity: 'warning', round_id: 'ir-0142' },
  { id: 'if-0613', support_id: 'S-N1-07', nature_key: 'operations.nature.fixing', severity: 'warning', round_id: 'ir-0142' },
  { id: 'if-0614', support_id: 'S-N2-03', nature_key: 'operations.nature.content_diverges', severity: 'blocking', round_id: 'ir-0144' },
];

// ---------------------------------------------------------------------------
// Module 09 — budget
// ---------------------------------------------------------------------------

/** Montant en unité mineure (centimes) avec sa devise. Jamais converti ici. */
export type Money = {
  readonly minor: number;
  readonly currency: string;
};

export type CostReference = {
  readonly typology: string;
  readonly substrate: string;
  readonly manufacturer: string | null;
  readonly unit_cost: Money | null;
  readonly since: string | null;
};

export type BudgetLine = {
  readonly id: string;
  readonly phase_key: string;
  readonly lot_id: string | null;
  readonly estimated: Money | null;
  readonly quoted: Money | null;
  readonly actual: Money | null;
};

export const DEMO_COST_REFERENCES: readonly CostReference[] = [
  { typology: 'totem_directionnel', substrate: 'alu_laque', manufacturer: 'Métalier Sud', unit_cost: { minor: 124_000, currency: 'EUR' }, since: '2026-01' },
  { typology: 'drapeau_suspendu', substrate: 'dibond', manufacturer: 'Sérigraphie Valmont', unit_cost: { minor: 38_500, currency: 'EUR' }, since: '2026-04' },
  { typology: 'plan_mural', substrate: 'verre_serigraphie', manufacturer: null, unit_cost: null, since: null },
  { typology: 'bandeau_porte', substrate: 'vinyle', manufacturer: 'Sérigraphie Valmont', unit_cost: { minor: 4_800, currency: 'EUR' }, since: '2026-04' },
];

export const DEMO_BUDGET_LINES: readonly BudgetLine[] = [
  {
    id: 'bl-01', phase_key: 'budget.phase.interior', lot_id: 'LOT-01',
    estimated: { minor: 18_420_000, currency: 'EUR' },
    quoted: { minor: 19_140_000, currency: 'EUR' },
    actual: { minor: 18_806_000, currency: 'EUR' },
  },
  {
    id: 'bl-02', phase_key: 'budget.phase.parking', lot_id: 'LOT-02',
    estimated: { minor: 6_280_000, currency: 'EUR' },
    quoted: { minor: 5_990_000, currency: 'EUR' },
    actual: { minor: 5_990_000, currency: 'EUR' },
  },
  {
    id: 'bl-03', phase_key: 'budget.phase.wall_plans', lot_id: 'LOT-03',
    estimated: null,
    quoted: { minor: 3_450_000, currency: 'EUR' },
    actual: null,
  },
  {
    id: 'bl-04', phase_key: 'budget.phase.cell_turnover', lot_id: null,
    estimated: { minor: 740_000, currency: 'EUR' },
    quoted: null,
    actual: null,
  },
];

/** Typologies citées par le carnet estimé — entrée de `auditCostReferences`. */
export const DEMO_REFERENCED_TYPOLOGIES: readonly string[] = [
  'totem_directionnel',
  'drapeau_suspendu',
  'plan_mural',
  'bandeau_porte',
  'caisson_mural',
];
