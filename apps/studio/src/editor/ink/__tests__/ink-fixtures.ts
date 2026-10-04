import type { Point } from '@azimut/core-model';
import type { InkContext } from '../recognize.js';

/**
 * Traits « à main levée » déterministes : le tremblement est une somme de
 * sinus, jamais un tirage. Un même appel rend toujours le même trait.
 */

/** Tremblement perpendiculaire, d'amplitude `wobble_m`. */
function tremor(i: number, wobble_m: number): number {
  return wobble_m * (Math.sin(i * 1.7) * 0.6 + Math.sin(i * 0.43 + 1) * 0.4);
}

/** Un trait de `a` à `b`, en `n` points, qui tremble de `wobble_m`. */
export function stroke(a: Point, b: Point, n = 40, wobble_m = 0): Point[] {
  const dx = b.x_m - a.x_m; const dy = b.y_m - a.y_m;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len; const ny = dx / len;
  const points: Point[] = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const w = i === 0 || i === n ? 0 : tremor(i, wobble_m);
    points.push({ x_m: a.x_m + dx * t + nx * w, y_m: a.y_m + dy * t + ny * w });
  }
  return points;
}

/** Un contour fermé passant par `corners`, chaque côté tremblant de `wobble_m`. */
export function loop(corners: readonly Point[], perSide = 20, wobble_m = 0): Point[] {
  const points: Point[] = [];
  corners.forEach((a, i) => {
    const b = corners[(i + 1) % corners.length] ?? a;
    const side = stroke(a, b, perSide, wobble_m);
    points.push(...side.slice(0, -1));
  });
  const first = points[0];
  if (first !== undefined) points.push(first);
  return points;
}

/** Une ellipse tracée en `n` points, qui tremble de `wobble_m` sur le rayon. */
export function ellipseStroke(
  center: Point, rx_m: number, ry_m: number, rotation_deg = 0, n = 80, wobble_m = 0,
): Point[] {
  const r = (rotation_deg * Math.PI) / 180;
  const points: Point[] = [];
  for (let i = 0; i <= n; i += 1) {
    const t = (i / n) * 2 * Math.PI;
    const w = i === n ? 0 : tremor(i, wobble_m);
    const x = (rx_m + w) * Math.cos(t);
    const y = (ry_m + w) * Math.sin(t);
    points.push({
      x_m: center.x_m + x * Math.cos(r) - y * Math.sin(r),
      y_m: center.y_m + x * Math.sin(r) + y * Math.cos(r),
    });
  }
  return points;
}

/** Fait tourner des points autour de l'origine. */
export function rotate(points: readonly Point[], deg: number): Point[] {
  const r = (deg * Math.PI) / 180;
  return points.map(p => ({
    x_m: p.x_m * Math.cos(r) - p.y_m * Math.sin(r),
    y_m: p.x_m * Math.sin(r) + p.y_m * Math.cos(r),
  }));
}

/** Contexte de vue ordinaire : 20 pixels par mètre, stylet, seuils « normal ». */
export function context(overrides: Partial<InkContext> = {}): InkContext {
  return {
    pxPerMeter: 20,
    strictness: 'normal',
    angleStep_deg: 15,
    hit_px: 3,
    nodes: [],
    shapes: [],
    ...overrides,
  };
}

/** Une valeur est-elle un nombre entier de millimètres ? */
export function isMillimetre(value: number): boolean {
  return Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-6;
}

export function allMillimetre(points: readonly Point[]): boolean {
  return points.every(p => isMillimetre(p.x_m) && isMillimetre(p.y_m));
}
