import { describe, it, expect } from 'vitest';
import { refMinimal } from '@azimut/testkit';
import type { DestinationName, SiteData, SiteFact } from '@azimut/core-model';
import { auditSiteFacts } from '../audit-site-facts.js';

/** Le fait de référence : le parking du site d'essai est gratuit. */
const PARKING_GRATUIT: SiteFact = {
  key: 'parking_gratuit',
  value: true,
  status: 'existing',
  source_ref: 'Décision de la Direction, 12 mars 2026',
  declared_at: '2026-03-12',
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

describe('auditSiteFacts — A5.11, un texte contre les faits du site', () => {
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
    // La valeur est un booléen JSON depuis qu'A5.11 porte `value` en `jsonb` ;
    // l'anomalie la rend en texte, `params` n'admettant que chaîne et nombre.
    expect(finding?.params['fact_value']).toBe('true');
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
      status: 'existing',
      source_ref: 'Relevé du 3 avril 2026',
      declared_at: '2026-04-03',
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

/**
 * A5.11 — « Tout fait du site porte sa source et son statut. Un fait de statut
 * `proposal` ne s'affiche jamais comme un existant. »
 *
 * Les deux codes viennent du catalogue et changent de porteur : D2.2 les
 * définit au niveau du fait, `PARK.SOURCE_MISSING` en toutes lettres, et ils se
 * levaient sur les objets de stationnement faute d'une colonne pour porter le
 * statut d'un fait. La migration 0053 l'a ajoutée.
 */
describe('A5.11 — le statut et la source d’un fait', () => {
  const sansSource: SiteFact = {
    key: 'capacite_annoncee',
    value: 89,
    status: 'existing',
    source_ref: '   ',
    declared_at: '2026-03-12',
    forbidden: [],
  };
  const proposition: SiteFact = {
    key: 'surface_commercialisable',
    value: 12400,
    status: 'proposal',
    source_ref: 'Étude de programmation',
    declared_at: '2026-04-01',
    forbidden: [],
  };
  const aVerifier: SiteFact = { ...proposition, key: 'places_livraison', status: 'to_verify' };
  const site = named([['n-1', 'fr', 'Parking visiteurs']]);

  it('refuse un fait sans source, dans les deux modes', () => {
    for (const forDeliverable of [false, true]) {
      const report = auditSiteFacts(site, [sansSource], forDeliverable);
      const finding = report.findings.find((f) => f.code === 'PARK.SOURCE_MISSING');
      expect(finding?.severity).toBe('blocking');
      expect(finding?.entity).toEqual({ kind: 'site_fact', id: 'capacite_annoncee' });
      expect(finding?.params['status']).toBe('existing');
      expect(finding?.ruleRef).toBe('M01.S11');
    }
  });

  it('tolère une proposition à l’atelier : c’est un état de travail', () => {
    const report = auditSiteFacts(site, [proposition, aVerifier]);
    expect(report.findings).toEqual([]);
  });

  it('refuse la même proposition portée à un livrable', () => {
    const report = auditSiteFacts(site, [proposition], true);
    const [finding] = report.findings;
    expect(finding?.code).toBe('PARK.PROPOSAL_AS_EXISTING');
    expect(finding?.severity).toBe('blocking');
    expect(finding?.entity).toEqual({ kind: 'site_fact', id: 'surface_commercialisable' });
    expect(finding?.params['status']).toBe('proposal');
    expect(finding?.ruleRef).toBe('M01.S11');
  });

  /**
   * `to_verify` tombe du même côté que `proposal`, et pour une raison plus
   * forte : une valeur qu'on n'a pas pu confirmer, affichée sans réserve, se
   * lit comme une valeur confirmée.
   */
  it('refuse aussi un fait à vérifier porté à un livrable', () => {
    const codes = auditSiteFacts(site, [aVerifier], true).findings.map((f) => f.code);
    expect(codes).toEqual(['PARK.PROPOSAL_AS_EXISTING']);
  });

  it('laisse passer un existant sourcé, au livrable comme à l’atelier', () => {
    const acquis: SiteFact = { ...proposition, status: 'existing' };
    expect(auditSiteFacts(site, [acquis], true).findings).toEqual([]);
  });

  it('rend un ordre stable : par clé, quel que soit l’ordre reçu', () => {
    const facts = [proposition, sansSource, aVerifier];
    const report = auditSiteFacts(site, facts, true);
    // `capacite_annoncee` est un existant sans source : une anomalie, non deux.
    expect(report.findings.map((f) => f.params['fact'])).toEqual([
      'capacite_annoncee', 'places_livraison', 'surface_commercialisable',
    ]);
    expect(JSON.stringify(auditSiteFacts(site, [...facts].reverse(), true)))
      .toBe(JSON.stringify(report));
  });
});
