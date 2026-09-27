import { describe, it, expect } from 'vitest';
import { monthsFrom, stateAt, occupancyRate } from '../occupancy.js';
import { REFERENCE_ADVERTISING } from '../../../data/reference-advertising.js';

const { bookings: DEMO_BOOKINGS, placements: DEMO_PLACEMENTS } = REFERENCE_ADVERTISING.registry;

describe('H4.3 — planning d’occupation', () => {
  it('énumère les mois consécutifs en franchissant l’année', () => {
    expect(monthsFrom('2026-11-01', 4)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
  });

  it('rend l’état le plus engageant quand plusieurs contrats se recouvrent', () => {
    expect(stateAt(DEMO_BOOKINGS, 'AP-N0-04', '2026-11')).toBe('reserved');
  });

  it('rend « libre » pour un mois sans contrat, jamais « inconnu »', () => {
    expect(stateAt(DEMO_BOOKINGS, 'AP-N-1-03', '2027-06')).toBe('free');
  });

  it('calcule un taux d’occupation sur les seuls états fermes', () => {
    const ids = DEMO_PLACEMENTS.map(p => p.id);
    expect(occupancyRate(DEMO_BOOKINGS, ids, '2026-09')).toBe(40);
  });
});
