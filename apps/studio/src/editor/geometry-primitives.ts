/**
 * E7.4 — Geometry primitives for polygon operations.
 *
 * Pure functions operating in meter-space. No external geometry
 * library (A3.3). Extracted from boolean-ops.ts to keep files
 * under 400 lines (A2.4).
 *
 * Exported functions are consumed by boolean-ops and snap-integration.
 */

import type { Point } from '@azimut/core-model';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Polygon = readonly Point[];

// ---------------------------------------------------------------------------
// Area & winding
// ---------------------------------------------------------------------------

/**
 * Compute signed area of a polygon (shoelace formula).
 * Positive = CCW, negative = CW.
 */
export function signedArea(poly: Polygon): number {
  let area = 0;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const cur = poly[i];
    const next = poly[(i + 1) % n];
    if (cur === undefined || next === undefined) continue;
    area += cur.x_m * next.y_m - next.x_m * cur.y_m;
  }
  return area / 2;
}

/**
 * Absolute area of a polygon.
 */
export function polygonArea(poly: Polygon): number {
  return Math.abs(signedArea(poly));
}

/**
 * Ensure polygon is wound CCW (positive area).
 */
export function ensureCCW(poly: Polygon): Polygon {
  return signedArea(poly) < 0 ? [...poly].reverse() : [...poly];
}

// ---------------------------------------------------------------------------
// Point-in-polygon
// ---------------------------------------------------------------------------

/**
 * Check if a point is inside a polygon (ray casting).
 */
export function pointInPolygon(p: Point, poly: Polygon): boolean {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const pi = poly[i];
    const pj = poly[j];
    if (pi === undefined || pj === undefined) continue;

    if (
      (pi.y_m > p.y_m) !== (pj.y_m > p.y_m) &&
      p.x_m < ((pj.x_m - pi.x_m) * (p.y_m - pi.y_m)) / (pj.y_m - pi.y_m) + pi.x_m
    ) {
      inside = !inside;
    }
  }
  return inside;
}

// ---------------------------------------------------------------------------
// Segment intersection
// ---------------------------------------------------------------------------

/**
 * Segment-segment intersection.
 * Returns null if segments don't intersect, or the intersection point.
 */
export function segmentIntersection(
  a1: Point, a2: Point,
  b1: Point, b2: Point,
): Point | null {
  const d1x = a2.x_m - a1.x_m;
  const d1y = a2.y_m - a1.y_m;
  const d2x = b2.x_m - b1.x_m;
  const d2y = b2.y_m - b1.y_m;

  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-12) return null; // parallel

  const t = ((b1.x_m - a1.x_m) * d2y - (b1.y_m - a1.y_m) * d2x) / denom;
  const u = ((b1.x_m - a1.x_m) * d1y - (b1.y_m - a1.y_m) * d1x) / denom;

  if (t < 0 || t > 1 || u < 0 || u > 1) return null;

  return {
    x_m: a1.x_m + t * d1x,
    y_m: a1.y_m + t * d1y,
  };
}

// ---------------------------------------------------------------------------
// Self-intersection check
// ---------------------------------------------------------------------------

/**
 * Check if a polygon is self-intersecting.
 */
export function isSelfIntersecting(poly: Polygon): boolean {
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a1 = poly[i];
    const a2 = poly[(i + 1) % n];
    if (a1 === undefined || a2 === undefined) continue;

    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // adjacent
      const b1 = poly[j];
      const b2 = poly[(j + 1) % n];
      if (b1 === undefined || b2 === undefined) continue;

      if (segmentIntersection(a1, a2, b1, b2) !== null) {
        return true;
      }
    }
  }
  return false;
}
