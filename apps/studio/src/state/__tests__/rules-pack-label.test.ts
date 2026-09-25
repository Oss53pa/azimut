import { describe, it, expect } from 'vitest';
import { rulesPackLabel } from '../rules-pack-label.js';

/**
 * A5.8 — un écran cite les paquets d'un site depuis le rattachement, le socle
 * d'abord, et ne dit rien quand il n'y en a pas : c'est à lui de le dire.
 */
describe('A5.8 — les paquets d’un site, tels qu’un écran les cite', () => {
  it('rend `null` pour un site sans paquet', () => {
    expect(rulesPackLabel([])).toBeNull();
  });

  it('cite le socle seul', () => {
    expect(rulesPackLabel([{ id: 'b', rules_pack_id: 'p-socle', role: 'base' }])).toBe('p-socle');
  });

  it('cite le socle puis la surcouche, quel que soit l’ordre des lignes', () => {
    expect(rulesPackLabel([
      { id: 'o', rules_pack_id: 'p-pays', role: 'overlay' },
      { id: 'b', rules_pack_id: 'p-socle', role: 'base' },
    ])).toBe('p-socle · p-pays');
  });
});
