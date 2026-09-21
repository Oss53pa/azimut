import { describe, it, expect } from 'vitest';
import {
  assessCorrelation,
  guardMonetaryEstimate,
  isDeclaredThreshold,
  isSourcedObservation,
  MIN_CORRELATION_PAIRS,
} from '../correlation.js';
import type { ExposureIndex, PerformanceObservation } from '../correlation.js';

function index(id: string, value: number): ExposureIndex {
  return { destination_id: id, index: value };
}

function observation(
  id: string,
  performance: number,
  overrides: Partial<PerformanceObservation> = {},
): PerformanceObservation {
  return {
    destination_id: id,
    performance,
    source_kind: 'footfall_count',
    source_label: 'Comptage porte — prestataire A',
    observed_at: '2026-03-01',
    ...overrides,
  };
}

/** Cinq cellules dont l'exposition et la performance vont dans le même sens. */
const AGREEING = {
  indices: [
    index('d1', 10), index('d2', 20), index('d3', 30),
    index('d4', 40), index('d5', 50),
  ],
  observations: [
    observation('d1', 100), observation('d2', 220), observation('d3', 280),
    observation('d4', 410), observation('d5', 590),
  ],
};

/** Les mêmes cellules, performance strictement inverse de l'exposition. */
const OPPOSED = {
  indices: AGREEING.indices,
  observations: [
    observation('d1', 590), observation('d2', 410), observation('d3', 280),
    observation('d4', 220), observation('d5', 100),
  ],
};

describe('assessCorrelation — mesure', () => {
  it('rend +1 sur un accord de rangs parfait', () => {
    const result = assessCorrelation(AGREEING.indices, AGREEING.observations);
    expect(result.status).toBe('established');
    expect(result.coefficient).toBe(1);
    expect(result.pairs).toBe(5);
    expect(result.method).toBe('spearman');
  });

  it('rend −1 sur un désaccord de rangs parfait', () => {
    const result = assessCorrelation(OPPOSED.indices, OPPOSED.observations);
    expect(result.coefficient).toBe(-1);
  });

  it('corrèle les rangs et non les valeurs (P3)', () => {
    // Même ordre que AGREEING, mais une performance très étirée sur d5. Une
    // corrélation linéaire changerait ; une corrélation de rangs non.
    const stretched = [
      observation('d1', 100), observation('d2', 220), observation('d3', 280),
      observation('d4', 410), observation('d5', 99_000),
    ];
    const result = assessCorrelation(AGREEING.indices, stretched);
    expect(result.coefficient).toBe(1);
  });

  it('traite les ex æquo par le rang moyen', () => {
    const result = assessCorrelation(
      [index('d1', 10), index('d2', 10), index('d3', 30)],
      [observation('d1', 100), observation('d2', 100), observation('d3', 300)],
    );
    expect(result.status).toBe('established');
    expect(result.coefficient).toBe(1);
  });

  it('n’établit rien sous le nombre minimal de paires', () => {
    const result = assessCorrelation(
      [index('d1', 10), index('d2', 20)],
      [observation('d1', 100), observation('d2', 200)],
    );
    expect(result.status).toBe('too_few_pairs');
    expect(result.coefficient).toBeNull();
    expect(result.pairs).toBe(2);
    expect(MIN_CORRELATION_PAIRS).toBe(3);
  });

  it('n’établit rien quand une série est entièrement ex æquo', () => {
    const result = assessCorrelation(
      [index('d1', 10), index('d2', 10), index('d3', 10)],
      [observation('d1', 100), observation('d2', 200), observation('d3', 300)],
    );
    expect(result.status).toBe('no_variance');
    expect(result.coefficient).toBeNull();
  });

  it('n’apparie pas une destination présente d’un seul côté', () => {
    const result = assessCorrelation(
      AGREEING.indices,
      [...AGREEING.observations, observation('d-inconnue', 700)],
    );
    expect(result.pairs).toBe(5);
    expect(result.coefficient).toBe(1);
  });

  it('écarte et compte une observation sans origine ni date (P6)', () => {
    const result = assessCorrelation(AGREEING.indices, [
      ...AGREEING.observations,
      observation('d1', 100, { source_label: '  ' }),
      observation('d2', 200, { observed_at: '' }),
    ]);
    expect(result.dropped_unsourced).toBe(2);
    expect(result.pairs).toBe(5);
  });

  it('rend deux fois le même coefficient quel que soit l’ordre d’entrée (invariant 4)', () => {
    const reversed = [...AGREEING.observations].reverse();
    const a = assessCorrelation(AGREEING.indices, AGREEING.observations);
    const b = assessCorrelation([...AGREEING.indices].reverse(), reversed);
    expect(b).toEqual(a);
  });
});

