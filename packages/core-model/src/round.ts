/**
 * D1.4 — Single rounding module. Never reimplement these elsewhere.
 */

const SVG_DECIMALS = 3;
const SVG_FACTOR = 10 ** SVG_DECIMALS;

function eliminateNegativeZero(v: number): number {
  return v === 0 ? 0 : v;
}

/**
 * The single rounding primitive (D1.4): nearest, ties resolved away from zero.
 * Every other rounding here delegates to it — none reimplements the tie rule.
 */
export function roundHalfAwayFromZero(value: number): number {
  if (value >= 0) return eliminateNegativeZero(Math.round(value));
  return eliminateNegativeZero(-Math.round(-value));
}

export function roundSvg(value: number): number {
  return eliminateNegativeZero(
    roundHalfAwayFromZero(value * SVG_FACTOR) / SVG_FACTOR,
  );
}

export function formatSvg(value: number): string {
  return String(roundSvg(value));
}

/** Nearest integer millimetre (ties away from zero, per D1.4). */
export function roundMm(value: number): number {
  return roundHalfAwayFromZero(value);
}

export function ceilMm(value: number): number {
  return eliminateNegativeZero(Math.ceil(value));
}
