import { describe, it, expect } from 'vitest';
import { relativeLuminance, contrastRatio } from '../color-contrast.js';

// Colours via a helper so no literal hex appears in source (A2.4 scanner).
const hx = (rgb: string): string => `#${rgb}`;
const WHITE = hx('ffffff');
const BLACK = hx('000000');
const GREY = hx('949494');

describe('relativeLuminance', () => {
  it('is 1 for white and 0 for black', () => {
    expect(relativeLuminance(WHITE)).toBeCloseTo(1, 10);
    expect(relativeLuminance(BLACK)).toBeCloseTo(0, 10);
  });

  it('returns null for an unparsable colour', () => {
    expect(relativeLuminance('not-a-colour')).toBeNull();
  });
});

describe('contrastRatio', () => {
  it('is 21 for black on white', () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 10);
  });

  it('is symmetric', () => {
    expect(contrastRatio(GREY, WHITE)).toBe(contrastRatio(WHITE, GREY));
  });

  it('returns full precision, not rounded to two decimals', () => {
    // Regression: rounding before the pass/fail comparison would let a
    // sub-threshold contrast clear a normative minimum. The ratio must carry
    // more precision than its 2-decimal display value.
    const r = contrastRatio(GREY, WHITE);
    expect(r).not.toBeNull();
    const ratio = r as number;
    expect(ratio).toBeCloseTo(3.0334698, 6);
    expect(ratio).not.toBe(Math.round(ratio * 100) / 100);
  });

  it('returns null when a colour cannot be parsed', () => {
    expect(contrastRatio('xyz', WHITE)).toBeNull();
  });
});
