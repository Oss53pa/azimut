import { describe, it, expect } from 'vitest';
import {
  occupancyHistory, occupantsOn, isInForceOn, previousOccupancy,
} from '../occupancy.js';
import type { Destination } from '../site.js';

const ORG = 'aaaaaaaa-0000-0000-0000-000000000001';
const CELL = 'ffffffff-0000-0000-0000-0000000000b1';
const OTHER_CELL = 'ffffffff-0000-0000-0000-0000000000b2';

function occupancy(
  id: string,
  occupant_name: string,
  period: { readonly from?: string; readonly to?: string } = {},
  footprint_id = CELL,
): Destination {
  return {
    id,
    org_id: ORG,
    footprint_id,
    node_id: 'nnnnnnnn-0000-0000-0000-000000000001',
    category_id: 'cccccccc-0000-0000-0000-000000000001',
    occupant_name,
    occupancy_status: period.to === undefined ? 'occupied' : 'vacant',
    display_priority: 5,
    ...(period.from === undefined ? {} : { valid_from: period.from }),
    ...(period.to === undefined ? {} : { valid_to: period.to }),
  };
}

/**
 * N1.7, critère 4 : « L'historique d'occupation survit à trois changements
 * successifs sur une même cellule. »
 *
 * Trois changements, donc quatre occupants : c'est la lecture stricte, et
 * c'est la plus exigeante.
 */
const B01_HISTORY: readonly Destination[] = [
  occupancy('d-1', 'Librairie du Coin', { from: '2019-03-01', to: '2021-06-30' }),
  occupancy('d-2', 'Optique Vallon', { from: '2021-09-01', to: '2023-01-15' }),
  occupancy('d-3', 'Café Melba', { from: '2023-04-01', to: '2025-12-31' }),
  occupancy('d-4', 'Maison Perrin', { from: '2026-02-01' }),
];

describe('S5 (partie N) — l’historique d’occupation se lit', () => {
  it('survit à trois changements successifs sur une même cellule', () => {
    const history = occupancyHistory(B01_HISTORY, CELL);
    expect(history.map(d => d.occupant_name)).toEqual([
      'Librairie du Coin', 'Optique Vallon', 'Café Melba', 'Maison Perrin',
    ]);
  });

  it('rend le même ordre quel que soit l’ordre d’entrée (A9)', () => {
    const shuffled = [B01_HISTORY[2], B01_HISTORY[0], B01_HISTORY[3], B01_HISTORY[1]]
      .filter((d): d is Destination => d !== undefined);
    expect(occupancyHistory(shuffled, CELL).map(d => d.id))
      .toEqual(occupancyHistory(B01_HISTORY, CELL).map(d => d.id));
  });

  it('départage deux occupations de même date par leur identifiant', () => {
    const same = [
      occupancy('d-b', 'Seconde', { from: '2024-01-01' }),
      occupancy('d-a', 'Première', { from: '2024-01-01' }),
    ];
    expect(occupancyHistory(same, CELL).map(d => d.id)).toEqual(['d-a', 'd-b']);
  });

  it('place une entrée non relevée avant ce qui est daté', () => {
    const withUnknownStart = [
      occupancy('d-2', 'Optique Vallon', { from: '2021-09-01' }),
      occupancy('d-0', 'Occupant d’origine', { to: '2019-02-28' }),
    ];
    expect(occupancyHistory(withUnknownStart, CELL).map(d => d.id)).toEqual(['d-0', 'd-2']);
  });

  it('ne mélange pas deux cellules', () => {
    const mixed = [...B01_HISTORY, occupancy('d-9', 'Voisin', { from: '2020-01-01' }, OTHER_CELL)];
    expect(occupancyHistory(mixed, CELL)).toHaveLength(4);
    expect(occupancyHistory(mixed, OTHER_CELL).map(d => d.occupant_name)).toEqual(['Voisin']);
  });
});

describe('S5 (partie N) — l’occupant en vigueur à une date', () => {
  it('retrouve chacun des quatre à une date de sa période', () => {
    const at = (on: string): readonly string[] =>
      occupantsOn(B01_HISTORY, CELL, on).map(d => d.occupant_name);
    expect(at('2020-01-01')).toEqual(['Librairie du Coin']);
    expect(at('2022-05-05')).toEqual(['Optique Vallon']);
    expect(at('2024-08-20')).toEqual(['Café Melba']);
    expect(at('2026-09-22')).toEqual(['Maison Perrin']);
  });

  it('ne rend personne entre deux occupations', () => {
    expect(occupantsOn(B01_HISTORY, CELL, '2021-07-15')).toHaveLength(0);
  });

  it('inclut les deux bornes de la période', () => {
    const d = occupancy('d-1', 'Librairie du Coin', { from: '2019-03-01', to: '2021-06-30' });
    expect(isInForceOn(d, '2019-03-01')).toBe(true);
    expect(isInForceOn(d, '2021-06-30')).toBe(true);
    expect(isInForceOn(d, '2019-02-28')).toBe(false);
    expect(isInForceOn(d, '2021-07-01')).toBe(false);
  });

  it('une sortie non connue vaut occupant en cours', () => {
    const current = occupancy('d-4', 'Maison Perrin', { from: '2026-02-01' });
    expect(isInForceOn(current, '2099-01-01')).toBe(true);
  });

  it('une entrée non relevée vaut depuis toujours', () => {
    const origin = occupancy('d-0', 'Occupant d’origine', { to: '2019-02-28' });
    expect(isInForceOn(origin, '1998-06-01')).toBe(true);
  });

  it('rend les deux occupations d’un recouvrement, plutôt que d’en choisir une', () => {
    // La contrainte de la migration 0020 ne refuse qu'une période renversée.
    // Un recouvrement est donc possible en base, et le taire serait pire.
    const overlapping = [
      occupancy('d-a', 'Sortante', { from: '2024-01-01', to: '2024-06-30' }),
      occupancy('d-b', 'Entrante', { from: '2024-06-01' }),
    ];
    expect(occupantsOn(overlapping, CELL, '2024-06-15').map(d => d.occupant_name))
      .toEqual(['Sortante', 'Entrante']);
  });
});

describe('S5 (partie N) — l’occupation précédente, pour le chiffrage de reprise', () => {
  it('rend celle qui précède', () => {
    expect(previousOccupancy(B01_HISTORY, 'd-3')?.occupant_name).toBe('Optique Vallon');
  });

  it('rend rien pour la première', () => {
    expect(previousOccupancy(B01_HISTORY, 'd-1')).toBeNull();
  });

  it('rend rien pour une destination inconnue', () => {
    expect(previousOccupancy(B01_HISTORY, 'd-inexistante')).toBeNull();
  });
});
