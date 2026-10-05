import type { Point } from '@azimut/core-model';
import type { EllipseCommandData } from '../command-integration.js';
import { recognize } from './recognize.js';
import { DEFAULT_ANGLE_STEP_DEG, RECOGNITION_THRESHOLDS } from './recognition-thresholds.js';
import type { Strictness } from './recognition-thresholds.js';
import { toleranceFor } from './pointer-kind.js';

/**
 * J1.2 (partie J) — « Cercle ou ovale approximatif : ellipse, cercle si
 * proche », dans l'éditeur d'habillage (E7), où l'ellipse est une forme.
 *
 * Décision de l'utilisateur du 2026-10-05 : l'ellipse va à l'habillage ; une
 * empreinte reste un polygone. La nature de la forme vient de l'outil actif
 * (J2) : c'est l'outil Ellipse qui lit le trait, et il n'en tire qu'une
 * ellipse.
 *
 * L'ellipse de l'éditeur est posée sur les axes. Un ovale tracé de biais au
 * delà de l'écart admis pour redresser sur un axe n'est donc pas lu : le
 * redresser d'office tournerait la forme que l'on voulait.
 */
export type EllipseReading =
  | { readonly kind: 'ellipse'; readonly data: EllipseCommandData; readonly circle: boolean }
  | { readonly kind: 'oblique' }
  | { readonly kind: 'unrecognized' };

export function strokeToEditorEllipse(
  points: readonly Point[],
  context: { readonly pxPerMeter: number; readonly strictness: Strictness },
): EllipseReading {
  const candidate = recognize(points, {
    pxPerMeter: context.pxPerMeter,
    strictness: context.strictness,
    angleStep_deg: DEFAULT_ANGLE_STEP_DEG,
    hit_px: toleranceFor('pen').select_px,
    nodes: [],
    shapes: [],
  }).find(c => c.kind === 'ellipse');
  if (candidate?.kind !== 'ellipse') return { kind: 'unrecognized' };

  const axis = RECOGNITION_THRESHOLDS[context.strictness].axis_deg;
  const turn = ((candidate.rotation_deg % 180) + 180) % 180;
  const along = candidate.circle || turn <= axis || 180 - turn <= axis;
  const across = !along && Math.abs(turn - 90) <= axis;
  if (!along && !across) return { kind: 'oblique' };
  return {
    kind: 'ellipse',
    circle: candidate.circle,
    data: {
      kind: 'ellipse', center: candidate.center,
      rx_m: across ? candidate.ry_m : candidate.rx_m,
      ry_m: across ? candidate.rx_m : candidate.ry_m,
    },
  };
}
