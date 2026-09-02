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
});
