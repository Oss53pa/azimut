import { describe, it, expect } from 'vitest';
import { readChosenOrg, writeChosenOrg } from '../chosen-org.js';
import type { ChoiceStorage } from '../chosen-org.js';

const USER = 'aaaaaaaa-0000-4000-8000-0000000000d1';
const OTHER = 'aaaaaaaa-0000-4000-8000-0000000000d2';
const ORG = 'aaaaaaaa-0000-4000-8000-0000000000a1';

function memory(): ChoiceStorage {
  const map = new Map<string, string>();
  return {
    getItem: k => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v); },
    removeItem: k => { map.delete(k); },
  };
}

describe('AUTH.4 — l’organisation choisie, gardée pour l’onglet', () => {
  it('se relit pour le même utilisateur, pas pour un autre', () => {
    const storage = memory();
    writeChosenOrg(USER, ORG, storage);
    expect(readChosenOrg(USER, storage)).toBe(ORG);
    expect(readChosenOrg(OTHER, storage)).toBeNull();
  });

  it('revenir sur son choix l’efface', () => {
    const storage = memory();
    writeChosenOrg(USER, ORG, storage);
    writeChosenOrg(USER, null, storage);
    expect(readChosenOrg(USER, storage)).toBeNull();
  });

  it('une valeur qui n’est pas un identifiant est ignorée', () => {
    const storage = memory();
    storage.setItem(`azimut.studio.org.${USER}`, '<script>');
    expect(readChosenOrg(USER, storage)).toBeNull();
  });

  it('un stockage refusé ne lève rien', () => {
    const refusing: ChoiceStorage = {
      getItem: () => { throw new Error('refusé'); },
      setItem: () => { throw new Error('refusé'); },
      removeItem: () => { throw new Error('refusé'); },
    };
    expect(() => { writeChosenOrg(USER, ORG, refusing); }).not.toThrow();
    expect(readChosenOrg(USER, refusing)).toBeNull();
    expect(readChosenOrg(USER, null)).toBeNull();
  });
});
