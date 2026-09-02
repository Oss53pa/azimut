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

  describe('LIBRARY.CATEGORY_PARENT_NOT_FOUND', () => {
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
        (f) => f.code === 'LIBRARY.CATEGORY_PARENT_NOT_FOUND',
      );
      expect(f).toBeDefined();
    });
  });

  describe('LIBRARY.CATEGORY_CYCLE', () => {
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
        (f) => f.code === 'LIBRARY.CATEGORY_CYCLE',
      );
      expect(cycles.length).toBeGreaterThan(0);
    });
  });

  describe('LIBRARY.PICTOGRAM_CATEGORY_NOT_FOUND', () => {
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
        (f) => f.code === 'LIBRARY.PICTOGRAM_CATEGORY_NOT_FOUND',
      );
      expect(f).toBeDefined();
    });
  });

  describe('LIBRARY.DEST_CATEGORY_NOT_FOUND', () => {
    it('warns when destination references non-existent category', () => {
      const site = patchSite(refMinimal, {
        categories: [],
      });
      const result = validateLibrary(site);
      if (result.ok) {
        const w = result.warnings.find(
          (f) => f.code === 'LIBRARY.DEST_CATEGORY_NOT_FOUND',
        );
        expect(w).toBeDefined();
      } else {
        const f = result.findings.find(
          (f) => f.code === 'LIBRARY.DEST_CATEGORY_NOT_FOUND',
        );
        expect(f).toBeDefined();
      }
    });
  });

  describe('LIBRARY.EMPTY_SVG_PATH', () => {
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
        (f) => f.code === 'LIBRARY.EMPTY_SVG_PATH',
      );
      expect(f).toBeDefined();
    });
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
      (f) => f.code === 'LIBRARY.SAFETY_REGISTRY_IMMUTABLE',
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
});
