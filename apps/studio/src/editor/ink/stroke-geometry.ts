import type { Point } from '@azimut/core-model';

/**
 * J1 (partie J) — la géométrie d'un trait, sans rien en décider.
 *
 * Fonctions pures sur des points en mètres. Aucune ne lit l'horloge, le DOM ou
 * l'aléatoire : un même trait donne toujours les mêmes mesures.
 */

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x_m - a.x_m, b.y_m - a.y_m);
}

export function pathLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (a !== undefined && b !== undefined) total += distance(a, b);
  }
  return total;
}

/** Distance d'un point à la droite qui passe par `a` et `b`. */
export function distanceToLine(p: Point, a: Point, b: Point): number {
  const len = distance(a, b);
  if (len === 0) return distance(p, a);
  return Math.abs((b.x_m - a.x_m) * (a.y_m - p.y_m) - (a.x_m - p.x_m) * (b.y_m - a.y_m)) / len;
}

/** Le plus grand écart du trait à sa corde, ramené à la longueur de la corde. */
export function chordDeviation(points: readonly Point[]): number {
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) return 0;
  const chord = distance(first, last);
  if (chord === 0) return Number.POSITIVE_INFINITY;
  let worst = 0;
  for (const p of points) worst = Math.max(worst, distanceToLine(p, first, last));
  return worst / chord;
}

/**
 * Ramer–Douglas–Peucker : les sommets qui portent la forme, à `epsilon_m`
 * près. Le premier et le dernier point sont toujours gardés.
 */
export function simplify(points: readonly Point[], epsilon_m: number): readonly Point[] {
  if (points.length < 3) return [...points];
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack: Array<readonly [number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const range = stack.pop();
    if (range === undefined) break;
    const [start, end] = range;
    const a = points[start];
    const b = points[end];
    if (a === undefined || b === undefined) continue;
    let worst = -1;
    let at = -1;
    for (let i = start + 1; i < end; i += 1) {
      const p = points[i];
      if (p === undefined) continue;
      const d = distanceToLine(p, a, b);
      if (d > worst) { worst = d; at = i; }
    }
    if (at !== -1 && worst > epsilon_m) {
      keep[at] = true;
      stack.push([start, at], [at, end]);
    }
  }
  return points.filter((_, i) => keep[i] === true);
}

/** Orientation de `a` vers `b`, en degrés, dans [0, 360). */
export function directionDeg(a: Point, b: Point): number {
  const deg = (Math.atan2(b.y_m - a.y_m, b.x_m - a.x_m) * 180) / Math.PI;
  return deg < 0 ? deg + 360 : deg;
}

/** Écart entre deux orientations de droite, sans tenir compte du sens, dans [0, 90]. */
export function lineAngleGap(a_deg: number, b_deg: number): number {
  const d = Math.abs(a_deg - b_deg) % 180;
  return Math.min(d, 180 - d);
}

/** Le multiple de `step_deg` le plus proche de `deg`. */
export function nearestMultiple(deg: number, step_deg: number): number {
  return Math.round(deg / step_deg) * step_deg;
}

/** Point situé à `length_m` de `origin`, dans la direction `deg`. */
export function pointAt(origin: Point, deg: number, length_m: number): Point {
  const rad = (deg * Math.PI) / 180;
  return { x_m: origin.x_m + Math.cos(rad) * length_m, y_m: origin.y_m + Math.sin(rad) * length_m };
}

/**
 * Intersection de deux droites, données chacune par un point et une
 * orientation. `null` si elles sont parallèles.
 */
export function intersectLines(p: Point, p_deg: number, q: Point, q_deg: number): Point | null {
  const r = (p_deg * Math.PI) / 180;
  const s = (q_deg * Math.PI) / 180;
  const dx1 = Math.cos(r); const dy1 = Math.sin(r);
  const dx2 = Math.cos(s); const dy2 = Math.sin(s);
  const det = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(det) < 1e-12) return null;
  const t = ((q.x_m - p.x_m) * dy2 - (q.y_m - p.y_m) * dx2) / det;
  return { x_m: p.x_m + dx1 * t, y_m: p.y_m + dy1 * t };
}

export function centroid(points: readonly Point[]): Point {
  let x = 0; let y = 0;
  for (const p of points) { x += p.x_m; y += p.y_m; }
  const n = Math.max(points.length, 1);
  return { x_m: x / n, y_m: y / n };
}

/** Le point est-il à l'intérieur du polygone (règle du nombre de croisements) ? */
export function pointInPolygon(p: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if (a === undefined || b === undefined) continue;
    const crosses = (a.y_m > p.y_m) !== (b.y_m > p.y_m)
      && p.x_m < ((b.x_m - a.x_m) * (p.y_m - a.y_m)) / (b.y_m - a.y_m) + a.x_m;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** Les segments [a, b] et [c, d] se coupent-ils ? */
export function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const orient = (p: Point, q: Point, r: Point): number =>
    (q.x_m - p.x_m) * (r.y_m - p.y_m) - (q.y_m - p.y_m) * (r.x_m - p.x_m);
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

/** Le trait traverse-t-il le contour du polygone ? */
export function crossesOutline(a: Point, b: Point, polygon: readonly Point[]): boolean {
  for (let i = 0; i < polygon.length; i += 1) {
    const c = polygon[i];
    const d = polygon[(i + 1) % polygon.length];
    if (c !== undefined && d !== undefined && segmentsCross(a, b, c, d)) return true;
  }
  return false;
}
