import { describe, it, expect } from 'vitest';
import { ACTIVE_LANGS, isActiveLang, readActiveLangs } from '../lang.js';

/**
 * N1.2 — « Au moins une, `fr` et `en` seules valeurs admises en V1 ».
 */
describe('ACTIVE_LANGS', () => {
  it('porte exactement les deux langues de la V1', () => {
    expect([...ACTIVE_LANGS]).toEqual(['fr', 'en']);
  });

  it('n’admet aucune autre langue', () => {
    expect(isActiveLang('fr')).toBe(true);
    expect(isActiveLang('en')).toBe(true);
    expect(isActiveLang('de')).toBe(false);
    expect(isActiveLang('FR')).toBe(false);
    expect(isActiveLang('')).toBe(false);
  });
});

describe('readActiveLangs', () => {
  it('conserve l’ordre déclaré', () => {
    expect(readActiveLangs(['en', 'fr'])).toEqual(['en', 'fr']);
  });

  it('écarte une langue inconnue sans refuser les autres', () => {
    expect(readActiveLangs(['fr', 'de', 'en'])).toEqual(['fr', 'en']);
  });

  it('ne compte une langue qu’une fois', () => {
    expect(readActiveLangs(['fr', 'fr', 'en'])).toEqual(['fr', 'en']);
  });

  it('rend une liste vide quand rien n’est déclaré', () => {
    // Vide veut dire « non déclaré », pas « le français par défaut ».
    expect(readActiveLangs(null)).toEqual([]);
    expect(readActiveLangs(undefined)).toEqual([]);
    expect(readActiveLangs('fr')).toEqual([]);
    expect(readActiveLangs([])).toEqual([]);
  });

  it('écarte ce qui n’est pas une chaîne', () => {
    expect(readActiveLangs([1, true, null, 'fr'])).toEqual(['fr']);
  });
});
