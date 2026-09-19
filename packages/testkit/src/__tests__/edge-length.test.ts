import { describe, it, expect } from 'vitest';
import { computeEdgeLengths } from '@azimut/core-model';
import { allReferenceSites } from '../index.js';

/**
 * S6 — « La longueur d'une arête est calculée, jamais saisie. »
 *
 * Les jeux d'essai sont des littéraux : la longueur y est écrite à la main, et
 * rien n'empêcherait d'en écrire une fausse. Ce test l'empêche.
 *
 * L'égalité est exacte, sans tolérance : la mesure est arrondie au millimètre,
 * donc une longueur écrite au millimètre lui est exactement comparable. Une
 * tolérance laisserait passer une valeur approchée, c'est à dire une saisie.
 */
describe('S6 — longueur des arêtes des sites de référence', () => {
  for (const [key, site] of allReferenceSites) {
    it(`${key} : chaque longueur écrite est celle que mesurent ses nœuds`, () => {
      const computed = computeEdgeLengths({
        levels: site.levels,
        nodes: site.graph.nodes,
        edges: site.graph.edges,
      });

      const wrong = site.graph.edges
        .map(edge => ({ edge, measured: computed.get(edge.id) }))
        .filter(({ edge, measured }) => measured !== undefined && measured !== edge.length_m)
        .map(({ edge, measured }) =>
          `${edge.id}: écrit ${String(edge.length_m)}, mesuré ${String(measured)}`,
        );

      expect(wrong, wrong.join('\n')).toHaveLength(0);
    });
  }
});
