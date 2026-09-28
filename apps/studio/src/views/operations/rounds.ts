/**
 * I5.6 — ce que les écrans des tournées calculent : le garde de
 * synchronisation, et le nombre de constats d'une tournée, qui se compte au
 * lieu de se stocker.
 */
import type { Finding, InspectionFinding, InspectionRound } from '@azimut/core-model';
import { auditSurveySync } from '../../domain/survey-sync.js';

/** Une anomalie d'information par tournée pas encore synchronisée. */
export function syncFindings(rounds: readonly InspectionRound[]): readonly Finding[] {
  const result = auditSurveySync(rounds.map(r => ({ id: r.id, sync_state: r.sync_state })));
  return result.ok ? result.warnings : result.findings;
}

/** Le nombre de constats par tournée ; une tournée sans constat vaut zéro. */
export function findingCounts(findings: readonly InspectionFinding[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const f of findings) counts.set(f.round_id, (counts.get(f.round_id) ?? 0) + 1);
  return counts;
}
