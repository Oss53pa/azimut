import type { Finding, Outcome } from './outcome.js';
import { roundHalfAwayFromZero } from './round.js';

/**
 * G6 — Colour chain. A charter colour is not a value but a bundle of
 * representations (G6.1): a reference (which is authoritative and goes to the
 * manufacturer), optional measured CIELAB values, and a display approximation.
 *
 * Two rules surface here:
 *  - G6.2: a colorimetric delta between two colours is computed only when both
 *    carry measured values; otherwise the delta is not computable and no false
 *    number is shown (COLOR.DELTA_NOT_COMPUTABLE, info).
 *  - G6.3: swatch references (pantone/ral/ncs) are proprietary and carry no
 *    bundled conversion table, so a reference held without client-provided
 *    measured values cannot be verified (COLOR.REFERENCE_UNVERIFIABLE, info).
 */
export type LabValue = {
  readonly l: number;
  readonly a: number;
  readonly b: number;
};

export type ReferenceSystem =
  | 'pantone'
  | 'ral'
  | 'ncs'
  | 'cmyk'
  | 'rgb'
  | 'none';

export type CharterColor = {
  readonly id: string;
  readonly reference_system: ReferenceSystem;
  readonly reference_code: string | null;
  /** Measured CIELAB values, null when the client provided none. */
  readonly lab: LabValue | null;
};

/**
 * Colorimetric delta between two charter colours. Uses CIE76 (Euclidean
 * distance in CIELAB) as the first-version baseline, rounded deterministically
 * to two decimals. Returns the delta as the value when both colours carry
 * measured values; otherwise the value is null and one info
 * COLOR.DELTA_NOT_COMPUTABLE is returned (never a false number).
 */
export function colorDelta(
  a: CharterColor,
  b: CharterColor,
): Outcome<number | null> {
  if (a.lab === null || b.lab === null) {
    return {
      ok: true,
      value: null,
      warnings: [
        {
          code: 'COLOR.DELTA_NOT_COMPUTABLE',
          severity: 'info',
          entity: null,
          params: { left: a.id, right: b.id },
          ruleRef: 'G6.2',
        },
      ],
    };
  }

  const dl = a.lab.l - b.lab.l;
  const da = a.lab.a - b.lab.a;
  const db = a.lab.b - b.lab.b;
  const raw = Math.sqrt(dl * dl + da * da + db * db);
  const delta = roundHalfAwayFromZero(raw * 100) / 100;

  return { ok: true, value: delta, warnings: [] };
}

/**
 * Audit charter colours for unverifiable references. Returns one info
 * COLOR.REFERENCE_UNVERIFIABLE per colour that names a swatch reference
 * (reference_system other than 'none' with a code) but carries no measured
 * values, sorted by colour id. Always ok — the reference still travels to the
 * manufacturer as text, it simply cannot be verified in-product.
 */
export function auditColorReferences(
  colors: readonly CharterColor[],
): Outcome<null> {
  const warnings: Finding[] = [];
  const sorted = [...colors].sort((x, y) => x.id.localeCompare(y.id));

  for (const color of sorted) {
    const hasReference =
      color.reference_system !== 'none' &&
      (color.reference_code ?? '').trim() !== '';
    if (hasReference && color.lab === null) {
      warnings.push({
        code: 'COLOR.REFERENCE_UNVERIFIABLE',
        severity: 'info',
        entity: { kind: 'charter_color', id: color.id },
        params: {
          reference_system: color.reference_system,
          reference_code: color.reference_code ?? '',
        },
        ruleRef: 'G6.3',
      });
    }
  }

  return { ok: true, value: null, warnings };
}
