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

  describe('CHECK.DUPLICATE_DISPLAY_NAME', () => {
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
        (f) => f.code === 'CHECK.DUPLICATE_DISPLAY_NAME',
      );
      expect(dups.length).toBeGreaterThanOrEqual(2);
    });

    it('ignores same name on same destination', () => {
      const result = runChecks(refMinimal);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const dups = result.value.findings.filter(
        (f) => f.code === 'CHECK.DUPLICATE_DISPLAY_NAME',
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
        (f) => f.code === 'CHECK.DUPLICATE_DISPLAY_NAME',
      );
      expect(dups.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('CHECK.INCOMPLETE_LANG_COVERAGE', () => {
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
        (f) => f.code === 'CHECK.INCOMPLETE_LANG_COVERAGE',
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
        (f) => f.code === 'CHECK.INCOMPLETE_LANG_COVERAGE',
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
        (f) => f.code === 'CHECK.INCOMPLETE_LANG_COVERAGE',
      );
      expect(missing.length).toBe(0);
    });
  });

  describe('CHECK.ALL_VACANT_CATEGORY', () => {
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
        (f) => f.code === 'CHECK.ALL_VACANT_CATEGORY',
      );
      expect(vacant.length).toBeGreaterThan(0);
    });

    it('no finding when category has occupied destinations', () => {
      const result = runChecks(refMinimal);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const vacant = result.value.findings.filter(
        (f) => f.code === 'CHECK.ALL_VACANT_CATEGORY',
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
});
