import { describe, it, expect } from 'vitest';
import { empreinte } from '@azimut/core-model';
import { stableChecksum, siteChecksum } from '../checksum.js';

describe('stableChecksum', () => {
  it('rend une empreinte de la forme canonique : sha256: et 64 chiffres hexadécimaux', () => {
    expect(stableChecksum({ a: 1 })).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('est la fonction d’empreinte du produit, et non une seconde forme (D7.2)', () => {
    const value = { name: 'test', nested: { b: 2, a: 1 }, label: 'é' };
    expect(stableChecksum(value)).toBe(empreinte(value));
  });

  it('est déterministe', () => {
    const obj = { name: 'test', value: 42 };
    expect(stableChecksum(obj)).toBe(stableChecksum(obj));
  });

  it('ne dépend pas de l’ordre des clés, à tous les niveaux', () => {
    expect(stableChecksum({ x: 1, y: { p: 1, q: 2 } })).toBe(stableChecksum({ y: { q: 2, p: 1 }, x: 1 }));
  });

  it('distingue deux valeurs différentes', () => {
    expect(stableChecksum({ a: 1 })).not.toBe(stableChecksum({ a: 2 }));
  });

  it('fait échouer l’essai sur une valeur non hachable, en nommant le code', () => {
    expect(() => stableChecksum({ a: Number.NaN })).toThrow('DATA.HASH_INPUT_INVALID');
  });
});

describe('siteChecksum', () => {
  it('est la même empreinte que stableChecksum : l’ordre des clés ne compte plus', () => {
    const a = { x: 1, y: 2 };
    const b = { y: 2, x: 1 };
    expect(siteChecksum(a)).toBe(siteChecksum(b));
    expect(siteChecksum(a)).toBe(stableChecksum(a));
  });
});
