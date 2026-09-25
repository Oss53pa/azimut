import { describe, it, expect } from 'vitest';
import { REFERENCE_ADVERTISING } from '../../../data/reference-advertising.js';

const { bookings: DEMO_BOOKINGS, placements: DEMO_PLACEMENTS } = REFERENCE_ADVERTISING.registry;
import { currentAdvertiser, inventoryRows } from '../inventory-rows.js';

const TODAY = '2026-09-25';

describe('H4.1 — inventaire des emplacements', () => {
  const rows = inventoryRows(DEMO_PLACEMENTS, DEMO_BOOKINGS, TODAY, 12);

  it('rend un emplacement par ligne, dans l’ordre des codes', () => {
    expect(rows.map(r => r.placement.id)).toEqual([...DEMO_PLACEMENTS.map(p => p.id)].sort());
  });

  it('lit l’état du mois en cours dans les réservations', () => {
    expect(rows.find(r => r.placement.id === 'AP-N0-01')?.state).toBe('occupied');
    expect(rows.find(r => r.placement.id === 'AP-N2-07')?.state).toBe('free');
  });

  it('compte les mois tenus et trouve le premier mois libre', () => {
    const row = rows.find(r => r.placement.id === 'AP-N0-01');
    // Occupé de septembre à décembre 2026 : quatre mois tenus sur douze.
    expect(row?.heldMonths).toBe(4);
    expect(row?.firstFree).toBe('2027-01');
  });

  it('rattache à l’emplacement les doubles réservations relevées par le garde', () => {
    const row = rows.find(r => r.placement.id === 'AP-N0-04');
    expect(row?.conflicts.length).toBeGreaterThan(0);
    expect(row?.conflicts.every(f => f.code === 'AD.PLACEMENT_DOUBLE_BOOKED')).toBe(true);
    expect(rows.find(r => r.placement.id === 'AP-N0-01')?.conflicts).toHaveLength(0);
  });

  it('lit l’annonceur dans la réservation ferme en cours ou à venir, pas sur l’emplacement', () => {
    expect(rows.find(r => r.placement.id === 'AP-N0-01')?.advertiser).toBe('Groupe Vaudel');
    expect(currentAdvertiser(DEMO_BOOKINGS, 'AP-N0-04', TODAY)).toBe('Studio Lampas');
    // Une option ne tient pas l'emplacement : pas d'annonceur.
    expect(currentAdvertiser(DEMO_BOOKINGS, 'AP-N2-07', TODAY)).toBeNull();
  });

  it('rend deux fois la même chose (INV-4)', () => {
    expect(inventoryRows(DEMO_PLACEMENTS, DEMO_BOOKINGS, TODAY, 12)).toEqual(rows);
  });
});
