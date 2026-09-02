import { describe, it, expect } from 'vitest';
import { validateSupports } from '../validate-supports.js';
import { refMinimal, refMultilevel } from '@azimut/testkit';
import type { SiteData } from '@azimut/core-model';

function patchSite(
  base: SiteData,
  patch: Partial<SiteData>,
): SiteData {
  return { ...base, ...patch };
}

describe('T-2.1 / T-2.2 validateSupports', () => {
  it('passes on valid refMinimal', () => {
    const result = validateSupports(refMinimal);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total_support_types).toBe(2);
    expect(result.value.total_face_templates).toBe(1);
    expect(result.value.type_keys).toEqual([
      'directional',
      'totemic',
    ]);
  });

  it('passes on valid refMultilevel', () => {
    const result = validateSupports(refMultilevel);
    expect(result.ok).toBe(true);
  });

  describe('DATA.SUPPORT_DUPLICATE_TYPE_KEY', () => {
    it('flags duplicate support type keys', () => {
      const site = patchSite(refMinimal, {
        support_types: [
          ...refMinimal.support_types,
          {
            id: 'stype-dup',
            org_id: 'org-test-001',
            key: 'directional',
            name: 'Doublon',
            face_count: 1,
            faces: [
              {
                side: 'front',
                default_width_mm: 600,
                default_height_mm: 400,
              },
            ],
          },
        ],
      });
      const result = validateSupports(site);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      const f = result.findings.find(
        (f) => f.code === 'DATA.SUPPORT_DUPLICATE_TYPE_KEY',
      );
      expect(f).toBeDefined();
    });
  });

  describe('DATA.SUPPORT_FACE_COUNT_MISMATCH', () => {
    it('flags type with wrong face count', () => {
      const site = patchSite(refMinimal, {
        support_types: [
          {
            id: 'stype-bad',
            org_id: 'org-test-001',
            key: 'bad',
            name: 'Mauvais',
            face_count: 3,
            faces: [
              {
                side: 'front',
                default_width_mm: 600,
                default_height_mm: 400,
              },
            ],
          },
        ],
      });
      const result = validateSupports(site);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      const f = result.findings.find(
        (f) => f.code === 'DATA.SUPPORT_FACE_COUNT_MISMATCH',
      );
      expect(f).toBeDefined();
      expect(f?.params?.declared).toBe(3);
      expect(f?.params?.actual).toBe(1);
    });
  });

  describe('DATA.SUPPORT_TEMPLATE_TYPE_NOT_FOUND', () => {
    it('flags template referencing unknown support type', () => {
      const site = patchSite(refMinimal, {
        face_templates: [
          {
            id: 'ftpl-orphan',
            org_id: 'org-test-001',
            support_type_key: 'nonexistent',
            side: 'front',
            name: 'Orphelin',
            blocks: [],
          },
        ],
      });
      const result = validateSupports(site);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      const f = result.findings.find(
        (f) => f.code === 'DATA.SUPPORT_TEMPLATE_TYPE_NOT_FOUND',
      );
      expect(f).toBeDefined();
    });
  });

  describe('DATA.SUPPORT_TEMPLATE_SIDE_NOT_FOUND', () => {
    it('warns when template side not in type faces', () => {
      const site = patchSite(refMinimal, {
        face_templates: [
          {
            id: 'ftpl-bad-side',
            org_id: 'org-test-001',
            support_type_key: 'directional',
            side: 'back',
            name: 'Mauvais côté',
            blocks: [],
          },
        ],
      });
      const result = validateSupports(site);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const w = result.warnings.find(
        (f) => f.code === 'DATA.SUPPORT_TEMPLATE_SIDE_NOT_FOUND',
      );
      expect(w).toBeDefined();
    });
  });

  describe('DATA.SUPPORT_BLOCK_REGION_INVALID', () => {
    it('flags block region exceeding 100%', () => {
      const site = patchSite(refMinimal, {
        face_templates: [
          {
            id: 'ftpl-overflow',
            org_id: 'org-test-001',
            support_type_key: 'directional',
            side: 'front',
            name: 'Débordement',
            blocks: [
              {
                kind: 'header' as const,
                ordinal: 0,
                region: {
                  x_pct: 50,
                  y_pct: 0,
                  w_pct: 60,
                  h_pct: 20,
                },
                config: {},
              },
            ],
          },
        ],
      });
      const result = validateSupports(site);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      const f = result.findings.find(
        (f) => f.code === 'DATA.SUPPORT_BLOCK_REGION_INVALID',
      );
      expect(f).toBeDefined();
    });
  });

  describe('adding a type requires no code change (T-2.1)', () => {
    it('accepts a new type added as pure data', () => {
      const site = patchSite(refMinimal, {
        support_types: [
          ...refMinimal.support_types,
          {
            id: 'stype-custom',
            org_id: 'org-test-001',
            key: 'wall_mounted',
            name: 'Panneau mural',
            face_count: 1,
            faces: [
              {
                side: 'front',
                default_width_mm: 300,
                default_height_mm: 200,
              },
            ],
          },
        ],
      });
      const result = validateSupports(site);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.type_keys).toContain('wall_mounted');
    });
  });

  describe('adding a template as data (T-2.2)', () => {
    it('accepts a new template added as pure data', () => {
      const site = patchSite(refMinimal, {
        face_templates: [
          ...refMinimal.face_templates,
          {
            id: 'ftpl-totem-front',
            org_id: 'org-test-001',
            support_type_key: 'totemic',
            side: 'front',
            name: 'Totem face avant',
            blocks: [
              {
                kind: 'logo' as const,
                ordinal: 0,
                region: {
                  x_pct: 0,
                  y_pct: 0,
                  w_pct: 100,
                  h_pct: 15,
                },
                config: {},
              },
              {
                kind: 'destination_list' as const,
                ordinal: 1,
                region: {
                  x_pct: 0,
                  y_pct: 15,
                  w_pct: 100,
                  h_pct: 85,
                },
                config: {},
              },
            ],
          },
        ],
      });
      const result = validateSupports(site);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.total_face_templates).toBe(2);
    });
  });

  describe('determinism (INV-4)', () => {
    it('same result on two calls', () => {
      const r1 = validateSupports(refMinimal);
      const r2 = validateSupports(refMinimal);
      expect(r1).toStrictEqual(r2);
    });
  });
});
