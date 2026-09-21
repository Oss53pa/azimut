import { describe, it, expect } from 'vitest';
import { findLexiconMatches } from '../lexicon.js';
import type { LexiconTerm } from '../lexicon.js';

const FR: LexiconTerm[] = [
  { lang: 'fr', term: 'client', severity: 'forbidden' },
  { lang: 'fr', term: 'clients', severity: 'forbidden' },
  { lang: 'fr', term: 'boutique', severity: 'discouraged' },
];

describe('findLexiconMatches', () => {
  it('trouve un terme interdit et le situe', () => {
    const [match] = findLexiconMatches('Accueil client au niveau 1', FR, 'fr');
    expect(match?.term).toBe('client');
    expect(match?.severity).toBe('forbidden');
    expect('Accueil client au niveau 1'.slice(match?.start, match?.end)).toBe('client');
  });

  it('ignore la casse et les accents', () => {
    const text = 'CLIENTS attendus';
    const [match] = findLexiconMatches(text, FR, 'fr');
    expect(match?.term).toBe('clients');
    expect(text.slice(match?.start, match?.end)).toBe('CLIENTS');
  });

  it('situe juste malgré une translittération qui rallonge', () => {
    // « Œ » se replie en « oe » : un caractère d'origine, deux repliés. Sans
    // table d'index, la position rendue glisserait d'un cran par occurrence.
    const text = 'Œuvre et client';
    const [match] = findLexiconMatches(text, FR, 'fr');
    expect(text.slice(match?.start, match?.end)).toBe('client');
  });

  it('n’apparie que des mots entiers', () => {
    expect(findLexiconMatches('La clientèle attendue', FR, 'fr')).toEqual([]);
    expect(findLexiconMatches('téléclient', FR, 'fr')).toEqual([]);
  });

  it('apparie un terme de plusieurs mots', () => {
    const terms: LexiconTerm[] = [
      { lang: 'fr', term: 'caisse de parking', severity: 'forbidden' },
    ];
    const [match] = findLexiconMatches('Voir la caisse de parking au fond', terms, 'fr');
    expect(match?.term).toBe('caisse de parking');
  });

  it('n’applique pas un terme d’une autre langue', () => {
    expect(findLexiconMatches('Client welcome desk', FR, 'en')).toEqual([]);
  });

  it('trouve toutes les occurrences, ordonnées par position', () => {
    const text = 'Client ici, client là';
    const found = findLexiconMatches(text, FR, 'fr');
    expect(found).toHaveLength(2);
    expect(found[0]?.start).toBeLessThan(found[1]?.start ?? 0);
  });

  it('distingue interdit et déconseillé', () => {
    const found = findLexiconMatches('Une boutique pour le client', FR, 'fr');
    expect(found.map((m) => m.severity)).toEqual(['discouraged', 'forbidden']);
  });

  it('est déterministe et sans effet de bord sur la liste de termes', () => {
    const terms = [...FR];
    const text = 'client et boutique';
    expect(JSON.stringify(findLexiconMatches(text, terms, 'fr')))
      .toBe(JSON.stringify(findLexiconMatches(text, terms, 'fr')));
    expect(terms).toEqual(FR);
  });

  it('ignore un terme vide ou réduit à des espaces plutôt que d’apparier partout', () => {
    // Le texte porte volontairement la suite d'espaces que le terme
    // apparierait si elle n'était pas rognée.
    for (const term of ['', '   ']) {
      const terms: LexiconTerm[] = [{ lang: 'fr', term, severity: 'forbidden' }];
      expect(findLexiconMatches('un   texte   espacé', terms, 'fr')).toEqual([]);
    }
  });

  it('rogne un terme mal saisi au lieu de le laisser muet', () => {
    const terms: LexiconTerm[] = [{ lang: 'fr', term: '  client  ', severity: 'forbidden' }];
    const [match] = findLexiconMatches('Accueil client', terms, 'fr');
    expect(match?.term).toBe('  client  ');
    expect('Accueil client'.slice(match?.start, match?.end)).toBe('client');
  });
});
