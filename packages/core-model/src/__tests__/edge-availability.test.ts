import { describe, it, expect } from 'vitest';
import { readEdgeAvailability, isClosedAt, closuresOverlapping } from '../index.js';

const WORKS = { from: '2026-10-12T00:00:00', to: '2026-10-16T23:59:59', reason_key: 'works', declared_by: 'm-1' };

describe('A5.3 — disponibilité d’une arête', () => {
  it('lit une colonne vide comme une arête sans fermeture déclarée', () => {
    expect(readEdgeAvailability(null)).toBeUndefined();
  });

  it('lit les fermetures, triées par début', () => {
    const late = { ...WORKS, from: '2026-11-01T00:00:00', to: '2026-11-02T00:00:00' };
    const a = readEdgeAvailability({ closures: [late, WORKS] });
    expect(a?.readable && a.closures.map(c => c.from)).toEqual(['2026-10-12T00:00:00', '2026-11-01T00:00:00']);
  });

  it('garde illisible toute la valeur si une seule fermeture l’est, pour n’en perdre aucune', () => {
    expect(readEdgeAvailability({ closures: [WORKS, { from: 'demain' }] })).toEqual({ readable: false });
    expect(readEdgeAvailability({ closures: [{ ...WORKS, to: '2026-10-01T00:00:00' }] })).toEqual({ readable: false });
    expect(readEdgeAvailability({ closures: [{ ...WORKS, from: '2026-10-12T00:00:00+02:00' }] })).toEqual({ readable: false });
    expect(readEdgeAvailability([1])).toEqual({ readable: false });
  });

  it('ferme l’arête sur la plage, bornes incluses, et pas en dehors', () => {
    const a = readEdgeAvailability({ closures: [WORKS] });
    expect(isClosedAt(a, '2026-10-12T00:00:00')).toBe(true);
    expect(isClosedAt(a, '2026-10-16T23:59:59')).toBe(true);
    expect(isClosedAt(a, '2026-10-17T00:00:00')).toBe(false);
    expect(isClosedAt(undefined, '2026-10-13T00:00:00')).toBe(false);
  });

  it('tient pour fermée une arête dont la disponibilité est illisible', () => {
    expect(isClosedAt({ readable: false }, '2026-01-01T00:00:00')).toBe(true);
  });

  it('trouve les fermetures qui recouvrent une journée', () => {
    const a = readEdgeAvailability({ closures: [WORKS] });
    expect(closuresOverlapping(a, '2026-10-16T00:00:00', '2026-10-16T23:59:59')).toHaveLength(1);
    expect(closuresOverlapping(a, '2026-10-17T00:00:00', '2026-10-17T23:59:59')).toHaveLength(0);
  });
});
