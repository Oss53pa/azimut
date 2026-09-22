import type { Finding, Outcome } from '@azimut/core-model';

/**
 * I3 — Five assistances, each proposes and the user decides; nothing is applied
 * silently, and a rejected proposal is not asked again. This is the application
 * layer, not an engine. Two anomaly codes surface from here:
 *  - ASSIST.PROPOSAL_REJECTED (info): a would-be proposal matches a prior
 *    rejection, so it is suppressed rather than re-presented.
 *  - ASSIST.EXTRACTION_BELOW_THRESHOLD (warning): a contour-detection (M12.AS1) run
 *    extracted too little, so manual calage is recommended.
 */
export type AssistProposal = {
  readonly id: string;
  /** Stable signature of the proposal's content; equal signatures are equal. */
  readonly signature: string;
};

/**
 * Keep only the proposals the user has not already rejected. Returns the
 * proposals to present as the value, and one info ASSIST.PROPOSAL_REJECTED per
 * suppressed proposal (so the suppression is opposable), sorted by proposal id.
 */
export function filterAssistProposals(
  proposals: readonly AssistProposal[],
  rejectedSignatures: ReadonlySet<string>,
): Outcome<readonly AssistProposal[]> {
  const sorted = [...proposals].sort((a, b) => a.id.localeCompare(b.id));
  const kept: AssistProposal[] = [];
  const warnings: Finding[] = [];

  for (const proposal of sorted) {
    if (rejectedSignatures.has(proposal.signature)) {
      warnings.push({
        code: 'ASSIST.PROPOSAL_REJECTED',
        severity: 'info',
        entity: { kind: 'assist_proposal', id: proposal.id },
        params: { signature: proposal.signature },
        ruleRef: 'I3',
      });
    } else {
      kept.push(proposal);
    }
  }

  return { ok: true, value: kept, warnings };
}

export type ExtractionRun = {
  readonly id: string;
  /** Share of the reference successfully extracted, in [0, 1]. */
  readonly extraction_rate: number;
};

/**
 * Flag contour-detection runs whose extraction rate falls below the supplied
 * threshold (never hardcoded here — it is a tuning value passed by the caller).
 * Returns one warning ASSIST.EXTRACTION_BELOW_THRESHOLD per low run, sorted by
 * id. Always ok: a low rate recommends manual calage, it does not block.
 */
export function auditExtractionRate(
  runs: readonly ExtractionRun[],
  threshold: number,
): Outcome<null> {
  const sorted = [...runs].sort((a, b) => a.id.localeCompare(b.id));
  const warnings: Finding[] = [];

  for (const run of sorted) {
    if (run.extraction_rate < threshold) {
      warnings.push({
        code: 'ASSIST.EXTRACTION_BELOW_THRESHOLD',
        severity: 'warning',
        entity: { kind: 'extraction_run', id: run.id },
        params: { extraction_rate: run.extraction_rate, threshold },
        ruleRef: 'I3',
      });
    }
  }

  return { ok: true, value: null, warnings };
}
