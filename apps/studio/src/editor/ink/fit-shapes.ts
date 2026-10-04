import type { Point } from '@azimut/core-model';
import { quantizeAngle, quantizePoint, quantizePosition } from '@azimut/core-model';
import {
  centroid, directionDeg, distance, intersectLines, lineAngleGap, nearestMultiple,
  pointAt, simplify,
} from './stroke-geometry.js';

/**
 * J1.2 et J1.3 (partie J) — ajuster une forme sur un trait.
 *
 * « Le redressement s'applique à la forme entière, pas segment par segment. »
 * Les côtés d'un contour sont redressés ensemble, sur une même orientation de
 * référence, puis les sommets se recalculent à l'intersection des côtés
 * redressés : un rectangle tracé à main levée reste un rectangle, et ses
 * angles proches de l'angle droit le deviennent tous à la fois.
 *
 * Toute forme rendue est quantifiée au millimètre (J1.1, quatrième temps).
 */

export type SegmentFit = {
  readonly from: Point;
  readonly to: Point;
  readonly constraint: 'free' | 'axis' | 'angle';
};

/** Segment droit entre les deux bouts du trait, contraint si l'angle s'y prête. */
export function fitSegment(
  from: Point, to: Point,
  limits: { readonly axis_deg: number; readonly angle_deg: number; readonly angleStep_deg: number },
): SegmentFit {
  const deg = directionDeg(from, to);
  const length = distance(from, to);
  const axis = nearestMultiple(deg, 90);
  const remarkable = nearestMultiple(deg, limits.angleStep_deg);
  const [direction, constraint]: readonly [number, SegmentFit['constraint']] =
    Math.abs(deg - axis) <= limits.axis_deg ? [axis, 'axis']
    : Math.abs(deg - remarkable) <= limits.angle_deg ? [remarkable, 'angle']
    : [deg, 'free'];
  const start = quantizePoint(from);
  return { from: start, to: quantizePoint(pointAt(start, direction, length)), constraint };
}

export type PolygonFit = {
  readonly vertices: readonly Point[];
  /** Tous les côtés sont-ils parallèles ou perpendiculaires à la référence ? */
  readonly orthogonal: boolean;
};

type Side = { readonly through: Point; readonly deg: number };

/** Les sommets d'un trait fermé, sans le point de fermeture. */
function corners(ring: readonly Point[], vertex_m: number): readonly Point[] {
  const closed = [...ring];
  const first = closed[0];
  if (first !== undefined) closed.push(first);
  const kept = simplify(closed, vertex_m);
  return kept.slice(0, Math.max(kept.length - 1, 0));
}

/**
 * Polygone redressé. `null` si le trait n'a pas trois sommets distincts.
 */
export function fitPolygon(
  ring: readonly Point[],
  limits: { readonly vertex_m: number; readonly axis_deg: number; readonly right_angle_deg: number },
): PolygonFit | null {
  const raw = corners(ring, limits.vertex_m);
  if (raw.length < 3) return null;

  const sides = raw.map((a, i): Side & { readonly length: number } => {
    const b = raw[(i + 1) % raw.length] ?? a;
    return {
      through: { x_m: (a.x_m + b.x_m) / 2, y_m: (a.y_m + b.y_m) / 2 },
      deg: directionDeg(a, b),
      length: distance(a, b),
    };
  });

  // L'orientation de référence : celle du plus long côté, posée sur l'axe si
  // elle en est proche.
  const longest = sides.reduce((best, s) => (s.length > best.length ? s : best));
  const reference = lineAngleGap(longest.deg, nearestMultiple(longest.deg, 90)) <= limits.axis_deg
    ? 0 : longest.deg % 90;

  let orthogonal = true;
  const snapped: Side[] = sides.map(s => {
    if (lineAngleGap(s.deg, reference) <= limits.right_angle_deg) return { through: s.through, deg: reference };
    if (lineAngleGap(s.deg, reference + 90) <= limits.right_angle_deg) {
      return { through: s.through, deg: reference + 90 };
    }
    orthogonal = false;
    return { through: s.through, deg: s.deg };
  });

  // Deux côtés consécutifs redressés sur la même orientation n'en font qu'un.
  const merged: Side[] = [];
  for (const side of snapped) {
    const previous = merged[merged.length - 1];
    if (previous !== undefined && lineAngleGap(previous.deg, side.deg) < 1e-9) {
      merged[merged.length - 1] = {
        through: { x_m: (previous.through.x_m + side.through.x_m) / 2, y_m: (previous.through.y_m + side.through.y_m) / 2 },
        deg: previous.deg,
      };
    } else {
      merged.push(side);
    }
  }
  const head = merged[0];
  const tail = merged[merged.length - 1];
  if (merged.length > 1 && head !== undefined && tail !== undefined && lineAngleGap(head.deg, tail.deg) < 1e-9) {
    merged[0] = {
      through: { x_m: (head.through.x_m + tail.through.x_m) / 2, y_m: (head.through.y_m + tail.through.y_m) / 2 },
      deg: head.deg,
    };
    merged.pop();
  }
  if (merged.length < 3) return null;

  const vertices: Point[] = [];
  for (let i = 0; i < merged.length; i += 1) {
    const before = merged[(i + merged.length - 1) % merged.length];
    const after = merged[i];
    if (before === undefined || after === undefined) return null;
    const corner = intersectLines(before.through, before.deg, after.through, after.deg);
    if (corner === null) return null;
    vertices.push(quantizePoint(corner));
  }
  return { vertices, orthogonal };
}

export type EllipseFit = {
  readonly center: Point;
  readonly rx_m: number;
  readonly ry_m: number;
  readonly rotation_deg: number;
  readonly circle: boolean;
  /** Écart moyen du trait au contour ajusté, rapporté au rayon. */
  readonly error: number;
};

/**
 * Ellipse ajustée par les moments du trait : centre, axes principaux, rayons.
 * `null` si le trait est dégénéré (aplati sur une droite).
 */
export function fitEllipse(ring: readonly Point[], circle_ratio: number): EllipseFit | null {
  if (ring.length < 5) return null;
  const c = centroid(ring);
  let sxx = 0; let syy = 0; let sxy = 0;
  for (const p of ring) {
    const dx = p.x_m - c.x_m; const dy = p.y_m - c.y_m;
    sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
  }
  sxx /= ring.length; syy /= ring.length; sxy /= ring.length;
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const mean = (sxx + syy) / 2;
  const spread = Math.hypot((sxx - syy) / 2, sxy);
  const major = Math.sqrt(2 * (mean + spread));
  const minor = Math.sqrt(2 * Math.max(mean - spread, 0));
  if (minor === 0 || major === 0) return null;

  const cos = Math.cos(theta); const sin = Math.sin(theta);
  let error = 0;
  for (const p of ring) {
    const dx = p.x_m - c.x_m; const dy = p.y_m - c.y_m;
    const u = (dx * cos + dy * sin) / major;
    const v = (-dx * sin + dy * cos) / minor;
    error += Math.abs(Math.hypot(u, v) - 1);
  }
  error /= ring.length;

  const isCircle = (major - minor) / major <= circle_ratio;
  const radius = (major + minor) / 2;
  return {
    center: quantizePoint(c),
    rx_m: quantizePosition(isCircle ? radius : major),
    ry_m: quantizePosition(isCircle ? radius : minor),
    rotation_deg: isCircle ? 0 : quantizeAngle((theta * 180) / Math.PI),
    circle: isCircle,
    error,
  };
}
