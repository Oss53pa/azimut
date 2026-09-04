import { describe, it, expect } from 'vitest';
import { bearingToCardinal } from '../resolve-face.js';

function node(x: number, y: number) {
  return {
    id: 'n',
    org_id: 'org',
    level_id: 'l',
    kind: 'junction' as const,
    position: { x_m: x, y_m: y },
    label: '',
  };
}

const origin = node(0, 0);

describe('bearingToCardinal boundary values', () => {
  it('co-located nodes return N as fallback', () => {
    expect(bearingToCardinal(origin, origin)).toBe('N');
  });

  it.each([
    [0, 1, 'N'],
    [1, 1, 'NE'],
    [1, 0, 'E'],
    [1, -1, 'SE'],
    [0, -1, 'S'],
    [-1, -1, 'SW'],
    [-1, 0, 'W'],
    [-1, 1, 'NW'],
  ])(
    'exact cardinal: dx=%d dy=%d → %s',
    (dx, dy, expected) => {
      expect(bearingToCardinal(origin, node(dx, dy))).toBe(expected);
    },
  );

  it('boundary 22.5° is accepted as N or NE', () => {
    const rad = (22.5 * Math.PI) / 180;
    const target = node(Math.sin(rad), Math.cos(rad));
    // JS Math.round(0.5) = 1 → index 1 → NE
    const result = bearingToCardinal(origin, target);
    expect(['N', 'NE']).toContain(result);
  });

  it('just below boundary (22°) stays N', () => {
    const rad = (22 * Math.PI) / 180;
    const target = node(Math.sin(rad), Math.cos(rad));
    expect(bearingToCardinal(origin, target)).toBe('N');
  });

  it('just above boundary (23°) becomes NE', () => {
    const rad = (23 * Math.PI) / 180;
    const target = node(Math.sin(rad), Math.cos(rad));
    expect(bearingToCardinal(origin, target)).toBe('NE');
  });

  it('bearing near 360° wraps to N', () => {
    const rad = (350 * Math.PI) / 180;
    const target = node(Math.sin(rad), Math.cos(rad));
    expect(bearingToCardinal(origin, target)).toBe('N');
  });

  it('bearing 337° rounds to NW', () => {
    const rad = (337 * Math.PI) / 180;
    const target = node(Math.sin(rad), Math.cos(rad));
    expect(bearingToCardinal(origin, target)).toBe('NW');
  });

  it('bearing 338° rounds to N (wrap via %8)', () => {
    const rad = (338 * Math.PI) / 180;
    const target = node(Math.sin(rad), Math.cos(rad));
    expect(bearingToCardinal(origin, target)).toBe('N');
  });

  it('very small positive displacement returns N', () => {
    expect(bearingToCardinal(origin, node(0, 0.001))).toBe('N');
  });

  it('bearing near 180° (due south) returns S', () => {
    expect(bearingToCardinal(origin, node(0, -1))).toBe('S');
    // Also via trigonometric displacement near 180°
    const rad = (179 * Math.PI) / 180;
    expect(bearingToCardinal(origin, node(Math.sin(rad), Math.cos(rad)))).toBe('S');
  });

  it('boundary near E/SE (112° → E, 113° → SE)', () => {
    const rad112 = (112 * Math.PI) / 180;
    const rad113 = (113 * Math.PI) / 180;
    expect(bearingToCardinal(origin, node(Math.sin(rad112), Math.cos(rad112)))).toBe('E');
    expect(bearingToCardinal(origin, node(Math.sin(rad113), Math.cos(rad113)))).toBe('SE');
  });

  it('very large displacement returns correct cardinal', () => {
    expect(bearingToCardinal(origin, node(0, 1e6))).toBe('N');
    expect(bearingToCardinal(origin, node(0, -1e6))).toBe('S');
    expect(bearingToCardinal(origin, node(1e6, 0))).toBe('E');
    expect(bearingToCardinal(origin, node(-1e6, 0))).toBe('W');
  });

  it('boundary near SW/W (247° → SW, 248° → W)', () => {
    const rad247 = (247 * Math.PI) / 180;
    const rad248 = (248 * Math.PI) / 180;
    expect(bearingToCardinal(origin, node(Math.sin(rad247), Math.cos(rad247)))).toBe('SW');
    expect(bearingToCardinal(origin, node(Math.sin(rad248), Math.cos(rad248)))).toBe('W');
  });
});
