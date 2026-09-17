import { describe, it, expect } from 'vitest';
import { refMinimal } from '@azimut/testkit';
import type { DestinationName, LexiconTerm, SiteData } from '@azimut/core-model';
import { auditLexicon } from '../audit-lexicon.js';

const TERMS: LexiconTerm[] = [
  { lang: 'fr', term: 'client', severity: 'forbidden' },
  { lang: 'fr', term: 'boutique', severity: 'discouraged' },
  { lang: 'en', term: 'shop', severity: 'discouraged' },
];

function named(entries: readonly (readonly [string, DestinationName['lang'], string])[]): SiteData {
  const destination_names: DestinationName[] = entries.map(([id, lang, value]) => ({
    id,
    org_id: 'org-test-001',
    destination_id: 'd-1',
    lang,
    value,
  }));
  return { ...refMinimal, destination_names };
}

describe('auditLexicon (A5.8)', () => {
  it('ne rend rien quand le vocabulaire est propre', () => {
    const report = auditLexicon(named([['n-1', 'fr', 'Accueil visiteurs']]), TERMS);
    expect(report.findings).toEqual([]);
    expect(report.checked_texts).toBe(1);
    expect(report.forbidden_count).toBe(0);
  });

  it('lève LAYOUT.LEXICON_FORBIDDEN_TERM sur la dénomination fautive', () => {
    const report = auditLexicon(named([['n-1', 'fr', 'Service client']]), TERMS);
    const [finding] = report.findings;
    expect(finding?.code).toBe('LAYOUT.LEXICON_FORBIDDEN_TERM');
    expect(finding?.severity).toBe('blocking');
    expect(finding?.entity).toEqual({ kind: 'destination_name', id: 'n-1' });
    expect(finding?.params['term']).toBe('client');
    expect(report.forbidden_count).toBe(1);
  });

  it('lève l’avertissement pour un terme seulement déconseillé', () => {
    const report = auditLexicon(named([['n-1', 'fr', 'Boutique du musée']]), TERMS);
    expect(report.findings[0]?.code).toBe('LAYOUT.LEXICON_DISCOURAGED_TERM');
    expect(report.findings[0]?.severity).toBe('warning');
    expect(report.discouraged_count).toBe(1);
  });

  it('rend des bornes qui redécoupent exactement le terme fautif', () => {
    const value = 'Œuvres et service client';
    const report = auditLexicon(named([['n-1', 'fr', value]]), TERMS);
    const finding = report.findings[0];
    const start = finding?.params['start'];
    const end = finding?.params['end'];
    expect(typeof start).toBe('number');
    expect(value.slice(Number(start), Number(end))).toBe('client');
  });

  it('juge chaque dénomination dans sa langue', () => {
    const report = auditLexicon(
      named([
        ['n-1', 'en', 'Gift shop'],
        ['n-2', 'fr', 'Boutique cadeaux'],
      ]),
      TERMS,
    );
    expect(report.findings).toHaveLength(2);
    expect(report.findings.map((f) => f.params['lang'])).toEqual(['en', 'fr']);
  });

  it('n’applique pas un terme français à un libellé anglais', () => {
    const report = auditLexicon(named([['n-1', 'en', 'Client services']]), TERMS);
    expect(report.findings).toEqual([]);
  });

  it('parcourt les dénominations par identifiant, quel que soit l’ordre reçu', () => {
    const report = auditLexicon(
      named([
        ['n-c', 'fr', 'Service client'],
        ['n-a', 'fr', 'Accueil client'],
        ['n-b', 'fr', 'Espace client'],
      ]),
      TERMS,
    );
    expect(report.findings.map((f) => f.entity?.id)).toEqual(['n-a', 'n-b', 'n-c']);
  });

  it('sans lexique, ne juge rien et le dit par son compteur', () => {
    const report = auditLexicon(named([['n-1', 'fr', 'Service client']]), []);
    expect(report.findings).toEqual([]);
    expect(report.checked_texts).toBe(1);
  });

  it('est déterministe', () => {
    const site = named([['n-1', 'fr', 'Client et boutique']]);
    expect(JSON.stringify(auditLexicon(site, TERMS)))
      .toBe(JSON.stringify(auditLexicon(site, TERMS)));
  });
});
