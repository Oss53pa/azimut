import { describe, it, expect } from 'vitest';
import { refMinimal } from '@azimut/testkit';
import type { DestinationName, SiteData, SiteFact } from '@azimut/core-model';
import { auditSiteFacts } from '../audit-site-facts.js';

/** Le fait de référence du complément : le parking de Cosmos Angré est gratuit. */
const PARKING_GRATUIT: SiteFact = {
  key: 'parking_gratuit',
  value: 'oui',
  source: 'Décision de la Direction, 12 mars 2026',
  recorded_on: '2026-03-12',
  forbidden: [
    { lang: 'fr', term: 'paiement' },
    { lang: 'fr', term: 'payant' },
    { lang: 'fr', term: 'tarif' },
    { lang: 'fr', term: 'caisse de parking' },
    { lang: 'en', term: 'payment' },
  ],
};

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

describe('auditSiteFacts (M3, QC-05)', () => {
  it('ne rend rien quand aucun texte ne contredit un fait', () => {
    const report = auditSiteFacts(named([['n-1', 'fr', 'Parking visiteurs']]), [PARKING_GRATUIT]);
    expect(report.findings).toEqual([]);
    expect(report.checked_facts).toBe(1);
    expect(report.checked_texts).toBe(1);
  });

  it('refuse « Paiement du parking » sur un site où le parking est gratuit', () => {
    const report = auditSiteFacts(named([['n-1', 'fr', 'Paiement du parking']]), [PARKING_GRATUIT]);
    const [finding] = report.findings;
    expect(finding?.code).toBe('LAYOUT.FACT_CONTRADICTED');
    expect(finding?.severity).toBe('blocking');
    expect(finding?.params['term']).toBe('paiement');
  });

  it('nomme le fait, sa valeur et sa source, pour que réviser le fait reste une issue', () => {
    const report = auditSiteFacts(named([['n-1', 'fr', 'Caisse de parking']]), [PARKING_GRATUIT]);
    const [finding] = report.findings;
    expect(finding?.params['fact']).toBe('parking_gratuit');
    expect(finding?.params['fact_value']).toBe('oui');
    expect(finding?.params['fact_source']).toBe('Décision de la Direction, 12 mars 2026');
  });

  it('juge chaque texte dans sa langue', () => {
    const report = auditSiteFacts(
      named([
        ['n-1', 'en', 'Parking payment desk'],
        ['n-2', 'fr', 'Accès parking'],
      ]),
      [PARKING_GRATUIT],
    );
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]?.entity?.id).toBe('n-1');
    expect(report.findings[0]?.params['term']).toBe('payment');
  });

  it('rend des bornes qui redécoupent exactement le mot fautif', () => {
    const value = 'Parking payant au niveau 2';
    const report = auditSiteFacts(named([['n-1', 'fr', value]]), [PARKING_GRATUIT]);
    const finding = report.findings[0];
    expect(value.slice(Number(finding?.params['start']), Number(finding?.params['end'])))
      .toBe('payant');
  });

  it('n’apparie que des mots entiers, comme le lexique', () => {
    // « tarifaire » n'est pas « tarif ». Le fait énumère ses formes.
    const report = auditSiteFacts(named([['n-1', 'fr', 'Grille tarifaire']]), [PARKING_GRATUIT]);
    expect(report.findings).toEqual([]);
  });

  it('rapporte une anomalie par mot fautif', () => {
    const report = auditSiteFacts(
      named([['n-1', 'fr', 'Parking payant, paiement à la caisse de parking']]),
      [PARKING_GRATUIT],
    );
    expect(report.findings.map((f) => f.params['term']))
      .toEqual(['payant', 'paiement', 'caisse de parking']);
  });

  it('sans fait déclaré, ne juge rien', () => {
    const report = auditSiteFacts(named([['n-1', 'fr', 'Paiement du parking']]), []);
    expect(report.findings).toEqual([]);
    expect(report.checked_facts).toBe(0);
  });

  it('parcourt les faits par clé, pour un ordre stable entre deux exécutions', () => {
    const autre: SiteFact = {
      key: 'acces_barriere',
      value: 'aucune barrière',
      source: 'Relevé du 3 avril 2026',
      recorded_on: '2026-04-03',
      forbidden: [{ lang: 'fr', term: 'barrière' }],
    };
    const site = named([['n-1', 'fr', 'Barrière et paiement']]);
    const report = auditSiteFacts(site, [PARKING_GRATUIT, autre]);
    expect(report.findings.map((f) => f.params['fact']))
      .toEqual(['acces_barriere', 'parking_gratuit']);
    expect(JSON.stringify(auditSiteFacts(site, [autre, PARKING_GRATUIT])))
      .toBe(JSON.stringify(report));
  });
});
