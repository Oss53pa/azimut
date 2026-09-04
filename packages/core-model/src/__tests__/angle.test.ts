import { describe, it, expect } from 'vitest';
import { normalizeAzimuth } from '../index.js';

describe('normalizeAzimuth — D1.3 compass convention', () => {
  it('keeps 0 as 0', () => {
    expect(normalizeAzimuth(0)).toBe(0);
  });
  it('keeps 90 as 90', () => {
    expect(normalizeAzimuth(90)).toBe(90);
  });
  it('normalizes 360 to 0', () => {
    expect(normalizeAzimuth(360)).toBe(0);
  });
  it('normalizes 720 to 0', () => {
    expect(normalizeAzimuth(720)).toBe(0);
  });
  it('normalizes -90 to 270', () => {
    expect(normalizeAzimuth(-90)).toBe(270);
  });
  it('normalizes -180 to 180', () => {
    expect(normalizeAzimuth(-180)).toBe(180);
  });
  it('normalizes 450 to 90', () => {
    expect(normalizeAzimuth(450)).toBe(90);
  });
  it('handles -0', () => {
    expect(normalizeAzimuth(-0)).toBe(0);
  });
  it('preserves small fractional value', () => {
    expect(normalizeAzimuth(0.001)).toBeCloseTo(0.001, 10);
  });
  it('preserves value just below 360', () => {
    expect(normalizeAzimuth(359.999)).toBeCloseTo(359.999, 10);
  });
  it('normalizes 3600 to 0', () => {
    expect(normalizeAzimuth(3600)).toBe(0);
  });
  it('normalizes small negative to near 360', () => {
    expect(normalizeAzimuth(-0.001)).toBeCloseTo(359.999, 10);
  });
  it('normalizes -360 to 0 (not -0)', () => {
    expect(normalizeAzimuth(-360)).toBe(0);
    expect(Object.is(normalizeAzimuth(-360), -0)).toBe(false);
  });
  it('normalizes -720 to 0 (not -0)', () => {
    expect(normalizeAzimuth(-720)).toBe(0);
    expect(Object.is(normalizeAzimuth(-720), -0)).toBe(false);
  });
  it('returns NaN for NaN input', () => {
    expect(normalizeAzimuth(NaN)).toBeNaN();
  });
  it('returns NaN for Infinity input', () => {
    expect(normalizeAzimuth(Infinity)).toBeNaN();
  });
  it('returns NaN for -Infinity input', () => {
    expect(normalizeAzimuth(-Infinity)).toBeNaN();
  });

  it('normalizes very large positive value', () => {
    const result = normalizeAzimuth(99999);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(360);
    expect(result).toBeCloseTo(99999 % 360, 10);
  });

  it('normalizes very large negative value', () => {
    const result = normalizeAzimuth(-99999);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(360);
  });

  it('normalizes negative just below zero (-360.001)', () => {
    const result = normalizeAzimuth(-360.001);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(360);
    expect(result).toBeCloseTo(359.999, 3);
  });
});
