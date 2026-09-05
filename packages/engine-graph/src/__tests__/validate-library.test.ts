import { describe, it, expect } from 'vitest';
import {
  validateLibrary,
  guardSafetyRegistry,
  guardSafetyDeletion,
} from '../validate-library.js';
import { refMinimal, refMultilevel } from '@azimut/testkit';
import type { SiteData } from '@azimut/core-model';

function patchSite(
  base: SiteData,
  patch: Partial<SiteData>,
): SiteData {
  return { ...base, ...patch };
}

describe('T-1.8 validateLibrary', () => {
  it('passes on valid refMinimal', () => {
    const result = validateLibrary(refMinimal);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total_categories).toBe(2);
    expect(result.value.total_pictograms).toBe(2);
    expect(result.value.safety_pictograms).toBe(1);
    expect(result.value.wayfinding_pictograms).toBe(1);
  });

  it('passes on valid refMultilevel', () => {
    const result = validateLibrary(refMultilevel);
    expect(result.ok).toBe(true);
  });

  describe('DATA.CATEGORY_PARENT_NOT_FOUND', () => {
    it('flags category with non-existent parent', () => {
      const site = patchSite(refMinimal, {
        categories: [
          ...refMinimal.categories,
          {
            id: 'cat-orphan',
            org_id: 'org-test-001',
            sector_key: 'tertiary',
            code: 'orphan',
            parent_id: 'cat-nonexistent',
          },
        ],
      });
      const result = validateLibrary(site);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      const f = result.findings.find(
        (f) => f.code === 'DATA.CATEGORY_PARENT_NOT_FOUND',
      );
      expect(f).toBeDefined();
    });
  });

  describe('DATA.CATEGORY_CYCLE', () => {
    it('flags circular parent references', () => {
      const site = patchSite(refMinimal, {
        categories: [
          {
            id: 'cat-a',
            org_id: 'org-test-001',
            sector_key: 'tertiary',
            code: 'a',
            parent_id: 'cat-b',
          },
          {
            id: 'cat-b',
            org_id: 'org-test-001',
            sector_key: 'tertiary',
            code: 'b',
            parent_id: 'cat-a',
          },
        ],
      });
      const result = validateLibrary(site);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      const cycles = result.findings.filter(
        (f) => f.code === 'DATA.CATEGORY_CYCLE',
      );
      expect(cycles.length).toBeGreaterThan(0);
    });
  });

  describe('DATA.PICTOGRAM_CATEGORY_NOT_FOUND', () => {
    it('flags pictogram referencing non-existent category', () => {
      const site = patchSite(refMinimal, {
        pictograms: [
          {
            id: 'picto-bad',
            org_id: 'org-test-001',
            category_id: 'cat-nonexistent',
            source: 'test',
            standard_ref: 'ISO-7001',
            svg_path: 'M0 0',
            registry: 'wayfinding',
          },
        ],
      });
      const result = validateLibrary(site);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      const f = result.findings.find(
        (f) => f.code === 'DATA.PICTOGRAM_CATEGORY_NOT_FOUND',
      );
      expect(f).toBeDefined();
    });
  });

  describe('DATA.DEST_CATEGORY_NOT_FOUND', () => {
    it('warns when destination references non-existent category', () => {
      const site = patchSite(refMinimal, {
        categories: [],
      });
      const result = validateLibrary(site);
      if (result.ok) {
        const w = result.warnings.find(
          (f) => f.code === 'DATA.DEST_CATEGORY_NOT_FOUND',
        );
        expect(w).toBeDefined();
      } else {
        const f = result.findings.find(
          (f) => f.code === 'DATA.DEST_CATEGORY_NOT_FOUND',
        );
        expect(f).toBeDefined();
      }
    });
  });

  describe('DATA.EMPTY_SVG_PATH', () => {
    it('flags pictogram with empty svg_path', () => {
      const site = patchSite(refMinimal, {
        pictograms: [
          {
            id: 'picto-empty',
            org_id: 'org-test-001',
            category_id: 'cat-office',
            source: 'test',
            standard_ref: 'ISO-7001',
            svg_path: '  ',
            registry: 'wayfinding',
          },
        ],
      });
      const result = validateLibrary(site);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      const f = result.findings.find(
        (f) => f.code === 'DATA.EMPTY_SVG_PATH',
      );
      expect(f).toBeDefined();
    });
  });

  it('returns ok:true with DEST_CATEGORY_NOT_FOUND warnings', () => {
    // Categories exist for pictograms, but not for destinations.
    const site = patchSite(refMinimal, {
      destinations: [
        ...refMinimal.destinations,
        {
          id: 'dest-orphan',
          org_id: 'org-test-001',
          footprint_id: 'fp-001',
          node_id: 'n-entrance',
          category_id: 'cat-missing',
          occupant_name: 'Orphan',
          occupancy_status: 'occupied' as const,
          display_priority: 0,
        },
      ],
    });
    const result = validateLibrary(site);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const w = result.warnings.find(
      (f) => f.code === 'DATA.DEST_CATEGORY_NOT_FOUND',
    );
    expect(w).toBeDefined();
    expect(w?.severity).toBe('warning');
  });

  it('accepts categories with valid non-null parent_id', () => {
    const site = patchSite(refMinimal, {
      categories: [
        ...refMinimal.categories,
        {
          id: 'cat-child',
          org_id: 'org-test-001',
          sector_key: 'tertiary',
          code: 'child',
          parent_id: (refMinimal.categories[0] ?? { id: 'fallback' }).id,
        },
      ],
    });
    const result = validateLibrary(site);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total_categories).toBe(refMinimal.categories.length + 1);
  });

  it('reports multiple sectors from categories', () => {
    const site = patchSite(refMinimal, {
      pictograms: [],
      categories: [
        { id: 'cat-a', org_id: 'org-test-001', sector_key: 'health', code: 'a', parent_id: null },
        { id: 'cat-b', org_id: 'org-test-001', sector_key: 'retail', code: 'b', parent_id: null },
        { id: 'cat-c', org_id: 'org-test-001', sector_key: 'health', code: 'c', parent_id: null },
      ],
    });
    const result = validateLibrary(site);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.sectors).toEqual(['health', 'retail']);
  });

  describe('determinism (INV-4)', () => {
    it('same result on two calls', () => {
      const r1 = validateLibrary(refMinimal);
      const r2 = validateLibrary(refMinimal);
      expect(r1).toStrictEqual(r2);
    });
  });
});