describe('P5 — un montant est refusé tant que la corrélation est sous le seuil', () => {
  it('laisse passer une corrélation qui atteint le seuil', () => {
    const result = guardMonetaryEstimate(
      { min_correlation: 0.8 },
      AGREEING.indices,
      AGREEING.observations,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.coefficient).toBe(1);
  });

  it('accepte l’égalité stricte au seuil : P5 dit « atteint »', () => {
    const result = guardMonetaryEstimate(
      { min_correlation: 1 },
      AGREEING.indices,
      AGREEING.observations,
    );
    expect(result.ok).toBe(true);
  });

  it('refuse une corrélation sous le seuil', () => {
    const result = guardMonetaryEstimate(
      { min_correlation: 0.8 },
      OPPOSED.indices,
      OPPOSED.observations,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const finding = result.findings[0];
    expect(result.findings).toHaveLength(1);
    expect(finding?.code).toBe('FLOW.CORRELATION_TOO_LOW');
    expect(finding?.severity).toBe('blocking');
    expect(finding?.ruleRef).toBe('N3.3');
    expect(finding?.params['correlation']).toBe(-1);
    expect(finding?.params['threshold']).toBe(0.8);
    expect(finding?.params['status']).toBe('established');
    expect(finding?.params['pairs']).toBe(5);
  });

  it('refuse un échantillon trop petit, et le dit par status', () => {
    const result = guardMonetaryEstimate(
      { min_correlation: 0 },
      [index('d1', 10), index('d2', 20)],
      [observation('d1', 100), observation('d2', 200)],
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('FLOW.CORRELATION_TOO_LOW');
    expect(result.findings[0]?.params['status']).toBe('too_few_pairs');
    // Aucun coefficient n'est annoncé quand aucun n'est établi.
    expect(result.findings[0]?.params['correlation']).toBeUndefined();
  });

  it('refuse un coefficient non défini même avec un seuil de zéro', () => {
    const result = guardMonetaryEstimate(
      { min_correlation: 0 },
      [index('d1', 10), index('d2', 10), index('d3', 10)],
      [observation('d1', 100), observation('d2', 200), observation('d3', 300)],
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.params['status']).toBe('no_variance');
  });

  it('refuse avant tout calcul quand le seuil n’est pas déclaré', () => {
    for (const threshold of [Number.NaN, -0.1, 1.1, Number.POSITIVE_INFINITY]) {
      const result = guardMonetaryEstimate(
        { min_correlation: threshold },
        AGREEING.indices,
        AGREEING.observations,
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.findings[0]?.code).toBe('FLOW.WEIGHTS_UNDECLARED');
      expect(result.findings[0]?.params['factor']).toBe('min_correlation');
    }
  });
});

describe('isDeclaredThreshold et isSourcedObservation', () => {
  it('n’admet comme seuil qu’un nombre fini de [0, 1]', () => {
    expect(isDeclaredThreshold(0)).toBe(true);
    expect(isDeclaredThreshold(0.65)).toBe(true);
    expect(isDeclaredThreshold(1)).toBe(true);
    expect(isDeclaredThreshold(-0.01)).toBe(false);
    expect(isDeclaredThreshold(1.01)).toBe(false);
    expect(isDeclaredThreshold(Number.NaN)).toBe(false);
  });

  it('exige une origine et une date sur une observation', () => {
    expect(isSourcedObservation(observation('d1', 10))).toBe(true);
    expect(isSourcedObservation(observation('d1', 10, { source_label: '' }))).toBe(false);
    expect(isSourcedObservation(observation('d1', 10, { observed_at: ' ' }))).toBe(false);
  });
});
