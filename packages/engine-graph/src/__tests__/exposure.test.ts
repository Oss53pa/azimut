import { describe, it, expect } from 'vitest';
import {
  guardExposureHypotheses, guardFlowResultExport,
  entryWeightSum, ENTRY_WEIGHT_TOTAL,
} from '../exposure.js';
import type { ExposureHypotheses } from '../exposure.js';

/**
 * Jeu complet : deux accès qui se partagent la fréquentation. La somme vaut
 * l'unité, comme N3.3 l'exige — un jeu qui ne la vaudrait pas ne serait pas
 * « complet », il serait refusé.
 */
const complete: ExposureHypotheses = {
  entry_weights: [
    { access_id: 'a-main', weight: 0.7 },
    { access_id: 'a-parking', weight: 0.3 },
  ],
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

describe('N3.3 — normalisation des parts de fréquentation', () => {
  it('accepte des parts qui somment à l\u2019unité', () => {
    expect(entryWeightSum(complete.entry_weights)).toBeCloseTo(ENTRY_WEIGHT_TOTAL, 12);
    expect(guardExposureHypotheses(complete).ok).toBe(true);
  });

  it('refuse une somme inférieure à l\u2019unité', () => {
    const result = guardExposureHypotheses({
      ...complete,
      entry_weights: [{ access_id: 'a-main', weight: 0.7 }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.code).toBe('FLOW.WEIGHTS_NOT_NORMALIZED');
    expect(result.findings[0]?.severity).toBe('blocking');
    expect(result.findings[0]?.ruleRef).toBe('N3.3');
    expect(result.findings[0]?.params['sum']).toBeCloseTo(0.7, 12);
    expect(result.findings[0]?.params['expected']).toBe(ENTRY_WEIGHT_TOTAL);
  });

  it('refuse une somme supérieure à l\u2019unité', () => {
    const result = guardExposureHypotheses({
      ...complete,
      entry_weights: [
        { access_id: 'a-main', weight: 0.7 },
        { access_id: 'a-parking', weight: 0.6 },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('FLOW.WEIGHTS_NOT_NORMALIZED');
  });

  it('refuse 33,3 trois fois : la tolérance est flottante, pas métier', () => {
    const result = guardExposureHypotheses({
      ...complete,
      entry_weights: [
        { access_id: 'a', weight: 0.333 },
        { access_id: 'b', weight: 0.333 },
        { access_id: 'c', weight: 0.333 },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('FLOW.WEIGHTS_NOT_NORMALIZED');
  });

  it('accepte dix parts de 10 %, que le flottant ne somme pas exactement à 1', () => {
    const tenths = Array.from({ length: 10 }, (_, i) => ({
      access_id: `a-${String(i)}`,
      weight: 0.1,
    }));

    // La somme dérive de 1,1e-16 : c'est cette dérive que la tolérance couvre,
    // et rien d'autre.
    const sum = entryWeightSum(tenths);
    expect(sum).not.toBe(ENTRY_WEIGHT_TOTAL);
    expect(Math.abs(sum - ENTRY_WEIGHT_TOTAL)).toBeLessThan(1e-12);

    expect(guardExposureHypotheses({ ...complete, entry_weights: tenths }).ok).toBe(true);
  });

  it('ne contrôle la normalisation que sur des parts déclarées', () => {
    // Un jeu vide somme à zéro. Le dire « non normalisé » ferait chercher une
    // erreur de saisie là où la déclaration manque.
    const result = guardExposureHypotheses({ ...complete, entry_weights: [] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const codes = result.findings.map(f => f.code);
    expect(codes).toContain('FLOW.WEIGHTS_UNDECLARED');
    expect(codes).not.toContain('FLOW.WEIGHTS_NOT_NORMALIZED');
  });

  it('n\u2019impose aucune somme à l\u2019attraction ni aux cônes', () => {
    // Ni l'un ni l'autre n'est une part d'un tout : N3.3 ne l'exige pas, et
    // l'inventer serait ajouter une règle que la fiche ne porte pas.
    const result = guardExposureHypotheses({
      ...complete,
      attraction_weights: [
        { destination_id: 'd-1', weight: 4 },
        { destination_id: 'd-2', weight: 9 },
      ],
      visibility_cones: [{ typology: 'mall', angle_deg: 120, distance_m: 40 }],
    });
    expect(result.ok).toBe(true);
  });

  it('bloque l\u2019export d\u2019un résultat aux parts non normalisées', () => {
    const result = guardFlowResultExport({
      ...complete,
      entry_weights: [{ access_id: 'a-main', weight: 0.5 }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('FLOW.WEIGHTS_NOT_NORMALIZED');
  });
});
