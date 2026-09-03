import { describe, it, expect } from 'vitest';
import { relativeLuminance, contrastRatio, WCAG_AA_NORMAL } from '../contrast.js';
import { themePapier, stateColors } from '../tokens.js';

const surfaces = [
  { key: 'surface-page', hex: themePapier['surface-page'] },
  { key: 'surface-panel', hex: themePapier['surface-panel'] },
] as const;

const foregrounds = [
  { key: 'text-primary', hex: themePapier['text-primary'] },
  { key: 'text-secondary', hex: themePapier['text-secondary'] },
  { key: 'accent', hex: themePapier['accent'] },
  { key: 'accent-secondary', hex: themePapier['accent-secondary'] },
  { key: 'state-blocking', hex: stateColors['state-blocking'] },
  { key: 'state-warning', hex: stateColors['state-warning'] },
  { key: 'state-valid', hex: stateColors['state-valid'] },
  { key: 'state-info', hex: stateColors['state-info'] },
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
    // 0.04045 / 255 ≈ channel value 10 (0x0a)
    // Just below threshold: channel 10 → 0.04045... / 12.92
    const belowThreshold = relativeLuminance('#0a0a0a');
    // Just above threshold: channel 11 → ((0.043137..) + 0.055) / 1.055) ^ 2.4
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
    // #777777 relative luminance ≈ 0.184
    // White ≈ 1.0
    // Ratio = (1.0 + 0.05) / (0.184 + 0.05) ≈ 4.48
    const ratio = contrastRatio('#777777', '#ffffff');
    expect(ratio).toBeGreaterThan(4);
    expect(ratio).toBeLessThan(5);
  });
});

describe('WCAG AA contrast (A11.1)', () => {
  for (const fg of foregrounds) {
    for (const bg of surfaces) {
      it(`${fg.key} on ${bg.key} meets ${WCAG_AA_NORMAL}:1`, () => {
        const ratio = contrastRatio(fg.hex, bg.hex);
        expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
      });
    }
  }
});
