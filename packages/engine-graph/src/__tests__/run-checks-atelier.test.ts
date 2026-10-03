/**
 * Contrôles des registres déclarés : vocabulaire de charte (A5.8), faits du
 * site et stationnement (A5.11), et le mode de rendu qui les durcit.
 *
 * Séparés des essais du socle parce que les deux réunis franchissaient les
 * quatre cents lignes (A2.4). La coupure suit la matière : d'un côté ce que
 * `runChecks` contrôle sans qu'un site déclare rien, de l'autre ce qui
 * n'existe que si le site l'oppose.
 */
import { describe, it, expect } from 'vitest';
import { runChecks } from '../run-checks.js';
import { refMinimal, refMultilevel } from '@azimut/testkit';
import type { CharterRule, SiteFact } from '@azimut/core-model';
import { PARKING_CAPACITY_KEY } from '@azimut/core-model';

/**
 * La capacité annoncée du parking de `refMultilevel` — A5.11, S-36.
 *
 * Un fait du site, donc porté par le vocabulaire et non par `SiteData` : c'est
 * l'appelant de `runChecks` qui le fournit. Quatre places, quatre annoncées.
 */
function capacite(value: number): SiteFact {
  return {
    key: PARKING_CAPACITY_KEY,
    value,
    status: 'existing',
    source_ref: 'Plan RDC indice 20',
    declared_at: '2026-01-05',
    target: { kind: 'zone', id: 'zone-ml-parking-ouest' },
    forbidden: [],
  };
}

describe('vocabulaire du site : exercé, ou déclaré non exercé', () => {
  const terms = [{ lang: 'fr', term: 'client', severity: 'forbidden' as const }];
  const facts = [{
    key: 'parking_gratuit',
    value: true,
    status: 'existing' as const,
    source_ref: 'Direction',
    declared_at: '2026-03-12',
    forbidden: [{ lang: 'fr', term: 'paiement' }],
  }];
  const claims = [
    { key: 'niveaux', source: 'Charte', value: '3', recorded_on: '2026-01-10' },
    { key: 'niveaux', source: 'Plans', value: '2', recorded_on: '2026-05-04' },
  ];
  // A5.8 — les deux règles de rédaction, portées par la charte du site.
  const charterRules: readonly CharterRule[] = [
    {
      id: 'cr-ref-caracteres',
      kind: 'forbidden_character',
      params: { characters: [{ from: 0x2014, to: 0x2014, name: 'tiret cadratin' }] },
    },
    { id: 'cr-ref-phrases', kind: 'max_sentence_words', params: { maximum: 25 } },
  ];

  it('range les cinq contrôles en non exercés quand le site ne déclare rien', () => {
    const r = runChecks(refMinimal);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Les deux contrôles de rédaction ont rejoint la liste : A5.8 range leurs
    // limites parmi les règles de charte, et un site sans charte n'a rien à
    // leur opposer.
    expect(r.value.checks_undeclared).toEqual([
      'charter_lexicon',
      'forbidden_characters',
      'sentence_length',
      'site_facts',
      'source_discrepancies',
    ]);
    // Non exercé n'est pas ignoré : la cause et le remède diffèrent.
    expect(r.value.checks_skipped).not.toContain('charter_lexicon');
  });

  it('exerce le contrôle du lexique dès qu’un terme est déclaré', () => {
    const r = runChecks(refMinimal, { lexicon: terms });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.checks_run).toContain('charter_lexicon');
    expect(r.value.checks_undeclared).not.toContain('charter_lexicon');
  });

  it('remonte les anomalies des trois audits dans le rapport commun', () => {
    const site = {
      ...refMinimal,
      destination_names: [{
        id: 'n-1',
        org_id: 'org-test-001',
        destination_id: 'd-1',
        lang: 'fr' as const,
        value: 'Paiement et service client',
      }],
    };
    const r = runChecks(site, { charter_rules: charterRules, lexicon: terms, facts, claims });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const codes = r.value.findings.map((f) => f.code);
    expect(codes).toContain('LAYOUT.LEXICON_FORBIDDEN_TERM');
    expect(codes).toContain('LAYOUT.FACT_CONTRADICTED');
    expect(codes).toContain('LAYOUT.SOURCE_DISCREPANCY_OPEN');
    expect(r.value.checks_undeclared).toEqual([]);
  });

  it('garde un ordre stable des contrôles exercés', () => {
    const r = runChecks(refMinimal, { lexicon: terms });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect([...r.value.checks_run]).toEqual([...r.value.checks_run].sort((a, b) => a.localeCompare(b)));
  });
});

