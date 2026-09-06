import { describe, it, expect } from 'vitest';
import { generateLegend, compassRoseRotation } from '../legend.js';
import type { CategoryPresence } from '../legend.js';

function cat(
  id: string,
  label: Record<string, string>,
  count: number,
  color = 'role:default',
): CategoryPresence {
  return { categoryId: id, label, color, pictogramId: null, destinationCount: count };
}

describe('E9.4 — legend generation', () => {
  describe('generateLegend', () => {
    it('includes only categories with destinations', () => {
      const categories = [
        cat('c1', { fr: 'Alpha' }, 3),
        cat('c2', { fr: 'Beta' }, 0),
        cat('c3', { fr: 'Gamma' }, 1),
      ];
      const legend = generateLegend(categories, 'fr');
      expect(legend).toHaveLength(2);
      expect(legend.map(e => e.categoryId)).toStrictEqual(['c1', 'c3']);
    });

    it('sorts by label in the given language', () => {
      const categories = [
        cat('c1', { fr: 'Zulu' }, 1),
        cat('c2', { fr: 'Alpha' }, 2),
        cat('c3', { fr: 'Mike' }, 1),
      ];
      const legend = generateLegend(categories, 'fr');
      expect(legend.map(e => e.label['fr'])).toStrictEqual(['Alpha', 'Mike', 'Zulu']);
    });

    it('tiebreaks by categoryId when labels match', () => {
      const categories = [
        cat('cat-b', { fr: 'Même' }, 1),
        cat('cat-a', { fr: 'Même' }, 1),
      ];
      const legend = generateLegend(categories, 'fr');
      expect(legend.map(e => e.categoryId)).toStrictEqual(['cat-a', 'cat-b']);
    });

    it('handles missing language gracefully', () => {
      const categories = [
        cat('c1', { fr: 'Bonjour' }, 1),
        cat('c2', { fr: 'Au revoir' }, 1),
      ];
      const legend = generateLegend(categories, 'en');
      // Both labels are '' in 'en' → tiebreak by id
      expect(legend.map(e => e.categoryId)).toStrictEqual(['c1', 'c2']);
    });

    it('preserves count in entries', () => {
      const categories = [cat('c1', { fr: 'A' }, 42)];
      const legend = generateLegend(categories, 'fr');
      expect(legend[0]?.count).toBe(42);
    });

    it('returns empty for no categories', () => {
      expect(generateLegend([], 'fr')).toStrictEqual([]);
    });

    it('returns empty when all categories are empty', () => {
      const categories = [cat('c1', { fr: 'A' }, 0), cat('c2', { fr: 'B' }, 0)];
      expect(generateLegend(categories, 'fr')).toStrictEqual([]);
    });
  });

  describe('compassRoseRotation', () => {
    it('returns 0 for north-aligned level', () => {
      expect(compassRoseRotation(0)).toBe(0);
    });

    it('returns bearing unchanged for positive values', () => {
      expect(compassRoseRotation(45)).toBe(45);
    });

    it('normalizes negative bearing', () => {
      expect(compassRoseRotation(-90)).toBe(270);
    });

    it('normalizes over 360', () => {
      expect(compassRoseRotation(450)).toBe(90);
    });

    it('normalizes large negative', () => {
      expect(compassRoseRotation(-720)).toBe(0);
    });
  });
});
