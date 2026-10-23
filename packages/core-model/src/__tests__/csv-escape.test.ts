import { describe, it, expect } from 'vitest';
import { escapeCsvCell } from '../index.js';

/** Lot 4 de l'audit (A6.3) : une cellule d'export ne devient jamais une formule. */
describe('lot 4 : la cellule d’un export de tableur', () => {
  it.each([
    ['=HYPERLINK("https://exemple.test","x")', `"'=HYPERLINK(""https://exemple.test"",""x"")"`],
    ['+cmd|\' /C calc\'!A0', `'+cmd|' /C calc'!A0`],
    ['-2+3', `'-2+3`],
    ['@SUM(A1)', `'@SUM(A1)`],
    ['\tcachée', `'\tcachée`],
  ])('neutralise %s', (value, expected) => {
    expect(escapeCsvCell(value)).toBe(expected);
  });

  it('laisse un nombre simple tel quel', () => {
    expect(escapeCsvCell('-3')).toBe('-3');
    expect(escapeCsvCell('+2.5')).toBe('+2.5');
    expect(escapeCsvCell('12')).toBe('12');
  });

  it('entoure de guillemets une cellule qui porte le séparateur, un guillemet ou une fin de ligne', () => {
    expect(escapeCsvCell('a;b')).toBe('"a;b"');
    expect(escapeCsvCell('dit "oui"')).toBe('"dit ""oui"""');
    expect(escapeCsvCell('deux\nlignes')).toBe('"deux\nlignes"');
    expect(escapeCsvCell('a,b', ',')).toBe('"a,b"');
    expect(escapeCsvCell('Hall Nord')).toBe('Hall Nord');
  });
});
