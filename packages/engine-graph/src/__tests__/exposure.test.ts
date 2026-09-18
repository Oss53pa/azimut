import { describe, it, expect } from 'vitest';
import { guardExposureHypotheses, guardFlowResultExport } from '../exposure.js';
import type { ExposureHypotheses } from '../exposure.js';

// Des parts, donc une décomposition du tout. Le jeu d'essai portait jusqu'ici
// un unique poids d'entrée de 0,7 et un unique poids d'attraction de 0,5 :
// deux jeux qui ne décomposaient rien, et que rien ne refusait.
const complete: ExposureHypotheses = {
  entry_weights: [
    { access_id: 'a-main', weight: 0.7 },
    { access_id: 'a-parking', weight: 0.3 },
  ],
  attraction_weights: [
    { destination_id: 'd-anchor', weight: 0.5 },
    { destination_id: 'd-food', weight: 0.5 },
  ],
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

describe('I5.3 — les parts décomposent le tout', () => {
  it('refuse un jeu de parts d’entrée qui ne somme pas à un', () => {
    // Déclaré n'est pas juste. Le contrôle d'existence passait déjà, et
    // laissait entrer une hypothèse fausse : FLOW.WEIGHTS_NOT_NORMALIZED
    // figurait au catalogue D2 sans qu'aucun moteur ne le lève.
    const r = guardExposureHypotheses({
      ...complete,
      entry_weights: [
        { access_id: 'a-main', weight: 0.7 },
        { access_id: 'a-parking', weight: 0.7 },
      ],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]?.code).toBe('FLOW.WEIGHTS_NOT_NORMALIZED');
    expect(r.findings[0]?.params['factor']).toBe('entry_weights');
    expect(r.findings[0]?.params['total']).toBeCloseTo(1.4, 10);
    expect(r.findings[0]?.ruleRef).toBe('I5.3');
  });

  it('refuse un jeu de parts d’attraction qui ne somme pas à un', () => {
    const r = guardExposureHypotheses({
      ...complete,
      attraction_weights: [
        { destination_id: 'd-anchor', weight: 1 },
        { destination_id: 'd-food', weight: 1 },
      ],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings.map(f => f.params['factor'])).toEqual(['attraction_weights']);
  });

  it('accepte des tiers, que la virgule flottante ne somme pas exactement à un', () => {
    // 1/3 + 1/3 + 1/3 vaut 0.9999999999999999. Refuser cette déclaration
    // serait refuser l'arithmétique de la machine, pas une erreur de saisie.
    const tiers = 1 / 3;
    const r = guardExposureHypotheses({
      ...complete,
      entry_weights: [
        { access_id: 'a-1', weight: tiers },
        { access_id: 'a-2', weight: tiers },
        { access_id: 'a-3', weight: tiers },
      ],
    });
    expect(r.ok).toBe(true);
  });

  it('ne redit pas d’un jeu vide qu’il n’est pas normalisé', () => {
    // Deux causes différentes ne partagent pas un code : un jeu vide est une
    // hypothèse qu'on n'a pas posée, un jeu qui somme à trois est une
    // hypothèse fausse. Le vide est déjà rapporté comme non déclaré.
    const r = guardExposureHypotheses({ ...complete, entry_weights: [] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings.map(f => f.code)).toEqual(['FLOW.WEIGHTS_UNDECLARED']);
  });

  it('refuse l’export d’un résultat dont les hypothèses ne décomposent rien', () => {
    const r = guardFlowResultExport({
      ...complete,
      entry_weights: [{ access_id: 'a-main', weight: 0.4 }],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings.map(f => f.code)).toEqual(['FLOW.WEIGHTS_NOT_NORMALIZED']);
  });
});