describe('stationnement : contrôlé quand il y en a, silencieux quand il n’y en a pas', () => {
  it('n’annonce pas le contrôle sur un site sans parking', () => {
    const r = runChecks(refMinimal);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Un site sans parking n'est pas un contrôle non exercé : il n'y a rien à
    // contrôler. Le ranger en `checks_undeclared` inviterait à saisir un
    // parking qui n'existe pas.
    expect(r.value.checks_run).not.toContain('parking_coverage');
    expect(r.value.checks_undeclared).not.toContain('parking_coverage');
  });

  it('exerce le contrôle sur le site qui en porte un', () => {
    const r = runChecks(refMultilevel, { facts: [capacite(4)] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.checks_run).toContain('parking_coverage');
    expect(r.value.findings.filter(f => f.code.startsWith('PARK.'))).toEqual([]);
  });

  it('l’exerce même sans capacité annoncée, et ne trouve alors rien à dire', () => {
    // Le contrôle porte sur les zones, pas sur les faits : il tourne dès qu'un
    // parking est déclaré. Sans capacité annoncée, il n'a simplement rien à
    // comparer — c'est un contrôle exercé et muet, pas un contrôle absent.
    const r = runChecks(refMultilevel);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.checks_run).toContain('parking_coverage');
    expect(r.value.findings.filter(f => f.code.startsWith('PARK.'))).toEqual([]);
  });

  it('remonte l’écart de capacité dans le rapport commun', () => {
    const r = runChecks(refMultilevel, { facts: [capacite(6)] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const park = r.value.findings.find(f => f.code === 'PARK.CAPACITY_UNEXPLAINED');
    expect(park?.params['missing']).toBe(2);
  });
});

describe('mode de contrôle : atelier ou livrable', () => {
  // A5.11 — le statut porte sur le fait, non sur l'objet : `zone` et
  // `footprint` n'en déclarent aucun. Une capacité annoncée mais non arrêtée
  // est une proposition, et c'est elle qu'un livrable ne peut pas montrer.
  const site = refMultilevel;
  const proposee: SiteFact = { ...capacite(4), status: 'proposal' };

  it('tolère une proposition à l’atelier', () => {
    const r = runChecks(site, { facts: [proposee] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.findings.map(f => f.code)).not.toContain('PARK.PROPOSAL_AS_EXISTING');
    // Le contrôle de publication n'a pas tourné : il ne figure donc pas aux exercés.
    expect(r.value.checks_run).not.toContain('parking_publication');
  });

  it('refuse la même proposition au livrable (règle M01.S11)', () => {
    const r = runChecks(site, { facts: [proposee] }, { mode: 'livrable' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.findings.map(f => f.code)).toContain('PARK.PROPOSAL_AS_EXISTING');
    expect(r.value.checks_run).toContain('parking_publication');
  });

  it('un site entièrement existant passe dans les deux modes', () => {
    const atelier = runChecks(refMultilevel);
    const livrable = runChecks(refMultilevel, {}, { mode: 'livrable' });
    expect(atelier.ok && livrable.ok).toBe(true);
    if (!atelier.ok || !livrable.ok) return;
    expect(livrable.value.findings.filter(f => f.code.startsWith('PARK.'))).toEqual([]);
  });
});
