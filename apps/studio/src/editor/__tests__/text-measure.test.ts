import { describe, it, expect } from 'vitest';
import {
  measureLine,
  measureText,
  measureLongestVariant,
  computeLineHeight,
  DEFAULT_TEXT_STYLE,
} from '../text-measure.js';
import type { FontMetrics, TextStyle } from '../text-measure.js';

const testMetrics: FontMetrics = {
  fontId: 'test-font',
  unitsPerEm: 1000,
  ascender: 800,
  descender: -200,
  lineGap: 0,
  avgCharWidth: 500,
  charWidths: {
    65: 600,  // A
    66: 550,  // B
    67: 580,  // C
    73: 300,  // I
    87: 800,  // W
    32: 250,  // space
  },
};

const baseStyle: TextStyle = {
  ...DEFAULT_TEXT_STYLE,
  fontSize_m: 0.1, // 100mm
};

describe('E12 — deterministic text measurement', () => {
  describe('measureLine', () => {
    it('measures single character width from metrics', () => {
      const w = measureLine('A', testMetrics, baseStyle);
      // A = 600 units, scale = 0.1/1000 = 0.0001 → 0.06m
      expect(w).toBeCloseTo(0.06);
    });

    it('uses avgCharWidth for unknown characters', () => {
      const w = measureLine('X', testMetrics, baseStyle);
      // X not in charWidths → avgCharWidth = 500 → 0.05m
      expect(w).toBeCloseTo(0.05);
    });

    it('adds letter spacing between characters', () => {
      const style: TextStyle = { ...baseStyle, letterSpacing_m: 0.01 };
      const w = measureLine('AB', testMetrics, style);
      // A(0.06) + spacing(0.01) + B(0.055) = 0.125
      expect(w).toBeCloseTo(0.125);
    });

    it('no letter spacing after last character', () => {
      const style: TextStyle = { ...baseStyle, letterSpacing_m: 0.01 };
      const w1 = measureLine('A', testMetrics, style);
      // Single char, no trailing spacing
      expect(w1).toBeCloseTo(0.06);
    });

    it('applies uppercase transform', () => {
      const style: TextStyle = { ...baseStyle, transform: 'uppercase' };
      // 'a' becomes 'A' (codePoint 65)
      const w = measureLine('a', testMetrics, style);
      expect(w).toBeCloseTo(0.06);
    });

    it('returns 0 for empty string', () => {
      expect(measureLine('', testMetrics, baseStyle)).toBe(0);
    });
  });

  describe('computeLineHeight', () => {
    it('multiplies fontSize by lineHeight factor', () => {
      const style: TextStyle = { ...baseStyle, lineHeight: 1.5 };
      expect(computeLineHeight(testMetrics, style)).toBeCloseTo(0.15);
    });

    it('default lineHeight is 1.2', () => {
      expect(computeLineHeight(testMetrics, baseStyle)).toBeCloseTo(0.12);
    });
  });

  describe('measureText', () => {
    it('measures single-line text', () => {
      const m = measureText('ABC', testMetrics, baseStyle, null, null);
      expect(m.lineCount).toBe(1);
      expect(m.width_m).toBeGreaterThan(0);
      expect(m.overflows).toBe(false);
    });

    it('counts line breaks', () => {
      const m = measureText('A\nB\nC', testMetrics, baseStyle, null, null);
      expect(m.lineCount).toBe(3);
    });

    it('detects width overflow', () => {
      const m = measureText('WWWWWW', testMetrics, baseStyle, 0.01, null);
      expect(m.overflows).toBe(true);
    });

    it('detects height overflow', () => {
      const m = measureText('A\nB\nC\nD\nE', testMetrics, baseStyle, null, 0.01);
      expect(m.overflows).toBe(true);
    });

    it('no overflow within bounds', () => {
      const m = measureText('A', testMetrics, baseStyle, 1, 1);
      expect(m.overflows).toBe(false);
    });

    it('height = lineCount × lineHeight', () => {
      const m = measureText('A\nB', testMetrics, baseStyle, null, null);
      expect(m.height_m).toBeCloseTo(0.24); // 2 lines × 0.12
    });
  });

  describe('measureLongestVariant (D12.2)', () => {
    it('returns measurement for the longest language variant', () => {
      const variants = {
        fr: 'ABC', // shorter
        en: 'WWWWW', // longer (W is widest)
      };
      const m = measureLongestVariant(
        variants, ['fr', 'en'],
        testMetrics, baseStyle, null, null,
      );
      // Should use 'en' as it's wider
      const enWidth = measureLine('WWWWW', testMetrics, baseStyle);
      expect(m.width_m).toBeCloseTo(enWidth);
    });

    it('ignores languages not in activeLangs', () => {
      const variants = {
        fr: 'A',
        de: 'WWWWWWWW', // very long but not active
      };
      const m = measureLongestVariant(
        variants, ['fr'],
        testMetrics, baseStyle, null, null,
      );
      const frWidth = measureLine('A', testMetrics, baseStyle);
      expect(m.width_m).toBeCloseTo(frWidth);
    });

    it('returns zero measurement for no matching languages', () => {
      const m = measureLongestVariant(
        { fr: 'Hello' }, ['de'],
        testMetrics, baseStyle, null, null,
      );
      expect(m.width_m).toBe(0);
      expect(m.lineCount).toBe(0);
    });
  });

  describe('determinism (INV-4)', () => {
    it('same inputs produce identical results', () => {
      const m1 = measureText('Test ABC', testMetrics, baseStyle, 1, 0.5);
      const m2 = measureText('Test ABC', testMetrics, baseStyle, 1, 0.5);
      expect(m1).toStrictEqual(m2);
    });
  });

  describe('hyphenation default', () => {
    it('hyphenation is disabled by default (E12)', () => {
      expect(DEFAULT_TEXT_STYLE.hyphenation).toBe(false);
    });
  });
});
