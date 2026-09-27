import { describe, it, expect } from 'vitest';
import type { SiteCharter } from '@azimut/core-model';
import { charterElements, colorContrasts, formatParams } from '../charter-rows.js';

// Couleurs par un auxiliaire : aucun hexadécimal littéral dans le source (A2.4).
const hx = (rgb: string): string => `#${rgb}`;

// Charte fictive : aucune valeur ne provient d'une charte réelle.
const charter: SiteCharter = {
  id: 'ch-1', name: 'Charte d’essai', version: '1', created_at: '2026-01-01T00:00:00Z',
  colors: [
    { id: 'c1', key: 'fond', hex: hx('000000'), usage: 'fond' },
    { id: 'c2', key: 'texte', hex: hx('ffffff'), usage: 'texte' },
    { id: 'c3', key: 'casse', hex: 'rouge', usage: 'essai' },
  ],
  typefaces: [{ id: 'f1', key: 'titre', family: 'Famille A', weight: 500, min_size_mm: 12 }],
  rules: [{ id: 'r1', kind: 'proportion', params: { ratio: '2:1', axe: 'h' } }],
  lexicon: [{ id: 'l1', lang: 'fr', term: 'Issue', severity: 'discouraged' }],
};

describe('A5.8 — lignes de la charte', () => {
  it('rend un élément par ligne de chaque table, dans l’ordre couleur, caractère, règle, terme', () => {
    expect(charterElements(charter).map(e => e.kind)).toEqual(['color', 'color', 'color', 'typeface', 'rule', 'term']);
  });

  it('signale une couleur illisible au lieu de l’écarter', () => {
    const casse = charterElements(charter).find(e => e.id === 'c3');
    expect(casse?.valid).toBe(false);
  });

  it('cite les paramètres d’une règle, clés triées', () => {
    expect(formatParams({ ratio: '2:1', axe: 'h', n: 3 })).toBe('axe : h · n : 3 · ratio : 2:1');
  });

  it('calcule le contraste avec chaque autre couleur, sans seuil', () => {
    const [fond] = charter.colors;
    if (fond === undefined) throw new Error('jeu incomplet');
    const contrasts = colorContrasts(fond, charter);
    expect(contrasts.map(c => c.key)).toEqual(['texte', 'casse']);
    expect(contrasts[0]?.ratio).toBeCloseTo(21, 6);
    expect(contrasts[1]?.ratio).toBeNull();
  });
});
