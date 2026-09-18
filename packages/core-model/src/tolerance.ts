/**
 * D1.5 — Technical tolerances. Not normative values.
 */

export const POINT_COINCIDENCE_M = 0.001;

export const ANGLE_EQUALITY_DEG = 0.01;

export const EDGE_MIN_LENGTH_M = 0.01;

export const POLYGON_MIN_AREA_M2 = 0.0001;

/**
 * Écart admis entre la somme d'un jeu de parts et l'unité.
 *
 * Purement numérique : trois tiers additionnés en virgule flottante donnent
 * 0.9999999999999999, et refuser cette déclaration serait refuser
 * l'arithmétique de la machine, pas une erreur de saisie. Le seuil reste six
 * ordres de grandeur sous la plus petite part qu'on puisse vouloir déclarer —
 * un millième — donc aucune part omise ne passe au travers.
 */
export const SHARE_SUM_TOLERANCE = 1e-9;
