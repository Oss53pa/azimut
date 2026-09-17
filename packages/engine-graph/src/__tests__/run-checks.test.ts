import { describe, it, expect } from 'vitest';
import { runChecks } from '../run-checks.js';
import { refMinimal, refMultilevel } from '@azimut/testkit';
import type { SiteData } from '@azimut/core-model';

describe('T-2.5 runChecks', () => {
  it('returns clean report for well-formed site', () => {
    const result = runChecks(refMinimal);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.checks_run.length).toBeGreaterThan(0);
    expect(result.value.checks_skipped).toContain('contraste');
    expect(result.value.checks_skipped).toContain('lisibilite');
    expect(result.value.checks_skipped).toContain('adjacence_chromatique');
  });

  describe('GRAPH.DESTINATION_NAME_DUPLICATE', () => {
    it('detects same name for different destinations', () => {
      const site: SiteData = {
        ...refMinimal,
        destination_names: [
          ...refMinimal.destination_names,
          {
            id: 'dn-dup-fr',
            org_id: 'org-test-001',
            destination_id: 'dest-b',
            lang: 'fr',
            value: 'Bureau A',
          },
        ],
      };
      const result = runChecks(site);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const dups = result.value.findings.filter(
        (f) => f.code === 'GRAPH.DESTINATION_NAME_DUPLICATE',
      );
      expect(dups.length).toBeGreaterThanOrEqual(2);
    });

    it('ignores same name on same destination', () => {
      const result = runChecks(refMinimal);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const dups = result.value.findings.filter(
        (f) => f.code === 'GRAPH.DESTINATION_NAME_DUPLICATE',
      );
      expect(dups.length).toBe(0);
    });

    it('is case-insensitive', () => {
      const site: SiteData = {
        ...refMinimal,
        destination_names: [
          ...refMinimal.destination_names,
          {
            id: 'dn-case-fr',
            org_id: 'org-test-001',
            destination_id: 'dest-b',
            lang: 'fr',
            value: 'bureau a',
          },
        ],
      };
      const result = runChecks(site);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const dups = result.value.findings.filter(
        (f) => f.code === 'GRAPH.DESTINATION_NAME_DUPLICATE',
      );
      expect(dups.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GRAPH.DESTINATION_LANG_INCOMPLETE', () => {
    it('detects destination missing a language', () => {
      const site: SiteData = {
        ...refMinimal,
        destination_names: refMinimal.destination_names.filter(
          (dn) => dn.id !== 'dn-d-en',
        ),
      };
      const result = runChecks(site);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const missing = result.value.findings.filter(
        (f) => f.code === 'GRAPH.DESTINATION_LANG_INCOMPLETE',
      );
      expect(missing.length).toBe(1);
      expect(missing[0]?.entity).toStrictEqual({
        kind: 'destination',
        id: 'dest-d',
      });
    });

    it('no finding when all destinations have all languages', () => {
      const result = runChecks(refMinimal);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const missing = result.value.findings.filter(
        (f) => f.code === 'GRAPH.DESTINATION_LANG_INCOMPLETE',
      );
      expect(missing.length).toBe(0);
    });

    it('skips check when only one language exists', () => {
      const site: SiteData = {
        ...refMinimal,
        destination_names: refMinimal.destination_names.filter(
          (dn) => dn.lang === 'fr',
        ),
      };
      const result = runChecks(site);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const missing = result.value.findings.filter(
        (f) => f.code === 'GRAPH.DESTINATION_LANG_INCOMPLETE',
      );
      expect(missing.length).toBe(0);
    });
  });

  describe('GRAPH.CATEGORY_ALL_VACANT', () => {
    it('detects category where all destinations are vacant', () => {
      const site: SiteData = {
        ...refMinimal,
        destinations: refMinimal.destinations.map((d) => ({
          ...d,
          occupancy_status: 'vacant' as const,
        })),
      };
      const result = runChecks(site);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const vacant = result.value.findings.filter(
        (f) => f.code === 'GRAPH.CATEGORY_ALL_VACANT',
      );
      expect(vacant.length).toBeGreaterThan(0);
    });

    it('no finding when category has occupied destinations', () => {
      const result = runChecks(refMinimal);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const vacant = result.value.findings.filter(
        (f) => f.code === 'GRAPH.CATEGORY_ALL_VACANT',
      );
      expect(vacant.length).toBe(0);
    });
  });

  describe('determinism (INV-4)', () => {
    it('same result on two calls', () => {
      const r1 = runChecks(refMultilevel);
      const r2 = runChecks(refMultilevel);
      expect(r1).toStrictEqual(r2);
    });
  });

  describe('GRAPH.DESTINATION_NAME_DUPLICATE — whitespace normalization', () => {
    it('trims whitespace before comparing names', () => {
      const site: SiteData = {
        ...refMinimal,
        destination_names: [
          ...refMinimal.destination_names,
          {
            id: 'dn-ws-fr',
            org_id: 'org-test-001',
            destination_id: 'dest-b',
            lang: 'fr',
            value: '  Bureau A  ',
          },
        ],
      };
      const result = runChecks(site);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const dups = result.value.findings.filter(
        (f) => f.code === 'GRAPH.DESTINATION_NAME_DUPLICATE',
      );
      expect(dups.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GRAPH.DESTINATION_LANG_INCOMPLETE — dest with zero names', () => {
    it('skips dest with no names at all when other dests have names', () => {
      // Destination with no names → not in langsByDest → continue path
      const site: SiteData = {
        ...refMinimal,
        destination_names: refMinimal.destination_names.filter(
          (dn) => dn.destination_id !== 'dest-a',
        ),
      };
      const result = runChecks(site);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // dest-a has no names at all → skipped by !destLangs continue
      const missing = result.value.findings.filter(
        (f) =>
          f.code === 'GRAPH.DESTINATION_LANG_INCOMPLETE'
          && f.entity?.id === 'dest-a',
      );
      expect(missing.length).toBe(0);
    });
  });

  describe('empty inputs', () => {
    it('returns clean report with no destinations/names', () => {
      const site: SiteData = {
        ...refMinimal,
        destinations: [],
        destination_names: [],
      };
      const result = runChecks(site);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.findings.length).toBe(0);
    });
  });

  describe('GRAPH.CATEGORY_ALL_VACANT — mixed categories', () => {
    it('flags only the all-vacant category, not the mixed one', () => {
      const d0 = refMinimal.destinations[0];
      const d1 = refMinimal.destinations[1];
      const d2 = refMinimal.destinations[2];
      if (!d0 || !d1 || !d2) throw new Error('need 3 destinations');
      const site: SiteData = {
        ...refMinimal,
        destinations: [
          // cat-a: all vacant
          { ...d0, occupancy_status: 'vacant' as const, category_id: 'cat-a' },
          // cat-b: one occupied
          { ...d1, occupancy_status: 'occupied' as const, category_id: 'cat-b' },
          { ...d2, occupancy_status: 'vacant' as const, category_id: 'cat-b' },
        ],
      };
      const result = runChecks(site);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const vacant = result.value.findings.filter(
        (f) => f.code === 'GRAPH.CATEGORY_ALL_VACANT',
      );
      expect(vacant.length).toBe(1);
      expect(vacant[0]?.entity?.id).toBe('cat-a');
    });

    it('single-destination vacant category reports count 1', () => {
      const d0 = refMinimal.destinations[0];
      const d1 = refMinimal.destinations[1];
      if (!d0 || !d1) return;
      const site: SiteData = {
        ...refMinimal,
        destinations: [
          { ...d0, occupancy_status: 'vacant' as const, category_id: 'cat-lonely' },
          { ...d1, occupancy_status: 'occupied' as const, category_id: 'cat-ok' },
        ],
      };
      const result = runChecks(site);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const vacant = result.value.findings.filter(
        (f) => f.code === 'GRAPH.CATEGORY_ALL_VACANT',
      );
      expect(vacant.length).toBe(1);
      expect(vacant[0]?.entity?.id).toBe('cat-lonely');
      expect(vacant[0]?.params?.['count']).toBe(1);
    });
  });

  describe('GRAPH.DESTINATION_NAME_DUPLICATE — same dest dedup', () => {
    it('ignores duplicate name rows for the same destination', () => {
      const site: SiteData = {
        ...refMinimal,
        destination_names: [
          ...refMinimal.destination_names,
          {
            id: 'dn-a-fr-dup',
            org_id: 'org-test-001',
            destination_id: 'dest-a',
            lang: 'fr',
            value: 'Bureau A',
          },
        ],
      };
      const result = runChecks(site);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const dups = result.value.findings.filter(
        (f) => f.code === 'GRAPH.DESTINATION_NAME_DUPLICATE',
      );
      expect(dups.length).toBe(0);
    });
  });

  describe('WAYFIND.NAMING_COLLISION (H2.2)', () => {
    const orgId = refMinimal.organization.id;

    const level = (id: string, buildingId: string, name: string) => ({
      id,
      org_id: orgId,
      building_id: buildingId,
      name,
      ordinal: 1,
      elevation_m: 0,
    });

    const building = (id: string, name: string) => ({
      id,
      org_id: orgId,
      site_id: refMinimal.site.id,
      name,
      independent_access: false,
    });

    it('reports none for a well-formed site', () => {
      const result = runChecks(refMinimal);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(
        result.value.findings.filter((f) => f.code === 'WAYFIND.NAMING_COLLISION'),
      ).toEqual([]);
      expect(result.value.checks_run).toContain('naming_collision');
    });

    it('flags two levels sharing a name within one building', () => {
      const site: SiteData = {
        ...refMinimal,
        levels: [
          ...refMinimal.levels,
          level('lvl-dup', 'bldg-001', 'Rez-de-chaussée'),
        ],
      };
      const result = runChecks(site);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const collisions = result.value.findings.filter(
        (f) => f.code === 'WAYFIND.NAMING_COLLISION',
      );
      expect(collisions.length).toBe(2);
    });

    it('does not flag the same level name across different buildings', () => {
      const site: SiteData = {
        ...refMinimal,
        buildings: [...refMinimal.buildings, building('bldg-002', 'Annexe')],
        levels: [
          ...refMinimal.levels,
          level('lvl-002', 'bldg-002', 'Rez-de-chaussée'),
        ],
      };
      const result = runChecks(site);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(
        result.value.findings.filter((f) => f.code === 'WAYFIND.NAMING_COLLISION'),
      ).toEqual([]);
    });

    it('flags two buildings sharing a name', () => {
      const site: SiteData = {
        ...refMinimal,
        buildings: [
          ...refMinimal.buildings,
          building('bldg-002', 'Bâtiment principal'),
        ],
      };
      const result = runChecks(site);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const collisions = result.value.findings.filter(
        (f) => f.code === 'WAYFIND.NAMING_COLLISION',
      );
      expect(collisions.length).toBe(2);
      expect(collisions.every((f) => f.entity?.kind === 'building')).toBe(true);
    });
  });
});

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
