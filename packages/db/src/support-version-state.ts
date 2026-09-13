import type { Finding, Outcome, SupportVersionState } from '@azimut/core-model';

/**
 * T-2.14a §5 — Support-version state machine. Unlisted transitions are
 * forbidden and raise a blocking finding with a stable code. Pure: it decides
 * the target state and the effect; the effect (recompute the empreinte, freeze
 * it, write an approval row, supersede) is carried out by the caller. The
 * approval table's insert-only guarantee lives in the database (migration
 * 0009), not here.
 */

export type SupportVersionEvent =
  | 'modify'       // draft → draft, recompute the content hash
  | 'emit_proof'   // draft → in_review, freeze the content and its hash
  | 'reject'       // in_review → draft, a reason is required
  | 'approve'      // in_review → approved, write an approval row
  | 'supersede';   // approved → superseded, automatic on a new approved version

export type SupportVersionEffect =
  | 'recompute_hash' | 'freeze' | 'none' | 'write_approval' | 'automatic';

export type SupportVersionTransition = {
  readonly to: SupportVersionState;
  readonly effect: SupportVersionEffect;
};

const TABLE: ReadonlyMap<string, SupportVersionTransition> = new Map([
  ['draft|modify', { to: 'draft', effect: 'recompute_hash' }],
  ['draft|emit_proof', { to: 'in_review', effect: 'freeze' }],
  ['in_review|reject', { to: 'draft', effect: 'none' }],
  ['in_review|approve', { to: 'approved', effect: 'write_approval' }],
  ['approved|supersede', { to: 'superseded', effect: 'automatic' }],
]);

function blocking(code: string, params: Record<string, string | number>): Finding {
  return { code, severity: 'blocking', entity: null, params, ruleRef: null };
}

/**
 * Resolve a transition. Returns the target state and effect, or a blocking
 * finding: DATA.SUPPORT_VERSION_TRANSITION_FORBIDDEN for any (state, event) not
 * in §5, and DATA.SUPPORT_VERSION_REJECT_MOTIF_REQUIRED when a rejection carries
 * no reason.
 */
export function transitionSupportVersion(
  from: SupportVersionState,
  event: SupportVersionEvent,
  options?: { readonly motif?: string },
): Outcome<SupportVersionTransition> {
  const next = TABLE.get(`${from}|${event}`);
  if (next === undefined) {
    return {
      ok: false,
      findings: [blocking('DATA.SUPPORT_VERSION_TRANSITION_FORBIDDEN', { from, event })],
    };
  }
  if (event === 'reject' && (options?.motif === undefined || options.motif.trim() === '')) {
    return {
      ok: false,
      findings: [blocking('DATA.SUPPORT_VERSION_REJECT_MOTIF_REQUIRED', { from })],
    };
  }
  return { ok: true, value: next, warnings: [] };
}
