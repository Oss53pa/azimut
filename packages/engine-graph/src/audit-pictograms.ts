import type { Finding, Outcome } from '@azimut/core-model';

/**
 * J5.3 — Each orientation-registry pictogram carries a comprehension-test
 * state: untested, tested, or failed. An untested pictogram may still be used,
 * but the state is visible and must appear in the audit report. This audit
 * emits an informational PICTO.UNTESTED for every orientation pictogram left
 * untested. Safety-registry pictograms come from the rules pack and are not
 * subject to this test, so they are never reported here (J5.4).
 */
export const COMPREHENSION_STATES = ['untested', 'tested', 'failed'] as const;
export type ComprehensionState = (typeof COMPREHENSION_STATES)[number];

/** Minimal pictogram shape needed for the comprehension audit (J5.4). */
export type PictogramComprehension = {
  readonly id: string;
  readonly registry: 'safety' | 'wayfinding';
  readonly comprehension_state: ComprehensionState;
};

/**
 * Audit orientation pictograms for comprehension testing. Returns one info
 * PICTO.UNTESTED finding per untested orientation pictogram, sorted by id.
 * Always ok — an untested pictogram is opposable, not blocking (J5.3).
 */
export function auditPictogramComprehension(
  pictograms: readonly PictogramComprehension[],
): Outcome<null> {
  const warnings: Finding[] = [];
  const sorted = [...pictograms].sort((a, b) => a.id.localeCompare(b.id));

  for (const picto of sorted) {
    if (picto.registry === 'wayfinding' && picto.comprehension_state === 'untested') {
      warnings.push({
        code: 'PICTO.UNTESTED',
        severity: 'info',
        entity: { kind: 'pictogram', id: picto.id },
        params: {},
        ruleRef: 'J5.3',
      });
    }
  }

  return { ok: true, value: null, warnings };
}
