import type { Outcome, Finding } from '@azimut/core-model';

/**
 * I5.4 — Advertising legal rules.
 *
 * The rules applicable to advertising (mandatory notices, price-display
 * constraints, forbidden product categories) are carried by an EXTENSION of the
 * rules pack, with the same properties: pluggable, versioned, dated, and
 * refused if the documentary reference is missing — with no fallback value.
 *
 * This guard enforces the attachment and the documentary reference: an
 * advertising deliverable cannot be produced without an ad rules pack whose
 * `source_ref` is present.
 */
export type AdRulesPack = {
  readonly key: string;
  readonly version: string;
  readonly effective_from: string;
  /** Documentary reference; a pack without it is refused (I5.4). */
  readonly source_ref: string;
};

function missing(reason: string): Finding {
  return {
    code: 'AD.RULES_PACK_MISSING',
    severity: 'blocking',
    entity: null,
    params: { reason },
    ruleRef: 'I5.4',
  };
}

/**
 * Guard that a usable advertising rules pack is attached. `null` means none is
 * attached; an attached pack with a blank `source_ref` is refused (no
 * fallback). Returns a blocking finding on failure, ok otherwise.
 */
export function guardAdRulesPack(pack: AdRulesPack | null): Outcome<null> {
  if (pack === null) {
    return { ok: false, findings: [missing('not_attached')] };
  }
  if (pack.source_ref.trim() === '') {
    return { ok: false, findings: [missing('source_ref_missing')] };
  }
  return { ok: true, value: null, warnings: [] };
}
