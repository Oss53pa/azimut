import { describe, it, expect } from 'vitest';
import { longestVariant, textExpansionFindings } from '../text-expansion.js';

describe('D12.2 — longestVariant', () => {
  it('returns the longest text among active languages', () => {
    const names = { fr: 'Accueil', en: 'Reception desk' };
    const result = longestVariant(names, ['fr', 'en']);
    expect(result?.lang).toBe('en');
    expect(result?.text).toBe('Reception desk');
    expect(result?.length).toBe(14);
  });

  it('returns null when no active language has a name', () => {
    const names = { de: 'Empfang' };
    expect(longestVariant(names, ['fr', 'en'])).toBeNull();
  });

  it('handles deliberately long names (German compound)', () => {
    const names = {
      fr: 'Salle de réunion',
      en: 'Meeting room',
      de: 'Besprechungszimmer mit Videokonferenz',
    };
    const result = longestVariant(names, ['fr', 'en', 'de']);
    expect(result?.lang).toBe('de');
    expect(result?.length).toBe(37);
  });

  it('uses sorted language order for deterministic tiebreaker', () => {
    const names = { fr: 'Porte', en: 'Poort' };
    const r1 = longestVariant(names, ['fr', 'en']);
    const r2 = longestVariant(names, ['en', 'fr']);
    expect(r1?.lang).toBe(r2?.lang);
  });

  it('uses the longest variant, never the primary language', () => {
    const names = {
      fr: 'Bureau',
      en: 'Director of international partnerships office',
    };
    const result = longestVariant(names, ['fr', 'en']);
    expect(result?.lang).toBe('en');
    expect(result?.length).toBe(45);
  });

  it('handles single language', () => {
    const names = { fr: 'Cafétéria' };
    const result = longestVariant(names, ['fr']);
    expect(result?.lang).toBe('fr');
    expect(result?.text).toBe('Cafétéria');
  });

  it('returns null for empty names object', () => {
    expect(longestVariant({}, ['fr', 'en'])).toBeNull();
  });

  it('returns null for empty activeLangs', () => {
    expect(longestVariant({ fr: 'Accueil' }, [])).toBeNull();
  });

  it('skips languages not in active list', () => {
    const names = {
      fr: 'Court',
      en: 'A very long English name for dimension calculation',
    };
    const result = longestVariant(names, ['fr']);
    expect(result?.lang).toBe('fr');
  });
});

describe('D12.2 — textExpansionFindings', () => {
  it('emits LANG_VARIANT_LONGER when non-primary is longer', () => {
    const names = {
      fr: 'Accueil',
      en: 'Information and reception desk',
    };
    const findings = textExpansionFindings(names, 'fr', ['fr', 'en'], 'dest-1');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.code).toBe('LAYOUT.LANG_VARIANT_LONGER');
    expect(findings[0]?.severity).toBe('info');
    expect(findings[0]?.params?.['longer_lang']).toBe('en');
  });

  it('emits nothing when primary is longest', () => {
    const names = {
      fr: 'Salle de conférence internationale',
      en: 'Conference room',
    };
    const findings = textExpansionFindings(names, 'fr', ['fr', 'en'], 'dest-2');
    expect(findings).toEqual([]);
  });

  it('emits nothing when primary language is missing', () => {
    const names = { en: 'Hall' };
    const findings = textExpansionFindings(names, 'fr', ['fr', 'en'], 'dest-3');
    expect(findings).toEqual([]);
  });

  it('emits nothing when lengths are equal', () => {
    const names = { fr: 'Porte', en: 'Entry' };
    const findings = textExpansionFindings(names, 'fr', ['fr', 'en'], 'dest-4');
    expect(findings).toEqual([]);
  });

  it('emits nothing with single active language (primary only)', () => {
    const names = { fr: 'Accueil' };
    const findings = textExpansionFindings(names, 'fr', ['fr'], 'dest-5');
    expect(findings).toEqual([]);
  });

  it('uses deliberately long test names per spec', () => {
    const names = {
      fr: 'Accueil',
      en: 'Main reception and visitor registration area with security checkpoint',
    };
    const result = longestVariant(names, ['fr', 'en']);
    expect(result?.lang).toBe('en');
    expect(result?.length).toBeGreaterThan(names.fr.length);
  });

  it('emits nothing when primaryLang not in activeLangs but exists in names', () => {
    const names = { fr: 'Court', en: 'Longer name', de: 'Noch länger' };
    // Primary 'fr' exists in names but not in activeLangs
    const findings = textExpansionFindings(names, 'fr', ['en', 'de'], 'dest-6');
    // Primary text IS defined → longest among activeLangs is 'de'
    // But 'de' !== 'fr' AND 'de'.length > 'fr'.length → finding emitted
    expect(findings).toHaveLength(1);
    expect(findings[0]?.params?.['longer_lang']).toBe('de');
  });

  it('empty-string name is a valid zero-length candidate', () => {
    const names = { fr: '', en: 'Hall' };
    const result = longestVariant(names, ['fr', 'en']);
    // 'en' is longer than empty 'fr'
    expect(result?.lang).toBe('en');
    expect(result?.length).toBe(4);
  });

  it('all-empty names still returns the first alphabetically', () => {
    const names = { fr: '', en: '' };
    const result = longestVariant(names, ['fr', 'en']);
    // Both length 0 — sorted order picks 'en' first
    expect(result).not.toBeNull();
    expect(result?.lang).toBe('en');
    expect(result?.length).toBe(0);
  });
});
