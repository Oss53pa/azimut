import { describe, it, expect } from 'vitest';
import {
  relativeLuminance,
  contrastRatio,
  checkOutputProfile,
  resolveDisplayColor,
  rgbToCss,
  formatReference,
} from '../color-management.js';
import type { CharterColor, RGBColor } from '../color-management.js';

const white: RGBColor = { r: 255, g: 255, b: 255 };
const black: RGBColor = { r: 0, g: 0, b: 0 };

function charterColor(overrides: Partial<CharterColor> = {}): CharterColor {
  return {
    id: 'color-1',
    roleId: 'primary',
    reference: { system: 'pantone', code: '186 C' },
    display: { r: 200, g: 30, b: 40 },
    outputProfiles: [
      { substrate: 'vinyl', colorSpace: 'cmyk', cmyk: { c: 0, m: 90, y: 80, k: 5 }, spotReference: null },
    ],
    ...overrides,
  };
}

describe('E13 — color management', () => {
  describe('relativeLuminance', () => {
    it('white has luminance ~1', () => {
      expect(relativeLuminance(white)).toBeCloseTo(1, 2);
    });

    it('black has luminance 0', () => {
      expect(relativeLuminance(black)).toBeCloseTo(0, 5);
    });

    it('pure red has expected luminance', () => {
      const red: RGBColor = { r: 255, g: 0, b: 0 };
      expect(relativeLuminance(red)).toBeCloseTo(0.2126, 2);
    });

    it('pure green has expected luminance', () => {
      const green: RGBColor = { r: 0, g: 255, b: 0 };
      expect(relativeLuminance(green)).toBeCloseTo(0.7152, 2);
    });
  });

  describe('contrastRatio', () => {
    it('white vs black = 21:1', () => {
      expect(contrastRatio(white, black)).toBeCloseTo(21, 0);
    });

    it('same color = 1:1', () => {
      expect(contrastRatio(white, white)).toBeCloseTo(1);
    });

    it('is symmetric', () => {
      const mid: RGBColor = { r: 128, g: 128, b: 128 };
      expect(contrastRatio(white, mid)).toBeCloseTo(contrastRatio(mid, white));
    });

    it('result is always >= 1', () => {
      const c1: RGBColor = { r: 50, g: 50, b: 50 };
      const c2: RGBColor = { r: 200, g: 200, b: 200 };
      expect(contrastRatio(c1, c2)).toBeGreaterThanOrEqual(1);
    });
  });

  describe('checkOutputProfile', () => {
    it('returns null when profile exists', () => {
      const color = charterColor();
      expect(checkOutputProfile(color, 'vinyl')).toBeNull();
    });

    it('returns COLOR.PROFILE_MISSING when absent', () => {
      const color = charterColor();
      const finding = checkOutputProfile(color, 'metal');
      expect(finding).not.toBeNull();
      expect(finding?.code).toBe('COLOR.PROFILE_MISSING');
      expect(finding?.params['substrate']).toBe('metal');
    });
  });

  describe('resolveDisplayColor', () => {
    it('returns display RGB for known role', () => {
      const palette = { primary: charterColor() };
      const rgb = resolveDisplayColor('primary', palette);
      expect(rgb).toStrictEqual({ r: 200, g: 30, b: 40 });
    });

    it('returns null for unknown role', () => {
      expect(resolveDisplayColor('unknown', {})).toBeNull();
    });
  });

  describe('rgbToCss', () => {
    it('formats as rgb() string', () => {
      expect(rgbToCss({ r: 255, g: 128, b: 0 })).toBe('rgb(255, 128, 0)');
    });
  });

  describe('formatReference', () => {
    it('formats Pantone reference', () => {
      expect(formatReference({ system: 'pantone', code: '186 C' })).toBe('Pantone 186 C');
    });

    it('formats RAL reference', () => {
      expect(formatReference({ system: 'ral', code: '3020' })).toBe('RAL 3020');
    });

    it('formats custom reference', () => {
      expect(formatReference({ system: 'custom', name: 'Brand Blue' })).toBe('Brand Blue');
    });
  });
});
