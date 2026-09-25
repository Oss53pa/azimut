import { describe, it, expect } from 'vitest';
import type { BudgetLine } from '../../../domain/demo/production.js';
import { formatMoney, share, variance } from '../money.js';

function line(estimated: number | null, actual: number | null, currency = 'EUR'): BudgetLine {
  return {
    id: 'bl', phase_key: 'budget.phase.interior', lot_id: null,
    estimated: estimated === null ? null : { minor: estimated, currency },
    quoted: null,
    actual: actual === null ? null : { minor: actual, currency },
  };
}

describe('H8 — montants en unité mineure', () => {
  it('affiche l’unité majeure et la devise, sans conversion', () => {
    expect(formatMoney({ minor: 124_000, currency: 'EUR' }, 'en', '—')).toBe('1,240 EUR');
    expect(formatMoney(null, 'fr', 'non chiffré')).toBe('non chiffré');
  });

  it('calcule l’écart réalisé / estimation', () => {
    expect(variance(line(10_000, 11_000))).toBeCloseTo(10, 10);
    expect(variance(line(null, 11_000))).toBeNull();
  });

  it('refuse de comparer deux devises ou de diviser par zéro', () => {
    expect(share({ minor: 5, currency: 'EUR' }, { minor: 10, currency: 'XOF' })).toBeNull();
    expect(share({ minor: 5, currency: 'EUR' }, { minor: 0, currency: 'EUR' })).toBeNull();
  });
});
