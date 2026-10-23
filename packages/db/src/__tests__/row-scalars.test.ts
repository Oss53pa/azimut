import { describe, it, expect } from 'vitest';
import { asStringArray, versionState } from '../mapping/row-scalars.js';

/**
 * Lot 4 de l'audit (A6.3) : une valeur relue hors de sa forme fait échouer la
 * lecture, au lieu d'être changée en une autre.
 */
describe('lot 4 : les lectures élémentaires refusent au lieu de convertir', () => {
  it('un état de version inconnu n’est pas lu comme un brouillon', () => {
    expect(versionState('approved')).toBe('approved');
    expect(() => versionState('publie')).toThrow(/état de version/);
  });

  it('une liste qui ne contient pas que des chaînes n’est pas filtrée en silence', () => {
    expect(asStringArray(['a', 'b'])).toEqual(['a', 'b']);
    expect(asStringArray(null)).toBeUndefined();
    expect(() => asStringArray(['a', 1])).toThrow(/que des chaînes/);
  });
});
