/**
 * Jeu de démonstration — module 08 (exploitation). Ceux des modules 07 et 09
 * sont servis par le dépôt de référence (`data/reference-*.ts`).
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
