import type { Finding, Outcome } from './outcome.js';
import type { FontAsset } from './font-embedding.js';

/**
 * G5.1 / G5.2 — Font registry checks beyond embedding.
 *
 * G5.1: text is measured exclusively from a versioned metrics table carrying a
 * hash, never from the browser's measurement functions (which would break
 * invariant 4). Before composition, each font's metrics table must be present
 * and its stored hash must match the table actually on hand; an absent or
 * altered table raises a blocking FONT.METRICS_MISSING.
 *
 * G5.2: a font whose licence is undeclared (licence_kind = 'unknown') is
 * flagged at the registry level with a warning FONT.LICENCE_UNKNOWN, so the
 * undeclared licence is visible and opposable — distinct from the blocking gate
 * that stops such a font being embedded in a distributed deliverable.
 */
export type FontMetricsRecord = {
  readonly font_id: string;
  /** Whether a metrics table is stored for the font. */
  readonly present: boolean;
  /** Hash recorded alongside the font asset (G5.2 metrics_hash). */
  readonly declared_hash: string | null;
  /** Hash of the metrics table actually available now. */
  readonly actual_hash: string | null;
};

function metricsReason(record: FontMetricsRecord): string | null {
  if (!record.present) return 'absent';
  if (record.declared_hash === null || record.actual_hash === null) return 'absent';
  if (record.declared_hash !== record.actual_hash) return 'altered';
  return null;
}

/**
 * Guard font metrics integrity. Returns one blocking FONT.METRICS_MISSING per
 * font whose metrics table is absent or altered (hash mismatch), sorted by
 * font id; ok when every table is present and matches its declared hash.
 */
export function guardFontMetrics(
  records: readonly FontMetricsRecord[],
): Outcome<null> {
  const findings: Finding[] = [];
  const sorted = [...records].sort((a, b) => a.font_id.localeCompare(b.font_id));

  for (const record of sorted) {
    const reason = metricsReason(record);
    if (reason !== null) {
      findings.push({
        code: 'FONT.METRICS_MISSING',
        severity: 'blocking',
        entity: { kind: 'font', id: record.font_id },
        params: { reason },
        ruleRef: 'G5.1',
      });
    }
  }

  if (findings.length > 0) {
    return { ok: false, findings };
  }
  return { ok: true, value: null, warnings: [] };
}

/**
 * Audit font licences. Returns one warning FONT.LICENCE_UNKNOWN per font whose
 * licence is undeclared, sorted by font id. Always ok — an undeclared licence
 * is a registry warning, while the embedding gate (FONT.NOT_EMBEDDABLE) is what
 * actually blocks distribution.
 */
export function auditFontLicences(
  fonts: readonly FontAsset[],
): Outcome<null> {
  const warnings: Finding[] = [];
  const sorted = [...fonts].sort((a, b) => a.id.localeCompare(b.id));

  for (const font of sorted) {
    if (font.licence_kind === 'unknown') {
      warnings.push({
        code: 'FONT.LICENCE_UNKNOWN',
        severity: 'warning',
        entity: { kind: 'font', id: font.id },
        params: { family: font.family },
        ruleRef: 'G5.2',
      });
    }
  }

  return { ok: true, value: null, warnings };
}
