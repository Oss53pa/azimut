import { describe, it, expect } from 'vitest';
import {
  WEEKDAYS, isWeekday, isOpeningRange, minutesOfDay, readOpeningHours,
  rangesForDay,
} from '../opening-hours.js';

/**
 * N1.2 — « Par jour, plusieurs plages possibles, fuseau du site. »
 */
describe('WEEKDAYS', () => {
  it('porte les sept jours, lundi d’abord', () => {
    expect(WEEKDAYS).toHaveLength(7);
    expect(WEEKDAYS[0]).toBe('monday');
    expect(WEEKDAYS[6]).toBe('sunday');
  });

  it('n’admet aucun autre jour', () => {
    expect(isWeekday('monday')).toBe(true);
    expect(isWeekday('lundi')).toBe(false);
    expect(isWeekday('Monday')).toBe(false);
  });
});

describe('minutesOfDay', () => {
  it('lit une heure HH:MM', () => {
    expect(minutesOfDay('00:00')).toBe(0);
    expect(minutesOfDay('08:30')).toBe(510);
    expect(minutesOfDay('23:59')).toBe(1439);
  });

  it('refuse ce qui n’est pas une heure du jour', () => {
    expect(minutesOfDay('24:00')).toBeNull();
    expect(minutesOfDay('08:60')).toBeNull();
    expect(minutesOfDay('8:30')).toBeNull();
    expect(minutesOfDay('08h30')).toBeNull();
    expect(minutesOfDay('')).toBeNull();
  });
});

describe('isOpeningRange', () => {
  it('accepte une plage de durée strictement positive', () => {
    expect(isOpeningRange({ from: '08:00', to: '19:00' })).toBe(true);
  });

  it('refuse une plage de durée nulle ou négative', () => {
    expect(isOpeningRange({ from: '08:00', to: '08:00' })).toBe(false);
    expect(isOpeningRange({ from: '19:00', to: '08:00' })).toBe(false);
  });

  it('refuse une plage qui franchirait minuit', () => {
    // Elle s'écrit sur deux jours ; l'accepter ici obligerait à deviner le
    // jour de la borne de fin.
    expect(isOpeningRange({ from: '22:00', to: '02:00' })).toBe(false);
  });

  it('refuse ce qui n’a pas la forme d’une plage', () => {
    expect(isOpeningRange(null)).toBe(false);
    expect(isOpeningRange('08:00-19:00')).toBe(false);
    expect(isOpeningRange({ from: '08:00' })).toBe(false);
    expect(isOpeningRange([{ from: '08:00', to: '19:00' }])).toBe(false);
  });
});

describe('readOpeningHours', () => {
  it('lit plusieurs plages sur un même jour', () => {
    const hours = readOpeningHours({
      monday: [{ from: '14:00', to: '19:30' }, { from: '09:30', to: '12:30' }],
    });
    // Triées par heure de début : la lecture est stable (invariant 4).
    expect(hours?.monday).toEqual([
      { from: '09:30', to: '12:30' },
      { from: '14:00', to: '19:30' },
    ]);
  });

  it('écarte un jour inconnu et une plage illisible', () => {
    const hours = readOpeningHours({
      monday: [{ from: '08:00', to: '19:00' }, { from: '19:00', to: '08:00' }],
      lundi: [{ from: '08:00', to: '19:00' }],
    });
    expect(hours?.monday).toHaveLength(1);
    expect(Object.keys(hours ?? {})).toEqual(['monday']);
  });

  it('distingue l’absence de déclaration de la fermeture', () => {
    // Rien de lisible : aucune déclaration, donc `undefined`.
    expect(readOpeningHours({})).toBeUndefined();
    expect(readOpeningHours({ monday: [] })).toBeUndefined();
    expect(readOpeningHours(null)).toBeUndefined();
    expect(readOpeningHours([])).toBeUndefined();
    // Un seul jour ouvert : les six autres sont fermés, et c'est déclaré.
    const hours = readOpeningHours({ sunday: [{ from: '10:00', to: '18:00' }] });
    expect(hours).toBeDefined();
    expect(rangesForDay(hours, 'sunday')).toHaveLength(1);
    expect(rangesForDay(hours, 'monday')).toEqual([]);
  });

  it('rend les mêmes horaires deux fois de suite', () => {
    const raw = {
      friday: [{ from: '14:00', to: '19:30' }, { from: '09:30', to: '12:30' }],
    };
    expect(readOpeningHours(raw)).toEqual(readOpeningHours(raw));
  });
});

describe('rangesForDay', () => {
  it('rend une liste vide pour un jour absent ou des horaires absents', () => {
    expect(rangesForDay(undefined, 'monday')).toEqual([]);
    expect(rangesForDay({}, 'monday')).toEqual([]);
  });
});
