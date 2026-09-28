/**
 * I5.6 — les tournées d'inspection telles que la base les porte (migration
 * 0044) : tournées de relevé et constats faits sur les supports.
 *
 * Le nombre de constats d'une tournée se compte ; il ne se stocke pas. Comme
 * le vocabulaire, ce registre ne rejoint pas `SiteData` : il se lit à part,
 * par les écrans du module 08. Les énumérés recopient les CHECK de 0044 ; un
 * test structurel vérifie que les listes coïncident.
 */

export const INSPECTION_SYNC_STATES = ['pending', 'synced'] as const;
export type InspectionSyncState = (typeof INSPECTION_SYNC_STATES)[number];

export const INSPECTION_SEVERITIES = ['blocking', 'warning'] as const;
export type InspectionSeverity = (typeof INSPECTION_SEVERITIES)[number];

export type InspectionRound = {
  readonly id: string;
  readonly zone_label: string;
  /** Identifiant de l'agent de relevé, ou `null`. */
  readonly surveyor_id: string | null;
  /** `AAAA-MM-JJ`, ou `null` pour une tournée pas encore faite. */
  readonly surveyed_on: string | null;
  readonly sync_state: InspectionSyncState;
};

export type InspectionFinding = {
  readonly id: string;
  readonly round_id: string;
  readonly support_id: string;
  /** Clé de nature, traduite par l'écran quand il la connaît. */
  readonly nature_key: string;
  readonly severity: InspectionSeverity;
  readonly photo_path: string | null;
};

export type InspectionRegistry = {
  readonly rounds: readonly InspectionRound[];
  readonly findings: readonly InspectionFinding[];
};

export const EMPTY_INSPECTION_REGISTRY: InspectionRegistry = { rounds: [], findings: [] };

export function isInspectionSyncState(value: string): value is InspectionSyncState {
  return (INSPECTION_SYNC_STATES as readonly string[]).includes(value);
}

export function isInspectionSeverity(value: string): value is InspectionSeverity {
  return (INSPECTION_SEVERITIES as readonly string[]).includes(value);
}
