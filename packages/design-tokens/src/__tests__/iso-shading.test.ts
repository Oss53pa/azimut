import { describe, it, expect } from 'vitest';
import { isoFaceShading, deriveIsoFaceTints } from '../iso-shading.js';
import { relativeLuminance } from '../contrast.js';

// A mid brown base volume colour (this file is under design-tokens, exempt from
// the no-hardcoded-colors scanner).
const BASE = '#8A6C48';

describe('D5.3 — iso face shading', () => {
  it('declares three fixed darkening factors, top brightest', () => {
    expect(isoFaceShading['iso-shade-top']).toBe(1);
    expect(isoFaceShading['iso-shade-left']).toBeLessThan(isoFaceShading['iso-shade-top']);
    expect(isoFaceShading['iso-shade-right']).toBeLessThan(isoFaceShading['iso-shade-left']);
  });

  it('the top face keeps the base colour (factor 1)', () => {
    expect(deriveIsoFaceTints(BASE).top.toLowerCase()).toBe(BASE.toLowerCase());
  });

  it('left and right faces are progressively darker than the top', () => {
    const t = deriveIsoFaceTints(BASE);
    const lumTop = relativeLuminance(t.top);
    const lumLeft = relativeLuminance(t.left);
    const lumRight = relativeLuminance(t.right);
    expect(lumLeft).toBeLessThan(lumTop);
    expect(lumRight).toBeLessThan(lumLeft);
  });

  it('produces valid 6-digit hex', () => {
    const t = deriveIsoFaceTints(BASE);
    for (const c of [t.top, t.left, t.right]) {
      expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('is deterministic', () => {
    expect(deriveIsoFaceTints(BASE)).toEqual(deriveIsoFaceTints(BASE));
  });
});
