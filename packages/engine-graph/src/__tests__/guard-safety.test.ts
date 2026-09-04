import { describe, it, expect } from 'vitest';
import { guardCharterOnSafety } from '../guard-safety.js';
import type { CharterApplication } from '../guard-safety.js';
import { refMinimal } from '@azimut/testkit';

describe('T-2.6 INV-3 guardCharterOnSafety', () => {
  describe('color attempt on safety', () => {
    it('blocks color change on safety registry', () => {
      const apps: CharterApplication[] = [
        {
          target_id: 'picto-fire-exit-safety',
          target_registry: 'safety',
          change_kind: 'color',
          field: 'background_color',
          value: 'red-value',
        },
      ];
      const result = guardCharterOnSafety(refMinimal, apps);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.findings[0]?.code).toBe(
        'SECURITY.CHARTER_OVERRIDE_DENIED',
      );
      expect(result.findings[0]?.ruleRef).toBe('INV-3');
    });
  });

  describe('geometry attempt on safety', () => {
    it('blocks geometry change on safety registry', () => {
      const apps: CharterApplication[] = [
        {
          target_id: 'picto-fire-exit-safety',
          target_registry: 'safety',
          change_kind: 'geometry',
          field: 'width_mm',
          value: '200',
        },
      ];
      const result = guardCharterOnSafety(refMinimal, apps);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.findings[0]?.code).toBe(
        'SECURITY.CHARTER_OVERRIDE_DENIED',
      );
      expect(result.findings[0]?.ruleRef).toBe('INV-3');
    });
  });

  describe('pictogram attempt on safety', () => {
    it('blocks pictogram change on safety registry', () => {
      const apps: CharterApplication[] = [
        {
          target_id: 'picto-fire-exit-safety',
          target_registry: 'safety',
          change_kind: 'pictogram',
          field: 'svg_path',
          value: 'M0 0L99 99',
        },
      ];
      const result = guardCharterOnSafety(refMinimal, apps);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.findings[0]?.code).toBe(
        'SECURITY.CHARTER_OVERRIDE_DENIED',
      );
      expect(result.findings[0]?.ruleRef).toBe('INV-3');
    });
  });

  describe('proportion attempt on safety', () => {
    it('blocks proportion change on safety registry', () => {
      const apps: CharterApplication[] = [
        {
          target_id: 'picto-fire-exit-safety',
          target_registry: 'safety',
          change_kind: 'proportion',
          field: 'aspect_ratio',
          value: '16:9',
        },
      ];
      const result = guardCharterOnSafety(refMinimal, apps);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.findings[0]?.code).toBe(
        'SECURITY.CHARTER_OVERRIDE_DENIED',
      );
      expect(result.findings[0]?.ruleRef).toBe('INV-3');
    });
  });

  describe('wayfinding changes are allowed', () => {
    it('allows color change on wayfinding registry', () => {
      const apps: CharterApplication[] = [
        {
          target_id: 'picto-office-wayfinding',
          target_registry: 'wayfinding',
          change_kind: 'color',
          field: 'background_color',
          value: 'green-value',
        },
      ];
      const result = guardCharterOnSafety(refMinimal, apps);
      expect(result.ok).toBe(true);
    });

    it('allows all change kinds on wayfinding', () => {
      const kinds: CharterApplication['change_kind'][] = [
        'color',
        'geometry',
        'pictogram',
        'proportion',
      ];
      for (const kind of kinds) {
        const apps: CharterApplication[] = [
          {
            target_id: 'picto-office-wayfinding',
            target_registry: 'wayfinding',
            change_kind: kind,
            field: 'test',
            value: 'test',
          },
        ];
        const result = guardCharterOnSafety(refMinimal, apps);
        expect(result.ok).toBe(true);
      }
    });
  });

  describe('mixed batch', () => {
    it('blocks all safety items, allows wayfinding', () => {
      const apps: CharterApplication[] = [
        {
          target_id: 'picto-office-wayfinding',
          target_registry: 'wayfinding',
          change_kind: 'color',
          field: 'bg',
          value: 'black-value',
        },
        {
          target_id: 'picto-fire-exit-safety',
          target_registry: 'safety',
          change_kind: 'color',
          field: 'bg',
          value: 'white-value',
        },
      ];
      const result = guardCharterOnSafety(refMinimal, apps);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.findings.length).toBe(1);
      expect(result.findings[0]?.code).toBe(
        'SECURITY.CHARTER_OVERRIDE_DENIED',
      );
    });
  });

  describe('all safety kinds share the same code', () => {
    it('produces 1 unified code for 4 change kinds', () => {
      const kinds: CharterApplication['change_kind'][] = [
        'color',
        'geometry',
        'pictogram',
        'proportion',
      ];
      const codes = new Set<string>();
      for (const kind of kinds) {
        const apps: CharterApplication[] = [
          {
            target_id: 'test',
            target_registry: 'safety',
            change_kind: kind,
            field: 'f',
            value: 'v',
          },
        ];
        const result = guardCharterOnSafety(refMinimal, apps);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          codes.add(result.findings[0]?.code ?? '');
        }
      }
      expect(codes.size).toBe(1);
      expect(codes.has('SECURITY.CHARTER_OVERRIDE_DENIED')).toBe(true);
    });
  });

  describe('empty applications', () => {
    it('returns ok for empty array', () => {
      const result = guardCharterOnSafety(refMinimal, []);
      expect(result.ok).toBe(true);
    });
  });

  describe('sort order and params', () => {
    it('findings sorted by target_id then change_kind', () => {
      const apps: CharterApplication[] = [
        { target_id: 'z-target', target_registry: 'safety', change_kind: 'color', field: 'f', value: 'v' },
        { target_id: 'a-target', target_registry: 'safety', change_kind: 'proportion', field: 'f', value: 'v' },
        { target_id: 'a-target', target_registry: 'safety', change_kind: 'color', field: 'f', value: 'v' },
      ];
      const result = guardCharterOnSafety(refMinimal, apps);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.findings).toHaveLength(3);
      const ids = result.findings.map((f) => f.entity?.id);
      // a-target(color), a-target(proportion), z-target(color)
      expect(ids).toEqual(['a-target', 'a-target', 'z-target']);
    });

    it('finding params contain the attempted value', () => {
      const apps: CharterApplication[] = [
        { target_id: 'tgt-1', target_registry: 'safety', change_kind: 'geometry', field: 'width_mm', value: '500' },
      ];
      const result = guardCharterOnSafety(refMinimal, apps);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.findings[0]?.params['attempted_value']).toBe('500');
      expect(result.findings[0]?.params['change_kind']).toBe('geometry');
      expect(result.findings[0]?.params['field']).toBe('width_mm');
    });

    it('same target_id and change_kind but different fields produce separate findings', () => {
      const apps: CharterApplication[] = [
        { target_id: 'same', target_registry: 'safety', change_kind: 'color', field: 'fg', value: 'red-val' },
        { target_id: 'same', target_registry: 'safety', change_kind: 'color', field: 'bg', value: 'blue-val' },
      ];
      const result = guardCharterOnSafety(refMinimal, apps);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.findings).toHaveLength(2);
      const fields = result.findings.map((f) => f.params['field']);
      expect(fields).toContain('fg');
      expect(fields).toContain('bg');
    });
  });

  describe('determinism (INV-4)', () => {
    it('same result on two calls', () => {
      const apps: CharterApplication[] = [
        { target_id: 'a', target_registry: 'safety', change_kind: 'color', field: 'f', value: 'v' },
        { target_id: 'b', target_registry: 'wayfinding', change_kind: 'geometry', field: 'g', value: 'w' },
      ];
      const r1 = guardCharterOnSafety(refMinimal, apps);
      const r2 = guardCharterOnSafety(refMinimal, apps);
      expect(r1).toStrictEqual(r2);
    });
  });
});
