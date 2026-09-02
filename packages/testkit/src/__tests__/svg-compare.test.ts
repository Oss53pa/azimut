import { describe, it, expect } from 'vitest';
import { compareSvg, assertSvgEqual } from '../svg-compare.js';

const SVG_A = '<svg viewBox="0 0 100 100"><rect x="0" y="0" width="50" height="50"/></svg>';
const SVG_B = '<svg viewBox="0 0 100 100"><rect x="0" y="0" width="60" height="50"/></svg>';

describe('compareSvg', () => {
  it('reports identical SVGs', () => {
    const diff = compareSvg(SVG_A, SVG_A);
    expect(diff.identical).toBe(true);
    expect(diff.first_diff_index).toBeNull();
    expect(diff.context).toBeNull();
  });

  it('reports differences between SVGs', () => {
    const diff = compareSvg(SVG_A, SVG_B);
    expect(diff.identical).toBe(false);
    expect(diff.first_diff_index).toBeGreaterThan(0);
    expect(diff.context).toContain('expected:');
    expect(diff.context).toContain('actual:');
  });

  it('handles different lengths', () => {
    const diff = compareSvg(SVG_A, SVG_A + '<!-- extra -->');
    expect(diff.identical).toBe(false);
    expect(diff.expected_length).toBeLessThan(diff.actual_length);
  });

  it('handles empty strings', () => {
    const diff = compareSvg('', '');
    expect(diff.identical).toBe(true);
  });
});

describe('assertSvgEqual', () => {
  it('does not throw for identical SVGs', () => {
    expect(() => assertSvgEqual(SVG_A, SVG_A)).not.toThrow();
  });

  it('throws for different SVGs', () => {
    expect(() => assertSvgEqual(SVG_A, SVG_B)).toThrow('SVG mismatch');
  });
});