describe('T-1.8 INV-3 guardSafetyRegistry', () => {
  it('blocks mutation of a safety pictogram', () => {
    const result = guardSafetyRegistry(refMinimal, [
      {
        pictogram_id: 'picto-fire-exit-safety',
        field: 'svg_path',
        old_value: 'M0 0L10 10',
        new_value: 'M0 0L20 20',
      },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const f = result.findings.find(
      (f) => f.code === 'SECURITY.REGISTRY_WRITE_DENIED',
    );
    expect(f).toBeDefined();
    expect(f?.ruleRef).toBe('INV-3');
  });

  it('allows mutation of a wayfinding pictogram', () => {
    const result = guardSafetyRegistry(refMinimal, [
      {
        pictogram_id: 'picto-office-wayfinding',
        field: 'svg_path',
        old_value: 'M0 0L10 10',
        new_value: 'M0 0L20 20',
      },
    ]);
    expect(result.ok).toBe(true);
  });

  it('ignores mutation of unknown pictogram', () => {
    const result = guardSafetyRegistry(refMinimal, [
      {
        pictogram_id: 'picto-unknown',
        field: 'svg_path',
        old_value: '',
        new_value: 'M0 0',
      },
    ]);
    expect(result.ok).toBe(true);
  });

  it('accepts empty mutations array', () => {
    const result = guardSafetyRegistry(refMinimal, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
  });

  it('blocks only safety in mixed safety+wayfinding batch', () => {
    const result = guardSafetyRegistry(refMinimal, [
      {
        pictogram_id: 'picto-office-wayfinding',
        field: 'svg_path',
        old_value: 'M0 0',
        new_value: 'M1 1',
      },
      {
        pictogram_id: 'picto-fire-exit-safety',
        field: 'svg_path',
        old_value: 'M0 0',
        new_value: 'M2 2',
      },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.entity?.id).toBe(
      'picto-fire-exit-safety',
    );
  });

  it('multiple mutations on same safety pictogram produce multiple findings', () => {
    const result = guardSafetyRegistry(refMinimal, [
      { pictogram_id: 'picto-fire-exit-safety', field: 'svg_path', old_value: 'M0 0', new_value: 'M1 1' },
      { pictogram_id: 'picto-fire-exit-safety', field: 'source', old_value: 'internal', new_value: 'external' },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings).toHaveLength(2);
    const fields = result.findings.map((f) => f.params['field']);
    expect(fields).toContain('svg_path');
    expect(fields).toContain('source');
  });
});

describe('T-1.8 INV-3 guardSafetyDeletion', () => {
  it('blocks deletion of a safety pictogram', () => {
    const result = guardSafetyDeletion(refMinimal, [
      'picto-fire-exit-safety',
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.ruleRef).toBe('INV-3');
  });

  it('allows deletion of a wayfinding pictogram', () => {
    const result = guardSafetyDeletion(refMinimal, [
      'picto-office-wayfinding',
    ]);
    expect(result.ok).toBe(true);
  });

  it('accepts empty pictogram ids array', () => {
    const result = guardSafetyDeletion(refMinimal, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
  });

  it('blocks only safety in mixed safety+wayfinding deletion batch', () => {
    const result = guardSafetyDeletion(refMinimal, [
      'picto-office-wayfinding',
      'picto-fire-exit-safety',
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.entity?.id).toBe('picto-fire-exit-safety');
    expect(result.findings[0]?.params['operation']).toBe('delete');
  });

  it('ignores unknown pictogram ids', () => {
    const result = guardSafetyDeletion(refMinimal, [
      'picto-nonexistent',
    ]);
    expect(result.ok).toBe(true);
  });
});

describe('DATA.CATEGORY_CYCLE', () => {
  it('detects category referencing itself as parent', () => {
    const site = patchSite(refMinimal, {
      categories: [
        {
          id: 'cat-self',
          org_id: 'org-test-001',
          sector_key: 'tertiary',
          code: 'self',
          parent_id: 'cat-self',
        },
      ],
    });
    const result = validateLibrary(site);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const cycles = result.findings.filter(
      (f) => f.code === 'DATA.CATEGORY_CYCLE',
    );
    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles[0]?.entity?.id).toBe('cat-self');
  });

  it('detects 3-node category cycle (A → B → C → A)', () => {
    const site = patchSite(refMinimal, {
      categories: [
        { id: 'cat-a', org_id: 'org-test-001', sector_key: 'tertiary', code: 'a', parent_id: 'cat-c' },
        { id: 'cat-b', org_id: 'org-test-001', sector_key: 'tertiary', code: 'b', parent_id: 'cat-a' },
        { id: 'cat-c', org_id: 'org-test-001', sector_key: 'tertiary', code: 'c', parent_id: 'cat-b' },
      ],
    });
    const result = validateLibrary(site);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const cycles = result.findings.filter(
      (f) => f.code === 'DATA.CATEGORY_CYCLE',
    );
    expect(cycles.length).toBeGreaterThanOrEqual(1);
  });
});
