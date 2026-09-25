import { describe, it, expect } from 'vitest';
import { packsByPrecedence } from '@azimut/core-model';
import { allReferenceSites } from '../index.js';

/**
 * A5.4 et A5.8 — un pictogramme de sécurité ne sert que s'il est vu.
 *
 * « Un pictogramme de sécurité sans paquet n'est vu par aucun site, c'est donc
 * une donnée morte. » Il en va de même d'un pictogramme rattaché à un paquet
 * que son site ne porte pas : le registre de sécurité d'un site est fait des
 * paquets qui lui sont rattachés, et d'eux seuls. Un site de référence doit
 * porter le cas qu'il éprouve.
 */
describe('A5.4 — les pictogrammes de sécurité des sites de référence sont vus', () => {
  for (const [key, site] of allReferenceSites) {
    it(`${key} : chaque pictogramme de sécurité vient d’un paquet rattaché au site`, () => {
      const bound = new Set(packsByPrecedence(site.rules_bindings));
      const unseen = site.pictograms
        .filter(p => p.registry === 'safety')
        .filter(p => p.rules_pack_id === null || !bound.has(p.rules_pack_id))
        .map(p => p.id);
      expect(unseen).toEqual([]);
    });
  }
});
