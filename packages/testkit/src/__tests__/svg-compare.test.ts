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

  it('detects difference at index 0', () => {
    const diff = compareSvg('abc', 'xyz');
    expect(diff.identical).toBe(false);
    expect(diff.first_diff_index).toBe(0);
    expect(diff.context).toContain('^');
  });

  it('handles one empty string vs non-empty', () => {
    const diff = compareSvg('', '<svg/>');
    expect(diff.identical).toBe(false);
    expect(diff.first_diff_index).toBe(0);
    expect(diff.expected_length).toBe(0);
    expect(diff.actual_length).toBe(6);
  });

  it('handles expected longer than actual', () => {
    const diff = compareSvg(SVG_A + '<!-- tail -->', SVG_A);
    expect(diff.identical).toBe(false);
    expect(diff.expected_length).toBeGreaterThan(diff.actual_length);
    expect(diff.first_diff_index).toBe(SVG_A.length);
  });

  it('context caret aligns with first diff', () => {
    const diff = compareSvg('ab', 'ac');
    expect(diff.identical).toBe(false);
    expect(diff.first_diff_index).toBe(1);
    // The caret line has 14 chars prefix + offset from contextStart
    const ctx = diff.context ?? '';
    const lines = ctx.split('\n');
    const caretLine = lines[2] ?? '';
    const caretPos = caretLine.indexOf('^');
    expect(caretPos).toBe(14 + 1); // 14 prefix + diffIndex(1) - contextStart(0)
  });
});

describe('assertSvgEqual', () => {
  it('does not throw for identical SVGs', () => {
    expect(() => assertSvgEqual(SVG_A, SVG_A)).not.toThrow();
  });

  it('throws for different SVGs', () => {
    expect(() => assertSvgEqual(SVG_A, SVG_B)).toThrow('SVG mismatch');
  });

  it('thrown error includes diff index and context', () => {
    try {
      assertSvgEqual('abc', 'axc');
      expect.unreachable('should have thrown');
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toContain('SVG mismatch at index 1');
      expect(msg).toContain('expected:');
      expect(msg).toContain('actual:');
    }
  });
});
