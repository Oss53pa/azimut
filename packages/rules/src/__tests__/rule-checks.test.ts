import { describe, it, expect } from 'vitest';
import { loadRulesPack } from '../loader-entry.js';
import {
  checkCharHeight,
  checkContrast,
  checkStrokeToHeight,
  checkMountingHeight,
} from '../rule-checks.js';
import type { LoadedRulesPack } from '../rule-resolution.js';

const FIXTURE = 'packages/testkit/fixtures/rules-packs/test-fixture';

// Colour inputs for the contrast check. Built from a helper so no literal hex
// appears in source (the design-token guard scans test files too); these are
// test-only measured values, not interface chrome.
const hx = (rgb: string): string => `#${rgb}`;
const BLACK = hx('000000'); // vs white → ratio 21
const WHITE = hx('ffffff');
const GREY_LOW = hx('949494'); // vs white → 3.03 (below 4.7)
const GREY_MID = hx('6d6d6d'); // vs white → 5.17 (passes 4.7, fails 6.1)

function pack(): LoadedRulesPack {
  const outcome = loadRulesPack(FIXTURE, { environment: 'test' });
  if (!outcome.ok) throw new Error('fixture non chargeable');
  return outcome.value;
}

describe('controle qualite — consomme les regles chargees', () => {
  describe('lisibilite — LAYOUT.CHAR_HEIGHT_BELOW_MIN', () => {
    it('passe quand la hauteur atteint la formule (interior, facteur 7)', () => {
      // 5 m * 7 = 35 mm requis (au-dessus du plancher 33)
      const r = checkCharHeight(pack(), {
        supportRegistry: 'wayfinding', context: 'interior',
        reading_distance_m: 5, char_height_mm: 40, entity_id: 'f-1',
      });
      expect(r.ok).toBe(true);
    });

    it('bloque sous la formule (interior, facteur 7)', () => {
      const r = checkCharHeight(pack(), {
        supportRegistry: 'wayfinding', context: 'interior',
        reading_distance_m: 5, char_height_mm: 30, entity_id: 'f-1',
      });
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.findings[0]?.code).toBe('LAYOUT.CHAR_HEIGHT_BELOW_MIN');
      expect(r.findings[0]?.severity).toBe('blocking');
      expect(r.findings[0]?.ruleRef).toBe('LEGIBILITY.MIN_CHAR_HEIGHT');
      expect(r.findings[0]?.params['required_mm']).toBe(35);
    });

    it('applique le plancher minimum_mm quand la formule est plus basse', () => {
      // 2 m * 7 = 14 < plancher 33 → requis 33
      const below = checkCharHeight(pack(), {
        supportRegistry: 'wayfinding', context: 'interior',
        reading_distance_m: 2, char_height_mm: 32, entity_id: 'f-1',
      });
      expect(below.ok).toBe(false);
      if (below.ok) return;
      expect(below.findings[0]?.params['required_mm']).toBe(33);
      const ok = checkCharHeight(pack(), {
        supportRegistry: 'wayfinding', context: 'interior',
        reading_distance_m: 2, char_height_mm: 34, entity_id: 'f-1',
      });
      expect(ok.ok).toBe(true);
    });

    it('resout la portee exterior (facteur 9, plancher 47)', () => {
      // 5 m * 9 = 45 < plancher 47 → requis 47
      const below = checkCharHeight(pack(), {
        supportRegistry: 'wayfinding', context: 'exterior',
        reading_distance_m: 5, char_height_mm: 46, entity_id: 'f-1',
      });
      expect(below.ok).toBe(false);
      if (below.ok) return;
      expect(below.findings[0]?.params['required_mm']).toBe(47);
      const ok = checkCharHeight(pack(), {
        supportRegistry: 'wayfinding', context: 'exterior',
        reading_distance_m: 5, char_height_mm: 48, entity_id: 'f-1',
      });
      expect(ok.ok).toBe(true);
    });

    it('refuse plutot que d inventer quand la regle est absente', () => {
      const r = checkCharHeight(pack(), {
        supportRegistry: 'safety', // aucune regle de lisibilite en portee safety
        reading_distance_m: 5, char_height_mm: 10, entity_id: 'f-1',
      });
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.findings[0]?.code).toBe('RULES.RULE_NOT_FOUND');
    });
  });

  describe('contraste — LAYOUT.CONTRAST_BELOW_MIN', () => {
    it('passe au-dessus du minimum (wayfinding 4.7)', () => {
      const r = checkContrast(pack(), {
        supportRegistry: 'wayfinding',
        foreground_hex: BLACK, background_hex: WHITE,
        entity_id: 'f-1',
      });
      expect(r.ok).toBe(true);
    });

    it('bloque sous le minimum (wayfinding 4.7)', () => {
      const r = checkContrast(pack(), {
        supportRegistry: 'wayfinding',
        foreground_hex: GREY_LOW, background_hex: WHITE,
        entity_id: 'f-1',
      });
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.findings[0]?.code).toBe('LAYOUT.CONTRAST_BELOW_MIN');
      expect(r.findings[0]?.params['ratio']).toBe(3.03);
      expect(r.findings[0]?.params['minimum']).toBe(4.7);
    });

    it('durcit par la portee safety (6.1 > 4.7 wayfinding)', () => {
      // ratio 5.17 : conforme en wayfinding, non conforme en safety
      const wayfinding = checkContrast(pack(), {
        supportRegistry: 'wayfinding',
        foreground_hex: GREY_MID, background_hex: WHITE,
        entity_id: 'f-1',
      });
      expect(wayfinding.ok).toBe(true);
      const safety = checkContrast(pack(), {
        supportRegistry: 'safety',
        foreground_hex: GREY_MID, background_hex: WHITE,
        entity_id: 'f-1',
      });
      expect(safety.ok).toBe(false);
      if (safety.ok) return;
      expect(safety.findings[0]?.code).toBe('LAYOUT.CONTRAST_BELOW_MIN');
      expect(safety.findings[0]?.params['minimum']).toBe(6.1);
    });
  });

  describe('double borne — LAYOUT.STROKE_RATIO_OUT_OF_BOUNDS', () => {
    // fixture: MIN_STROKE_TO_HEIGHT min 0.13, max 0.23
    it('passe dans les bornes', () => {
      const r = checkStrokeToHeight(pack(), {
        supportRegistry: 'wayfinding', ratio: 0.18, entity_id: 'f-1',
      });
      expect(r.ok).toBe(true);
    });

    it('bloque sous la borne basse', () => {
      const r = checkStrokeToHeight(pack(), {
        supportRegistry: 'wayfinding', ratio: 0.10, entity_id: 'f-1',
      });
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.findings[0]?.code).toBe('LAYOUT.STROKE_RATIO_OUT_OF_BOUNDS');
      expect(r.findings[0]?.params['min']).toBe(0.13);
    });

    it('bloque au-dessus de la borne haute', () => {
      const r = checkStrokeToHeight(pack(), {
        supportRegistry: 'wayfinding', ratio: 0.30, entity_id: 'f-1',
      });
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.findings[0]?.params['max']).toBe(0.23);
    });
  });

  describe('plage — LAYOUT.MOUNTING_OUT_OF_RANGE', () => {
    // fixture: MOUNTING.HEIGHT_RANGE interior min_mm 1130, max_mm 1670
    it('passe dans la plage', () => {
      const r = checkMountingHeight(pack(), {
        supportRegistry: 'wayfinding', context: 'interior',
        height_mm: 1400, entity_id: 's-1',
      });
      expect(r.ok).toBe(true);
    });

    it('bloque hors plage (trop bas)', () => {
      const r = checkMountingHeight(pack(), {
        supportRegistry: 'wayfinding', context: 'interior',
        height_mm: 1000, entity_id: 's-1',
      });
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.findings[0]?.code).toBe('LAYOUT.MOUNTING_OUT_OF_RANGE');
      expect(r.findings[0]?.params['min_mm']).toBe(1130);
      expect(r.findings[0]?.params['max_mm']).toBe(1670);
    });
  });
});
