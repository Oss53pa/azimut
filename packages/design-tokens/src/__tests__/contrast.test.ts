import { describe, it, expect } from 'vitest';
import {
  relativeLuminance,
  contrastRatio,
  WCAG_AA_NORMAL,
  WCAG_AA_LARGE,
} from '../contrast.js';
import { themePapier, stateColorsPapier } from '../tokens.js';

/**
 * Partie F specifies five surfaces that can carry text.
 * Contrast is computed on all of them (F2.3).
 */
const surfaces = [
  { key: 'surface-page', hex: themePapier['surface-page'] },
  { key: 'surface-panel', hex: themePapier['surface-panel'] },
  { key: 'surface-canvas', hex: themePapier['surface-canvas'] },
  { key: 'surface-sunken', hex: themePapier['surface-sunken'] },
] as const;

const foregrounds = [
  { key: 'text-primary', hex: themePapier['text-primary'] },
  { key: 'text-secondary', hex: themePapier['text-secondary'] },
  { key: 'accent', hex: themePapier['accent'] },
  { key: 'accent-secondary', hex: themePapier['accent-secondary'] },
  { key: 'state-blocking', hex: stateColorsPapier['state-blocking'] },
  { key: 'state-warning', hex: stateColorsPapier['state-warning'] },
  { key: 'state-valid', hex: stateColorsPapier['state-valid'] },
  { key: 'state-info', hex: stateColorsPapier['state-info'] },
] as const;

describe('relativeLuminance', () => {
  it('returns 0 for pure black', () => {
    expect(relativeLuminance('#000000')).toBe(0);
  });

  it('returns 1 for pure white', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 10);
  });

  it('returns ~0.2126 for pure red', () => {
    expect(relativeLuminance('#ff0000')).toBeCloseTo(0.2126, 4);
  });

  it('returns ~0.7152 for pure green', () => {
    expect(relativeLuminance('#00ff00')).toBeCloseTo(0.7152, 4);
  });

  it('returns ~0.0722 for pure blue', () => {
    expect(relativeLuminance('#0000ff')).toBeCloseTo(0.0722, 4);
  });

  it('handles the sRGB linearization threshold boundary', () => {
    const belowThreshold = relativeLuminance('#0a0a0a');
    const aboveThreshold = relativeLuminance('#0b0b0b');
    expect(belowThreshold).toBeGreaterThan(0);
    expect(aboveThreshold).toBeGreaterThan(belowThreshold);
  });
});

describe('contrastRatio known values', () => {
  it('returns 21 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  it('returns 1 for identical white', () => {
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 10);
  });

  it('returns 1 for identical black', () => {
    expect(contrastRatio('#000000', '#000000')).toBeCloseTo(1, 10);
  });

  it('is symmetric: ratio(a, b) === ratio(b, a)', () => {
    const r1 = contrastRatio('#336699', '#ffcc00');
    const r2 = contrastRatio('#ffcc00', '#336699');
    expect(r1).toBe(r2);
  });

  it('mid-gray on white produces a plausible ratio', () => {
    const ratio = contrastRatio('#777777', '#ffffff');
    expect(ratio).toBeGreaterThan(4);
    expect(ratio).toBeLessThan(5);
  });
});

describe('parseHex edge cases', () => {
  it('accepts hex without # prefix', () => {
    const withHash = relativeLuminance('#ff0000');
    const withoutHash = relativeLuminance('ff0000');
    expect(withoutHash).toBe(withHash);
  });

  it('returns NaN for 3-char shorthand hex', () => {
    const lum = relativeLuminance('#fff');
    expect(lum).toBeNaN();
  });

  it('returns NaN for empty string', () => {
    const lum = relativeLuminance('');
    expect(lum).toBeNaN();
  });
});

describe('WCAG_AA_LARGE threshold', () => {
  it('exports the correct large-text threshold', () => {
    expect(WCAG_AA_LARGE).toBe(3);
  });

  it('a pair can pass AA-large but fail AA-normal', () => {
    const ratio = contrastRatio('#888888', '#ffffff');
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
    expect(ratio).toBeLessThan(WCAG_AA_NORMAL);
  });
});

describe('WCAG AA contrast — Papier theme (F2.3)', () => {
  for (const fg of foregrounds) {
    for (const bg of surfaces) {
      it(`${fg.key} on ${bg.key} meets ${WCAG_AA_NORMAL}:1`, () => {
        const ratio = contrastRatio(fg.hex, bg.hex);
        expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
      });
    }
  }
});

describe('border-interactive meets 3.0 threshold (F2.4)', () => {
  for (const bg of surfaces) {
    it(`border-interactive on ${bg.key} meets ${WCAG_AA_LARGE}:1`, () => {
      const ratio = contrastRatio(themePapier['border-interactive'], bg.hex);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
    });
  }
});
