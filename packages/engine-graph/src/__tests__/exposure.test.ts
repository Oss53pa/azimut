import { describe, it, expect } from 'vitest';
import { guardExposureHypotheses, guardFlowResultExport } from '../exposure.js';
import type { ExposureHypotheses } from '../exposure.js';

const complete: ExposureHypotheses = {
  entry_weights: [{ access_id: 'a-main', weight: 0.7 }],
  attraction_weights: [{ destination_id: 'd-anchor', weight: 0.5 }],
  visibility_cones: [{ typology: 'mall', angle_deg: 60, distance_m: 15 }],
};

describe('I5.3 — guardExposureHypotheses', () => {
  it('passes when the three weightings are declared', () => {
    expect(guardExposureHypotheses(complete).ok).toBe(true);
  });

  it('blocks when entry weights are undeclared', () => {
    const r = guardExposureHypotheses({ ...complete, entry_weights: [] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings[0]?.code).toBe('FLOW.WEIGHTS_UNDECLARED');
    expect(r.findings[0]?.params['factor']).toBe('entry_weights');
    expect(r.findings[0]?.ruleRef).toBe('I5.3');
  });

  it('reports one finding per missing factor, in a stable order', () => {
    const r = guardExposureHypotheses({
      entry_weights: [],
      attraction_weights: [],
      visibility_cones: [],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings.map((f) => f.params['factor'])).toEqual([
      'entry_weights',
      'attraction_weights',
      'visibility_cones',
    ]);
  });

  it('blocks when only the visibility cone is missing', () => {
    const r = guardExposureHypotheses({ ...complete, visibility_cones: [] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]?.params['factor']).toBe('visibility_cones');
  });
});

describe('H12 — guardFlowResultExport', () => {
  it('exports a flow result carrying complete hypotheses', () => {
    expect(guardFlowResultExport(complete).ok).toBe(true);
  });

  it('blocks FLOW.HYPOTHESIS_MISSING when no hypotheses are attached', () => {
    const r = guardFlowResultExport(null);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]?.code).toBe('FLOW.HYPOTHESIS_MISSING');
    expect(r.findings[0]?.severity).toBe('blocking');
    expect(r.findings[0]?.ruleRef).toBe('H12');
  });

  it('blocks with FLOW.WEIGHTS_UNDECLARED when attached hypotheses are incomplete', () => {
    const r = guardFlowResultExport({ ...complete, attraction_weights: [] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings[0]?.code).toBe('FLOW.WEIGHTS_UNDECLARED');
    expect(r.findings[0]?.params['factor']).toBe('attraction_weights');
  });
});
