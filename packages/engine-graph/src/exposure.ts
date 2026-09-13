import type { Finding, Outcome } from '@azimut/core-model';

/**
 * I5.3 — Exposure hypotheses.
 *
 * The exposure of a cell is derived from computed routes weighted by three
 * DECLARED factors: entry weights (share of footfall per access), attraction
 * weights (per motive destination), and a visibility cone (angle and distance
 * per circulation typology). A cell's exposure is a relative index within one
 * site, never a visitor count.
 *
 * Blocking rule (I5.3): a flow report cannot be produced without its
 * hypotheses. This guard enforces exactly that — the three declarations must be
 * present before any exposure is computed or exported. The exposure computation
 * itself (route enumeration and visibility, still provisional in I5.3) is not
 * implemented here.
 */
export type EntryWeight = {
  readonly access_id: string;
  readonly weight: number;
};

export type AttractionWeight = {
  readonly destination_id: string;
  readonly weight: number;
};

export type VisibilityCone = {
  readonly typology: string;
  readonly angle_deg: number;
  readonly distance_m: number;
};

export type ExposureHypotheses = {
  readonly entry_weights: readonly EntryWeight[];
  readonly attraction_weights: readonly AttractionWeight[];
  readonly visibility_cones: readonly VisibilityCone[];
};

function undeclared(factor: string): Finding {
  return {
    code: 'FLOW.WEIGHTS_UNDECLARED',
    severity: 'blocking',
    entity: null,
    params: { factor },
    ruleRef: 'I5.3',
  };
}

/**
 * Guard that the three exposure weightings are declared. Returns one blocking
 * finding per missing factor (empty declaration), in a stable order; ok when
 * all three are present.
 */
export function guardExposureHypotheses(
  hypotheses: ExposureHypotheses,
): Outcome<null> {
  const findings: Finding[] = [];
  if (hypotheses.entry_weights.length === 0) findings.push(undeclared('entry_weights'));
  if (hypotheses.attraction_weights.length === 0) findings.push(undeclared('attraction_weights'));
  if (hypotheses.visibility_cones.length === 0) findings.push(undeclared('visibility_cones'));

  if (findings.length > 0) {
    return { ok: false, findings };
  }
  return { ok: true, value: null, warnings: [] };
}

/**
 * H12 / I5.3 — a flow result can never be exported without its hypotheses. This
 * export guard raises a blocking FLOW.HYPOTHESIS_MISSING when the export bundle
 * carries no hypotheses at all, and otherwise defers to guardExposureHypotheses
 * so an attached-but-incomplete set of hypotheses still blocks the export.
 */
export function guardFlowResultExport(
  hypotheses: ExposureHypotheses | null,
): Outcome<null> {
  if (hypotheses === null) {
    return {
      ok: false,
      findings: [
        {
          code: 'FLOW.HYPOTHESIS_MISSING',
          severity: 'blocking',
          entity: null,
          params: {},
          ruleRef: 'H12',
        },
      ],
    };
  }
  return guardExposureHypotheses(hypotheses);
}
