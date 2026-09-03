import { describe, it, expect } from 'vitest';
import { themePapier, stateColors, isoTokens, allTokens } from '../tokens.js';

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;

describe('themePapier', () => {
  it('contains core surface/border/text/accent keys', () => {
    expect(themePapier['surface-page']).toBeDefined();
    expect(themePapier['surface-panel']).toBeDefined();
    expect(themePapier['border']).toBeDefined();
    expect(themePapier['text-primary']).toBeDefined();
    expect(themePapier['text-secondary']).toBeDefined();
    expect(themePapier['accent']).toBeDefined();
  });

  it('all values are valid hex colors', () => {
    for (const [key, val] of Object.entries(themePapier)) {
      expect(HEX_PATTERN.test(val)).toBe(true);
      if (!HEX_PATTERN.test(val)) {
        throw new Error(`${key} is not a valid hex color: ${val}`);
      }
    }
  });
});

describe('stateColors', () => {
  it('has blocking, warning, valid, info', () => {
    expect(stateColors['state-blocking']).toBeDefined();
    expect(stateColors['state-warning']).toBeDefined();
    expect(stateColors['state-valid']).toBeDefined();
    expect(stateColors['state-info']).toBeDefined();
  });

  it('all values are valid hex colors', () => {
    for (const [key, val] of Object.entries(stateColors)) {
      expect(HEX_PATTERN.test(val)).toBe(true);
      if (!HEX_PATTERN.test(val)) {
        throw new Error(`${key} is not a valid hex color: ${val}`);
      }
    }
  });

  it('all four state colors are distinct', () => {
    const values = Object.values(stateColors);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('isoTokens', () => {
  it('iso-adjacent-opacity is between 0 and 1', () => {
    expect(isoTokens['iso-adjacent-opacity']).toBeGreaterThan(0);
    expect(isoTokens['iso-adjacent-opacity']).toBeLessThanOrEqual(1);
  });

  it('iso-exploded-offset-m is positive', () => {
    expect(isoTokens['iso-exploded-offset-m']).toBeGreaterThan(0);
  });
});

describe('allTokens', () => {
  it('merges themePapier and stateColors', () => {
    const paKeys = Object.keys(themePapier);
    const stKeys = Object.keys(stateColors);
    for (const k of [...paKeys, ...stKeys]) {
      expect(k in allTokens).toBe(true);
    }
  });

  it('has no duplicate keys between theme and state', () => {
    const paKeys = new Set(Object.keys(themePapier));
    const stKeys = Object.keys(stateColors);
    for (const k of stKeys) {
      expect(paKeys.has(k)).toBe(false);
    }
  });
});
