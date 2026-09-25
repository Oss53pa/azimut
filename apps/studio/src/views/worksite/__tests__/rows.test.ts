import { describe, it, expect } from 'vitest';
import { REFERENCE_WORKSITE } from '../../../data/reference-worksite.js';
import { lotRows, reserveRows } from '../rows.js';

const { lots, reserves } = REFERENCE_WORKSITE;

describe('H6.2 — lots et réserves de pose', () => {
  it('rattache à chaque réserve ouverte l’anomalie du garde, et aucune à une réserve levée', () => {
    const rows = reserveRows(reserves);
    for (const row of rows) {
      if (row.reserve.lifted_at !== null) expect(row.finding).toBeNull();
      else expect(row.finding?.code).toBe('INSTALL.RESERVATION_OPEN');
    }
  });

  it('compte les réserves ouvertes par lot', () => {
    const rows = lotRows(lots, reserves);
    expect(rows.map(r => [r.lot.code, r.open, r.reserves.length])).toEqual([
      ['LOT-01', 2, 2],
      ['LOT-02', 1, 2],
      ['LOT-03', 0, 0],
    ]);
  });

  it('rend deux fois la même chose (INV-4)', () => {
    expect(lotRows(lots, reserves)).toEqual(lotRows(lots, reserves));
  });
});
