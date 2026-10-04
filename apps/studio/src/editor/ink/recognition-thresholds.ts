/**
 * J1.3 (partie J) — les seuils de la reconnaissance de forme.
 *
 * « Seuils de tolérance déclarés en constantes nommées, réglables. Ces seuils
 * sont des paramètres d'ergonomie, jamais des valeurs normatives. »
 *
 * Trois niveaux d'intensité, du plus strict au plus permissif, mémorisés par
 * utilisateur. La donnée produite ne dépend jamais du niveau une fois la forme
 * acceptée : elle est toujours quantifiée au millimètre.
 *
 * Les distances sont en pixels écran, comme toute tolérance de geste
 * (partie E) : un trait se juge à la taille où on l'a vu en le traçant.
 */
export type Strictness = 'strict' | 'normal' | 'permissive';

export const STRICTNESS_LEVELS: readonly Strictness[] = ['strict', 'normal', 'permissive'];

export type RecognitionThresholds = {
  /** Longueur de trait sous laquelle le geste est un point appuyé. */
  readonly tap_px: number;
  /** Écart à la corde, rapporté à sa longueur, sous lequel un trait est droit. */
  readonly straightness: number;
  /** Écart admis pour redresser un segment sur un axe. */
  readonly axis_deg: number;
  /** Écart admis pour aligner un segment sur un angle remarquable. */
  readonly angle_deg: number;
  /** Écart admis entre les deux bouts d'un trait pour fermer le contour. */
  readonly close_px: number;
  /** Écart admis pour qu'un angle proche de l'angle droit le devienne. */
  readonly right_angle_deg: number;
  /** Écart sous lequel un détour du trait n'est pas un sommet. */
  readonly vertex_px: number;
  /** Écart moyen au contour, rapporté au rayon, sous lequel le trait est une ellipse. */
  readonly ellipse_fit: number;
  /** Écart relatif des deux rayons sous lequel l'ellipse est un cercle. */
  readonly circle_ratio: number;
};

export const RECOGNITION_THRESHOLDS: Readonly<Record<Strictness, RecognitionThresholds>> = {
  strict: {
    tap_px: 3, straightness: 0.03, axis_deg: 3, angle_deg: 2, close_px: 10,
    right_angle_deg: 5, vertex_px: 4, ellipse_fit: 0.05, circle_ratio: 0.05,
  },
  normal: {
    tap_px: 5, straightness: 0.06, axis_deg: 6, angle_deg: 4, close_px: 18,
    right_angle_deg: 10, vertex_px: 8, ellipse_fit: 0.09, circle_ratio: 0.1,
  },
  permissive: {
    tap_px: 8, straightness: 0.1, axis_deg: 10, angle_deg: 7, close_px: 28,
    right_angle_deg: 15, vertex_px: 12, ellipse_fit: 0.14, circle_ratio: 0.15,
  },
};

/**
 * E (partie E) : « angles multiples d'une valeur réglable ». Pas par défaut
 * des angles remarquables, réglable par l'utilisateur.
 */
export const DEFAULT_ANGLE_STEP_DEG = 15;
