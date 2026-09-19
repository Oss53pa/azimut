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

/**
 * Arrondit une longueur exprimée en mètres au millimètre.
 *
 * D1.5 pose que deux points distants de moins d'un millimètre sont le même
 * point : une longueur ne veut donc rien dire en deçà, et la garder au
 * millimètre rend une valeur calculée comparable à une valeur écrite. Délègue
 * à la primitive de D1.4, comme tout arrondi de ce module.
 */
export function roundMetres(value: number): number {
  return eliminateNegativeZero(roundHalfAwayFromZero(value * 1000) / 1000);
}

/** Nearest integer millimetre (ties away from zero, per D1.4). */
export function roundMm(value: number): number {
  return roundHalfAwayFromZero(value);
}

export function ceilMm(value: number): number {
  return eliminateNegativeZero(Math.ceil(value));
}
