/**
 * D1.3 — Compass convention. 0 = north, clockwise, stored in [0, 360).
 */

export function normalizeAzimuth(deg: number): number {
  const mod = deg % 360;
  return mod < 0 ? mod + 360 : mod === 0 ? 0 : mod;
}
