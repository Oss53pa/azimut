import type { Finding, Outcome } from './outcome.js';

/**
 * E12 — Text overflow is detected by calculation, never visually: text is
 * measured from the font metrics (not the browser), on the longest active
 * language variant (D12.2), with hyphenation off by default. When a computed
 * text box exceeds the space available to it, a blocking TYPO.TEXT_OVERFLOW is
 * raised. This guard is the pure comparison; the deterministic measurement that
 * feeds it lives with the metrics table (G5.1).
 *
 * Dimensions are in millimetres, already rounded deterministically by the
 * caller (D1.4), so the comparison is exact.
 */
export type TextFitBox = {
  readonly block_id: string;
  readonly measured_width_mm: number;
  readonly measured_height_mm: number;
  readonly available_width_mm: number;
  readonly available_height_mm: number;
};

/**
 * Guard that computed text fits its block. Returns one blocking
 * TYPO.TEXT_OVERFLOW per overflowing axis, in the fixed order width then
 * height; ok when the text fits on both axes.
 */
export function guardTextFit(box: TextFitBox): Outcome<null> {
  const findings: Finding[] = [];
  const overflow = (
    axis: string,
    measured: number,
    available: number,
  ): void => {
    findings.push({
      code: 'TYPO.TEXT_OVERFLOW',
      severity: 'blocking',
      entity: { kind: 'face_block', id: box.block_id },
      params: { axis, measured_mm: measured, available_mm: available },
      ruleRef: 'E12',
    });
  };

  if (box.measured_width_mm > box.available_width_mm) {
    overflow('width', box.measured_width_mm, box.available_width_mm);
  }
  if (box.measured_height_mm > box.available_height_mm) {
    overflow('height', box.measured_height_mm, box.available_height_mm);
  }

  if (findings.length > 0) {
    return { ok: false, findings };
  }
  return { ok: true, value: null, warnings: [] };
}
