import type { Discrepancy, DiscrepancyDecision, Finding, SourceClaim } from '@azimut/core-model';
import { detectDiscrepancies } from '@azimut/core-model';

/**
 * Audit des écarts entre sources — complément atelier, M16.
 *
 * Un écart ouvert est signalant, pas bloquant, et c'est délibéré : bloquer
 * arrêterait la production sur une question qui n'a pas de réponse technique.
 * Ce qui est interdit, c'est le silence. La valeur retenue part en production
 * marquée « à confirmer », et l'anomalie dit laquelle et pourquoi, pour que la
 * rubrique « Écarts à arbitrer » d'un livrable se génère depuis ce registre et
 * jamais à la main.
 */
export type SourceDiscrepancyReport = {
  readonly total: number;
  readonly open_count: number;
  readonly discrepancies: readonly Discrepancy[];
  readonly findings: readonly Finding[];
};

export function auditSourceClaims(
  claims: readonly SourceClaim[],
  decisions: Readonly<Record<string, DiscrepancyDecision>> = {},
): SourceDiscrepancyReport {
  const discrepancies = detectDiscrepancies(claims, decisions);
  const findings: Finding[] = [];

  for (const discrepancy of discrepancies) {
    if (!discrepancy.open) continue;
    findings.push({
      code: 'LAYOUT.SOURCE_DISCREPANCY_OPEN',
      severity: 'warning',
      entity: { kind: 'site_fact', id: discrepancy.key },
      params: {
        retained_value: discrepancy.retained_value,
        retained_source: discrepancy.retained_source,
        // Les sources en présence, pour que la fiche d'écart se lise sans
        // ressortir chercher les affirmations une à une.
        sources: discrepancy.claims.map((claim) => claim.source).join(', '),
        claim_count: discrepancy.claims.length,
      },
      ruleRef: 'atelier-M16',
    });
  }

  return {
    total: discrepancies.length,
    open_count: findings.length,
    discrepancies,
    findings,
  };
}
