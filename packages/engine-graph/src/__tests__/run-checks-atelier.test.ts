/**
 * Contrôles issus du complément atelier : vocabulaire, stationnement, mode.
 *
 * Séparés des essais du socle parce que les deux réunis franchissaient les
 * quatre cents lignes (A2.4). La coupure suit la matière : d'un côté ce que
 * `runChecks` contrôlait déjà, de l'autre ce que le complément lui a ajouté.
 */
import { describe, it, expect } from 'vitest';
import { runChecks } from '../run-checks.js';
import { refMinimal, refMultilevel } from '@azimut/testkit';

describe('vocabulaire du site : exercé, ou déclaré non exercé', () => {
  const terms = [{ lang: 'fr', term: 'client', severity: 'forbidden' as const }];
  const facts = [{
    key: 'parking_gratuit',
    value: 'oui',
    source: 'Direction',
    recorded_on: '2026-03-12',
    forbidden: [{ lang: 'fr', term: 'paiement' }],
  }];
  const claims = [
    { key: 'niveaux', source: 'Charte', value: '3', recorded_on: '2026-01-10' },
    { key: 'niveaux', source: 'Plans', value: '2', recorded_on: '2026-05-04' },
  ];

  it('range les trois contrôles en non exercés quand le site ne déclare rien', () => {
    const r = runChecks(refMinimal);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.checks_undeclared).toEqual([
      'charter_lexicon',
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
    const r = runChecks(site, { lexicon: terms, facts, claims });
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
    const r = runChecks(refMultilevel);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.checks_run).toContain('parking_coverage');
    expect(r.value.findings.filter(f => f.code.startsWith('PARK.'))).toEqual([]);
  });

  it('remonte l’écart de capacité dans le rapport commun', () => {
    const ampute = {
      ...refMultilevel,
      parking_spaces: refMultilevel.parking_spaces.slice(0, 2),
    };
    const r = runChecks(ampute);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const park = r.value.findings.find(f => f.code === 'PARK.CAPACITY_UNEXPLAINED');
    expect(park?.params['missing']).toBe(2);
  });
});

describe('mode de contrôle : atelier ou livrable', () => {
  const site = {
    ...refMultilevel,
    parking_spaces: refMultilevel.parking_spaces.map((s, i) =>
      i === 0
        ? { ...s, provenance: { status: 'proposition' as const, source: 'Détection' } }
        : s,
    ),
  };

  it('tolère une proposition à l’atelier', () => {
    const r = runChecks(site);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.findings.map(f => f.code)).not.toContain('PARK.PROPOSAL_AS_EXISTING');
    // Le contrôle de P1 (complément atelier) n'a pas tourné : il ne figure donc pas aux exercés.
    expect(r.value.checks_run).not.toContain('parking_publication');
  });

  it('refuse la même proposition au livrable (P1, complément atelier)', () => {
    const r = runChecks(site, {}, { mode: 'livrable' });
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
