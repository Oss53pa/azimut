import { describe, it, expect } from 'vitest';
import { listValue } from '../site-commands.js';

/**
 * E5.1 — l'encodage d'une liste dans une commande.
 *
 * La base a refusé chaque création de site tant que `active_langs`, colonne de
 * tableau, recevait du JSON. Ces essais fixent l'encodage ; l'essai de base de
 * la création de site vérifie qu'il passe réellement.
 */
describe('E5.1 — une liste voyage dans l’encodage de sa colonne', () => {
  it('rend une liste simple sans citation inutile', () => {
    expect(listValue(['en', 'fr'])).toBe('{en,fr}');
  });

  it('rend une liste vide', () => {
    expect(listValue([])).toBe('{}');
  });

  it('conserve l’ordre reçu', () => {
    expect(listValue(['fr', 'en'])).toBe('{fr,en}');
  });

  it('cite un élément portant le séparateur', () => {
    expect(listValue(['a,b'])).toBe('{"a,b"}');
  });

  it('cite un élément portant une accolade', () => {
    expect(listValue(['{x}'])).toBe('{"{x}"}');
  });

  it('cite et échappe un guillemet', () => {
    expect(listValue(['a"b'])).toBe('{"a\\"b"}');
  });

  it('cite et échappe une contre-oblique', () => {
    expect(listValue(['a\\b'])).toBe('{"a\\\\b"}');
  });

  it('cite un élément portant une espace', () => {
    expect(listValue(['deux mots'])).toBe('{"deux mots"}');
  });

  it('cite la chaîne vide, que la base lirait autrement', () => {
    expect(listValue([''])).toBe('{""}');
  });

  /** Sans citation, la base lirait une absence là où il y a un mot. */
  it('cite le mot NULL, quelle que soit sa casse', () => {
    expect(listValue(['NULL'])).toBe('{"NULL"}');
    expect(listValue(['null'])).toBe('{"null"}');
  });

  it('cite élément par élément, et non la liste entière', () => {
    expect(listValue(['en', 'a,b', 'fr'])).toBe('{en,"a,b",fr}');
  });
});
