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
  });
});
