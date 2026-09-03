import { describe, it, expect } from 'vitest';
import { validateDirectory } from '../validate-directory.js';
import { refMinimal, refMultilevel } from '@azimut/testkit';
import type { SiteData } from '@azimut/core-model';

function patchSite(
  base: SiteData,
  patch: Partial<SiteData>,
): SiteData {
  return { ...base, ...patch };
}

describe('T-1.7 validateDirectory', () => {
  it('passes on valid refMinimal', () => {
    const result = validateDirectory(refMinimal);
    expect(result.ok).toBe(true);
  });

  it('passes on valid refMultilevel', () => {
    const result = validateDirectory(refMultilevel);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total_destinations).toBe(2);
    expect(result.value.total_names).toBe(4);
    expect(result.value.active_langs).toEqual(['en', 'fr']);
  });

  describe('GRAPH.DESTINATION_UNLINKED', () => {
    it('flags destination referencing non-existent node', () => {
      const site = patchSite(refMultilevel, {
        destinations: [
          {
            id: 'dest-bad',
            org_id: 'org-test-001',
            footprint_id: 'fp-ml-rdc',
            node_id: 'n-does-not-exist',
            category_id: 'cat-office',
            occupant_name: 'Ghost',
            occupancy_status: 'occupied',
            display_priority: 1,
          },
        ],
      });
      const result = validateDirectory(site);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      const f = result.findings.find(
        (f) => f.code === 'GRAPH.DESTINATION_UNLINKED',
      );
      expect(f).toBeDefined();
      expect(f?.entity?.id).toBe('dest-bad');
    });
  });

  describe('GRAPH.DESTINATION_FOOTPRINT_NOT_FOUND', () => {
    it('flags destination referencing non-existent footprint', () => {
      const site = patchSite(refMultilevel, {
        destinations: [
          {
            id: 'dest-bad-fp',
            org_id: 'org-test-001',
            footprint_id: 'fp-nonexistent',
            node_id: 'n-ml-dest-rdc',
            category_id: 'cat-office',
            occupant_name: 'Office',
            occupancy_status: 'occupied',
            display_priority: 1,
          },
        ],
      });
      const result = validateDirectory(site);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      const f = result.findings.find(
        (f) => f.code === 'GRAPH.DESTINATION_FOOTPRINT_NOT_FOUND',
      );
      expect(f).toBeDefined();
    });
  });

  describe('GRAPH.DESTINATION_NODE_WRONG_KIND', () => {
    it('warns when destination node is not destination_access', () => {
      const site = patchSite(refMultilevel, {
        destinations: [
          {
            id: 'dest-wrong-kind',
            org_id: 'org-test-001',
            footprint_id: 'fp-ml-rdc',
            node_id: 'n-ml-hall',
            category_id: 'cat-office',
            occupant_name: 'In the hall',
            occupancy_status: 'occupied',
            display_priority: 1,
          },
        ],
      });
      const result = validateDirectory(site);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const w = result.warnings.find(
        (f) => f.code === 'GRAPH.DESTINATION_NODE_WRONG_KIND',
      );
      expect(w).toBeDefined();
      expect(w?.params?.actual_kind).toBe('junction');
    });
  });

  describe('GRAPH.DESTINATION_DUPLICATE_ON_NODE', () => {
    it('warns when two destinations share the same node', () => {
      const site = patchSite(refMultilevel, {
        destinations: [
          ...refMultilevel.destinations,
          {
            id: 'dest-dup',
            org_id: 'org-test-001',
            footprint_id: 'fp-ml-rdc',
            node_id: 'n-ml-dest-rdc',
            category_id: 'cat-office',
            occupant_name: 'Duplicate',
            occupancy_status: 'occupied',
            display_priority: 2,
          },
        ],
      });
      const result = validateDirectory(site);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const dupes = result.warnings.filter(
        (f) => f.code === 'GRAPH.DESTINATION_DUPLICATE_ON_NODE',
      );
      expect(dupes.length).toBe(2);
    });
  });

  describe('GRAPH.DIRECTORY_NAME_MISSING', () => {
    it('warns when a destination lacks a name in an active lang', () => {
      const site = patchSite(refMultilevel, {
        destination_names: refMultilevel.destination_names.filter(
          (dn) =>
            !(
              dn.destination_id === 'dest-ml-r1' && dn.lang === 'en'
            ),
        ),
      });
      const result = validateDirectory(site);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const missing = result.warnings.find(
        (f) =>
          f.code === 'GRAPH.DIRECTORY_NAME_MISSING' &&
          f.entity?.id === 'dest-ml-r1',
      );
      expect(missing).toBeDefined();
      expect(missing?.params?.lang).toBe('en');
    });
  });

  describe('GRAPH.DIRECTORY_NAME_EMPTY', () => {
    it('blocks when a destination name has empty value', () => {
      const site = patchSite(refMultilevel, {
        destination_names: [
          ...refMultilevel.destination_names,
          {
            id: 'dn-empty',
            org_id: 'org-test-001',
            destination_id: 'dest-ml-rdc',
            lang: 'fr' as const,
            value: '   ',
          },
        ],
      });
      const result = validateDirectory(site);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      const f = result.findings.find(
        (f) => f.code === 'GRAPH.DIRECTORY_NAME_EMPTY',
      );
      expect(f).toBeDefined();
    });
  });

  describe('GRAPH.DIRECTORY_NAME_ORPHAN', () => {
    it('warns when a name references non-existent destination', () => {
      const site = patchSite(refMultilevel, {
        destination_names: [
          ...refMultilevel.destination_names,
          {
            id: 'dn-orphan',
            org_id: 'org-test-001',
            destination_id: 'dest-nonexistent',
            lang: 'fr' as const,
            value: 'Fantôme',
          },
        ],
      });
      const result = validateDirectory(site);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const w = result.warnings.find(
        (f) => f.code === 'GRAPH.DIRECTORY_NAME_ORPHAN',
      );
      expect(w).toBeDefined();
    });
  });

  describe('empty destinations', () => {
    it('accepts site with zero destinations', () => {
      const site = patchSite(refMinimal, {
        destinations: [],
        destination_names: [],
      });
      const result = validateDirectory(site);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.total_destinations).toBe(0);
      expect(result.value.total_names).toBe(0);
      expect(result.value.active_langs).toEqual([]);
    });

    it('skips missing-name check when no names exist', () => {
      const site = patchSite(refMultilevel, {
        destination_names: [],
      });
      const result = validateDirectory(site);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.total_names).toBe(0);
      expect(result.value.active_langs).toEqual([]);
      expect(
        result.warnings.some(
          (f) => f.code === 'GRAPH.DIRECTORY_NAME_MISSING',
        ),
      ).toBe(false);
    });
  });

  describe('blocking and warning coexistence', () => {
    it('includes warnings alongside blockings in findings', () => {
      // One destination has a missing node (blocking), another points
      // to a junction node (warning).
      const site = patchSite(refMultilevel, {
        destinations: [
          ...refMultilevel.destinations,
          {
            id: 'dest-missing-node',
            org_id: 'org-test-001',
            footprint_id: 'fp-ml-rdc',
            node_id: 'n-nonexistent',
            category_id: 'cat-office',
            occupant_name: 'Ghost',
            occupancy_status: 'occupied',
            display_priority: 9,
          },
          {
            id: 'dest-wrong-kind',
            org_id: 'org-test-001',
            footprint_id: 'fp-ml-rdc',
            node_id: 'n-ml-hall',
            category_id: 'cat-office',
            occupant_name: 'Wrong',
            occupancy_status: 'occupied',
            display_priority: 10,
          },
        ],
      });
      const result = validateDirectory(site);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      const blocking = result.findings.filter((f) => f.severity === 'blocking');
      const warning = result.findings.filter((f) => f.severity === 'warning');
      expect(blocking.length).toBeGreaterThanOrEqual(1);
      expect(warning.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('determinism (INV-4)', () => {
    it('same result on two calls', () => {
      const r1 = validateDirectory(refMultilevel);
      const r2 = validateDirectory(refMultilevel);
      expect(r1).toStrictEqual(r2);
    });
  });
});
