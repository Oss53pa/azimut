import type { Finding, Outcome } from './outcome.js';

/**
 * J3.3 — The sketch layer is the one place where a stroke is kept as-is: it is
 * never quantified, never part of any computation, and never appears in a
 * manufacturing deliverable, a kiosk package, or any export destined for a
 * third party. This guard is the automated control on exports required there:
 * the sketch collections (J3.4) must not be among an export's included data.
 */
export const SKETCH_COLLECTIONS = ['sketch_layer', 'sketch_stroke'] as const;

const SKETCH_SET = new Set<string>(SKETCH_COLLECTIONS);

/**
 * Guard that an export's included data collections contain no sketch data.
 * Returns one blocking finding per sketch collection present, in the fixed
 * SKETCH_COLLECTIONS order; ok when none is included.
 */
export function guardExportExcludesSketch(
  includedCollections: readonly string[],
): Outcome<null> {
  const included = new Set(includedCollections);
  const findings: Finding[] = [];

  for (const collection of SKETCH_COLLECTIONS) {
    if (included.has(collection)) {
      findings.push({
        code: 'SKETCH.IN_DELIVERABLE',
        severity: 'blocking',
        entity: null,
        params: { collection },
        ruleRef: 'J3.3',
      });
    }
  }

  if (findings.length > 0) {
    return { ok: false, findings };
  }
  return { ok: true, value: null, warnings: [] };
}

/** True when a data collection name is a sketch collection (J3.4). */
export function isSketchCollection(name: string): boolean {
  return SKETCH_SET.has(name);
}
