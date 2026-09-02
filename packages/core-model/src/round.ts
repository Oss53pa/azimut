/**
 * D1.4 — Single rounding module. Never reimplement these elsewhere.
 */

const SVG_DECIMALS = 3;
const SVG_FACTOR = 10 ** SVG_DECIMALS;

function eliminateNegativeZero(v: number): number {
  return v === 0 ? 0 : v;
}

export function roundHalfAwayFromZero(value: number): number {
  if (value >= 0) return eliminateNegativeZero(Math.round(value));
  return eliminateNegativeZero(-Math.round(-value));
}

export function roundSvg(value: number): number {
  const shifted = value * SVG_FACTOR;
  const rounded = shifted >= 0
    ? Math.round(shifted)
    : -Math.round(-shifted);
  return eliminateNegativeZero(rounded / SVG_FACTOR);
}

export function formatSvg(value: number): string {
  return String(roundSvg(value));
}

export function roundMm(value: number): number {
  return eliminateNegativeZero(Math.round(value));
}

export function ceilMm(value: number): number {
  return eliminateNegativeZero(Math.ceil(value));
}
