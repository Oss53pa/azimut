import { describe, it, expect } from 'vitest';
import {
  roundHalfAwayFromZero,
  roundSvg,
  formatSvg,
  roundMm,
  ceilMm,
} from '../index.js';

describe('roundHalfAwayFromZero', () => {
  it('rounds 0.5 up', () => {
    expect(roundHalfAwayFromZero(0.5)).toBe(1);
  });
  it('rounds -0.5 down (away from zero)', () => {
    expect(roundHalfAwayFromZero(-0.5)).toBe(-1);
  });
  it('rounds 2.4 to 2', () => {
    expect(roundHalfAwayFromZero(2.4)).toBe(2);
  });
  it('rounds -2.4 to -2', () => {
    expect(roundHalfAwayFromZero(-2.4)).toBe(-2);
  });
  it('negative zero becomes positive zero', () => {
    expect(Object.is(roundHalfAwayFromZero(-0), 0)).toBe(true);
  });
});

describe('roundSvg — D1.4 mandatory test', () => {
  it('rounds 0.0005 to 0.001', () => {
    expect(roundSvg(0.0005)).toBe(0.001);
  });
  it('rounds -0.0005 to -0.001', () => {
    expect(roundSvg(-0.0005)).toBe(-0.001);
  });
  it('converts negative zero to zero', () => {
    expect(Object.is(roundSvg(-0), 0)).toBe(true);
    expect(roundSvg(-0)).toBe(0);
  });
  it('rounds to 3 decimal places', () => {
    expect(roundSvg(1.23456)).toBe(1.235);
    expect(roundSvg(1.2344)).toBe(1.234);
  });
  it('passes exact values through', () => {
    expect(roundSvg(3.14)).toBe(3.14);
  });
});

describe('formatSvg', () => {
  it('serialises 0.0005 as string', () => {
    expect(formatSvg(0.0005)).toBe('0.001');
  });
  it('serialises -0 as "0"', () => {
    expect(formatSvg(-0)).toBe('0');
  });
  it('does not emit trailing zeros', () => {
    expect(formatSvg(3)).toBe('3');
  });
});

describe('roundMm', () => {
  it('rounds 4.5 to 5', () => {
    expect(roundMm(4.5)).toBe(5);
  });
  it('rounds 4.4 to 4', () => {
    expect(roundMm(4.4)).toBe(4);
  });
  it('converts negative zero to positive zero', () => {
    expect(Object.is(roundMm(-0), 0)).toBe(true);
  });
  it('rounds -0.4 to positive zero', () => {
    const result = roundMm(-0.4);
    expect(result).toBe(0);
    expect(Object.is(result, 0)).toBe(true);
  });
  it('rounds negative values correctly', () => {
    expect(roundMm(-3.6)).toBe(-4);
    expect(roundMm(-3.4)).toBe(-3);
  });
});

describe('ceilMm', () => {
  it('ceils 4.01 to 5', () => {
    expect(ceilMm(4.01)).toBe(5);
  });
  it('ceils exact 4 to 4', () => {
    expect(ceilMm(4)).toBe(4);
  });
  it('converts negative zero to positive zero', () => {
    expect(Object.is(ceilMm(-0), 0)).toBe(true);
  });
  it('ceils -0.01 to positive zero', () => {
    const result = ceilMm(-0.01);
    expect(result).toBe(0);
    expect(Object.is(result, 0)).toBe(true);
  });
  it('ceils negative values toward zero', () => {
    expect(ceilMm(-3.1)).toBe(-3);
    expect(ceilMm(-3.9)).toBe(-3);
  });
});

describe('roundHalfAwayFromZero — additional edge cases', () => {
  it('handles large positive integer', () => {
    expect(roundHalfAwayFromZero(1e10)).toBe(1e10);
  });

  it('handles large negative integer', () => {
    expect(roundHalfAwayFromZero(-1e10)).toBe(-1e10);
  });

  it('rounds -1.5 to -2 (away from zero)', () => {
    expect(roundHalfAwayFromZero(-1.5)).toBe(-2);
  });

  it('zero returns zero', () => {
    expect(roundHalfAwayFromZero(0)).toBe(0);
  });
});

describe('roundSvg — additional edge cases', () => {
  it('preserves integer values', () => {
    expect(roundSvg(42)).toBe(42);
  });

  it('rounds negative 3-decimal value', () => {
    expect(roundSvg(-1.23456)).toBe(-1.235);
  });
});

describe('formatSvg — additional edge cases', () => {
  it('serialises negative value', () => {
    expect(formatSvg(-1.23456)).toBe('-1.235');
  });

  it('serialises zero as "0"', () => {
    expect(formatSvg(0)).toBe('0');
  });
});

describe('ceilMm — additional edge cases', () => {
  it('exact negative integer stays unchanged', () => {
    expect(ceilMm(-5)).toBe(-5);
  });
});
