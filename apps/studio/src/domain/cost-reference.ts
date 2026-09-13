import type { Finding, Outcome } from '@azimut/core-model';

/**
 * H8 — Budget and estimation rest on a historised unit cost per typology (and
 * substrate and manufacturer). A carnet is estimated automatically from the
 * quantitatif, so a support typology used in the estimate with no reference
 * cost cannot be priced. This audit surfaces each such typology as a warning
 * COST.REFERENCE_MISSING. Application-layer guard for module 9.
 */

/**
 * Audit that every referenced typology has a reference cost. Returns one
 * warning COST.REFERENCE_MISSING per referenced typology absent from the
 * priced set, sorted and de-duplicated by typology id. Always ok — a missing
 * reference warns and leaves that line unpriced.
 */
export function auditCostReferences(
  referencedTypologies: readonly string[],
  pricedTypologies: ReadonlySet<string>,
): Outcome<null> {
  const warnings: Finding[] = [];
  const unique = [...new Set(referencedTypologies)].sort((a, b) => a.localeCompare(b));

  for (const typology of unique) {
    if (!pricedTypologies.has(typology)) {
      warnings.push({
        code: 'COST.REFERENCE_MISSING',
        severity: 'warning',
        entity: { kind: 'support_type', id: typology },
        params: {},
        ruleRef: 'H8',
      });
    }
  }

  return { ok: true, value: null, warnings };
}
