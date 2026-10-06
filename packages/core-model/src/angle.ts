import type { Point } from './geometry.js';

/**
 * D1.3 — Compass convention. 0 = north, clockwise, stored in [0, 360).
 */

export function normalizeAzimuth(deg: number): number {
  const mod = deg % 360;
  return mod < 0 ? mod + 360 : mod === 0 ? 0 : mod;
}

/**
 * D6.2 — l'orientation d'affichage qui met en haut ce que l'usager regarde,
 * pour un support d'azimut donné (D1.3). Un support d'azimut 90, tourné vers
 * l'est, donne un plan où l'est est en haut. Normalisée dans [0, 360).
 *
 * C'est cette valeur qu'on passe aux rendus orientés, jamais l'azimut brut :
 * la différence de signe est l'inversion que le test décisif D6.4 attrape.
 */
export function orientationDegForAzimuth(azimuthDeg: number): number {
  return ((-azimuthDeg % 360) + 360) % 360;
}

/**
 * D6.2 — un point du site (X est, Y nord, D1.1) dans le repère d'un plan
 * orienté : tourné de `orientationDeg` autour de `center`, puis retourné pour
 * que l'axe des y descende comme celui de l'écran. La rotation est la même
 * pour le plan mural et pour l'itinéraire de la borne : un seul calcul.
 */
export function orientForDisplay(
  p: Point,
  center: Point,
  orientationDeg: number,
): Point {
  const rad = (-orientationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x_m - center.x_m;
  const dy = p.y_m - center.y_m;
  return {
    x_m: center.x_m + dx * cos - dy * sin,
    y_m: -(center.y_m + dx * sin + dy * cos),
  };
}
