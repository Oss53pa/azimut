import { describe, it, expect } from 'vitest';
import { DEMO_LOTS, DEMO_RESERVES } from '../../../domain/demo/production.js';
import { lotRows, reserveRows } from '../rows.js';

describe('H6.2 — lots et réserves de pose', () => {
  it('rattache à chaque réserve ouverte l’anomalie du garde, et aucune à une réserve levée', () => {
    const rows = reserveRows(DEMO_RESERVES);
    for (const row of rows) {
      if (row.record.reserve.lifted) expect(row.finding).toBeNull();
      else expect(row.finding?.code).toBe('INSTALL.RESERVATION_OPEN');
    }
  });

  it('compte les réserves ouvertes par lot', () => {
    const rows = lotRows(DEMO_LOTS, DEMO_RESERVES);
    expect(rows.map(r => [r.lot.id, r.open, r.reserves.length])).toEqual([
      ['LOT-01', 2, 2],
      ['LOT-02', 1, 2],
      ['LOT-03', 0, 0],
    ]);
  });

  it('rend deux fois la même chose (INV-4)', () => {
    expect(lotRows(DEMO_LOTS, DEMO_RESERVES)).toEqual(lotRows(DEMO_LOTS, DEMO_RESERVES));
  });
});
