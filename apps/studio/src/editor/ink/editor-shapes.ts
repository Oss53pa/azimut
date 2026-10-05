import type { Point } from '@azimut/core-model';
import type { EllipseCommandData, RectCommandData } from '../command-integration.js';
import { recognize } from './recognize.js';
import { DEFAULT_ANGLE_STEP_DEG, RECOGNITION_THRESHOLDS } from './recognition-thresholds.js';
import type { Strictness } from './recognition-thresholds.js';
import { toleranceFor } from './pointer-kind.js';

/**
 * J1.2 (partie J) — les formes de l'éditeur d'habillage (E7) tracées au
 * stylet : « cercle ou ovale approximatif : ellipse, cercle si proche », et
 * « rectangle approximatif : rectangle, angles droits ».
 *
 * L'ellipse d'abord, où elle est une forme.
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

/**
 * J1.2 — « Rectangle approximatif : rectangle, angles droits », avec l'outil
 * Rectangle de l'éditeur d'habillage. Le rectangle de l'éditeur est posé sur
 * les axes, comme l'ellipse : un rectangle tracé de biais n'est pas redressé
 * d'office.
 */
export type RectReading =
  | { readonly kind: 'rect'; readonly data: RectCommandData }
  | { readonly kind: 'oblique' }
  | { readonly kind: 'unrecognized' };

export function strokeToEditorRect(
  points: readonly Point[],
  context: { readonly pxPerMeter: number; readonly strictness: Strictness },
): RectReading {
  const candidate = recognize(points, {
    pxPerMeter: context.pxPerMeter,
    strictness: context.strictness,
    angleStep_deg: DEFAULT_ANGLE_STEP_DEG,
    hit_px: toleranceFor('pen').select_px,
    nodes: [],
    shapes: [],
  }).find(c => c.kind === 'rectangle');
  if (candidate?.kind !== 'rectangle') return { kind: 'unrecognized' };

  const [a, b] = candidate.vertices;
  if (a === undefined || b === undefined) return { kind: 'unrecognized' };
  const axis = RECOGNITION_THRESHOLDS[context.strictness].axis_deg;
  const turn = ((((Math.atan2(b.y_m - a.y_m, b.x_m - a.x_m) * 180) / Math.PI) % 90) + 90) % 90;
  if (turn > axis && 90 - turn > axis) return { kind: 'oblique' };

  const xs = candidate.vertices.map(v => v.x_m);
  const ys = candidate.vertices.map(v => v.y_m);
  return {
    kind: 'rect',
    data: {
      kind: 'rect',
      origin: { x_m: Math.min(...xs), y_m: Math.min(...ys) },
      corner: { x_m: Math.max(...xs), y_m: Math.max(...ys) },
    },
  };
}
