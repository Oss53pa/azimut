import { describe, it, expect } from 'vitest';
import {
  themePapier,
  themeInstrument,
  stateColorsPapier,
  stateColorsInstrument,
  isoTokens,
  allTokens,
  kioskTokens,
  kioskTokensHighContrast,
  radii,
  durations,
} from '../tokens.js';

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;

describe('themePapier', () => {
  it('contains all Partie F surface/border/text/accent keys', () => {
    expect(themePapier['surface-page']).toBeDefined();
    expect(themePapier['surface-panel']).toBeDefined();
    expect(themePapier['surface-canvas']).toBeDefined();
    expect(themePapier['surface-sunken']).toBeDefined();
    expect(themePapier['border-hairline']).toBeDefined();
    expect(themePapier['border-strong']).toBeDefined();
    expect(themePapier['border-interactive']).toBeDefined();
    expect(themePapier['text-primary']).toBeDefined();
    expect(themePapier['text-secondary']).toBeDefined();
    expect(themePapier['text-muted']).toBeDefined();
    expect(themePapier['accent']).toBeDefined();
    expect(themePapier['accent-soft']).toBeDefined();
    expect(themePapier['accent-secondary']).toBeDefined();
  });

  it('all values are valid hex colors', () => {
    for (const [key, val] of Object.entries(themePapier)) {
      expect(HEX_PATTERN.test(val), `${key}: ${val}`).toBe(true);
    }
  });
});

describe('themeInstrument', () => {
  it('has the same keys as themePapier', () => {
    const papierKeys = Object.keys(themePapier).sort();
    const instrumentKeys = Object.keys(themeInstrument).sort();
    expect(instrumentKeys).toEqual(papierKeys);
  });

  it('all values are valid hex colors', () => {
    for (const [key, val] of Object.entries(themeInstrument)) {
      expect(HEX_PATTERN.test(val), `${key}: ${val}`).toBe(true);
    }
  });

  it('canvas surface is identical across themes', () => {
    expect(themeInstrument['surface-canvas']).toBe(themePapier['surface-canvas']);
  });
});

describe('stateColorsPapier', () => {
  it('has blocking, warning, valid, info', () => {
    expect(stateColorsPapier['state-blocking']).toBeDefined();
    expect(stateColorsPapier['state-warning']).toBeDefined();
    expect(stateColorsPapier['state-valid']).toBeDefined();
    expect(stateColorsPapier['state-info']).toBeDefined();
  });

  it('all values are valid hex colors', () => {
    for (const [key, val] of Object.entries(stateColorsPapier)) {
      expect(HEX_PATTERN.test(val), `${key}: ${val}`).toBe(true);
    }
  });

  it('all four state colors are distinct', () => {
    const values = Object.values(stateColorsPapier);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('stateColorsInstrument', () => {
  it('has the same keys as stateColorsPapier', () => {
    const pKeys = Object.keys(stateColorsPapier).sort();
    const iKeys = Object.keys(stateColorsInstrument).sort();
    expect(iKeys).toEqual(pKeys);
  });

  it('all values are valid hex colors', () => {
    for (const [key, val] of Object.entries(stateColorsInstrument)) {
      expect(HEX_PATTERN.test(val), `${key}: ${val}`).toBe(true);
    }
  });

  it('values differ from Papier (adjusted for dark bg)', () => {
    for (const key of Object.keys(stateColorsPapier) as Array<keyof typeof stateColorsPapier>) {
      expect(stateColorsInstrument[key]).not.toBe(stateColorsPapier[key]);
    }
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
  it('merges themePapier and stateColorsPapier', () => {
    const paKeys = Object.keys(themePapier);
    const stKeys = Object.keys(stateColorsPapier);
    for (const k of [...paKeys, ...stKeys]) {
      expect(k in allTokens).toBe(true);
    }
  });

  it('has no duplicate keys between theme and state', () => {
    const paKeys = new Set(Object.keys(themePapier));
    const stKeys = Object.keys(stateColorsPapier);
    for (const k of stKeys) {
      expect(paKeys.has(k)).toBe(false);
    }
  });
});

describe('kioskTokens', () => {
  it('has bg, fg, line, sunken', () => {
    expect(kioskTokens['k-bg']).toBeDefined();
    expect(kioskTokens['k-fg']).toBeDefined();
    expect(kioskTokens['k-line']).toBeDefined();
    expect(kioskTokens['k-sunken']).toBeDefined();
  });

  it('high contrast inverts to pure black/white', () => {
    expect(kioskTokensHighContrast['k-bg']).toBe('#000000');
    expect(kioskTokensHighContrast['k-fg']).toBe('#FFFFFF');
  });
});

describe('radii (F2.2)', () => {
  it('has exactly three values', () => {
    expect(Object.keys(radii)).toHaveLength(3);
  });

  it('none is 0, small is 4, floating is 6', () => {
    expect(radii.none).toBe(0);
    expect(radii.small).toBe(4);
    expect(radii.floating).toBe(6);
  });
});

describe('durations (F11)', () => {
  it('has exactly three values', () => {
    expect(Object.keys(durations)).toHaveLength(3);
  });

  it('state 120, float 200, panel 240', () => {
    expect(durations.state).toBe(120);
    expect(durations.float).toBe(200);
    expect(durations.panel).toBe(240);
  });
});
