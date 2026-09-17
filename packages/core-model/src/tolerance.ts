/**
 * D1.5 — Technical tolerances. Not normative values.
 */

export const POINT_COINCIDENCE_M = 0.001;

export const ANGLE_EQUALITY_DEG = 0.01;

export const EDGE_MIN_LENGTH_M = 0.01;

export const POLYGON_MIN_AREA_M2 = 0.0001;

/**
 * Écart admis sur la somme d'un jeu de parts qui doit valoir l'unité.
 *
 * Purement flottant : additionner n fois 1/n ne rend pas exactement 1. Ce
 * n'est pas une marge de tolérance métier — 33,3 + 33,3 + 33,3 doit être
 * refusé, et il l'est, l'écart valant 1e-3.
 */
export const WEIGHT_SUM_TOLERANCE = 1e-9;
