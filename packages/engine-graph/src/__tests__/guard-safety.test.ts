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
        'SAFETY.CHARTER_COLOR_BLOCKED',
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
        'SAFETY.CHARTER_GEOMETRY_BLOCKED',
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
        'SAFETY.CHARTER_PICTOGRAM_BLOCKED',
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
        'SAFETY.CHARTER_PROPORTION_BLOCKED',
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
        'SAFETY.CHARTER_COLOR_BLOCKED',
      );
    });
  });

  describe('each code is distinct', () => {
    it('produces 4 distinct codes for 4 change kinds', () => {
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
      expect(codes.size).toBe(4);
    });
  });
});
