/**
 * E7.4 — Boolean operations on footprint polygons.
 *
 * Union, subtraction, intersection. No external geometry library (A3.3).
 *
 * The result is validated by the same controls as manual input:
 * simple polygon, closed, non-self-intersecting, area above tolerance.
 * An invalid result cancels the operation with EDIT.BOOLEAN_RESULT_INVALID
 * instead of producing degenerate geometry.
 *
 * Geometry primitives live in geometry-primitives.ts (A2.4 split).
 */

import type { Point, Finding } from '@azimut/core-model';
import {
  type Polygon,
  signedArea,
  polygonArea,
  ensureCCW,
  pointInPolygon,
  segmentIntersection,
  isSelfIntersecting,
} from './geometry-primitives.js';

// Re-export primitives for backward compatibility
export {
  type Polygon,
  signedArea,
  polygonArea,
  ensureCCW,
  pointInPolygon,
  segmentIntersection,
  isSelfIntersecting,
} from './geometry-primitives.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BooleanOp = 'union' | 'subtract' | 'intersect';

export type BooleanResult =
  | { readonly ok: true; readonly polygon: Polygon }
  | { readonly ok: false; readonly finding: Finding };

// ---------------------------------------------------------------------------
// Validation (same as manual input — E7.4)
// ---------------------------------------------------------------------------

/** Minimum area tolerance for valid footprint (m²). */
const MIN_AREA_M2 = 0.001;

function validateResult(poly: Polygon): BooleanResult {
  if (poly.length < 3) {
    return {
      ok: false,
      finding: {
        code: 'EDIT.BOOLEAN_RESULT_INVALID',
        severity: 'blocking',
        entity: null,
        params: { reason: 'too_few_vertices', count: poly.length },
        ruleRef: 'E7.4',
      },
    };
  }

  if (isSelfIntersecting(poly)) {
    return {
      ok: false,
      finding: {
        code: 'EDIT.BOOLEAN_RESULT_INVALID',
        severity: 'blocking',
        entity: null,
        params: { reason: 'self_intersecting' },
        ruleRef: 'E7.4',
      },
    };
  }

  const area = polygonArea(poly);
  if (area < MIN_AREA_M2) {
    return {
      ok: false,
      finding: {
        code: 'EDIT.BOOLEAN_RESULT_INVALID',
        severity: 'blocking',
        entity: null,
        params: { reason: 'area_below_tolerance', area },
        ruleRef: 'E7.4',
      },
    };
  }

  return { ok: true, polygon: poly };
}

// ---------------------------------------------------------------------------
// Convex polygon clipping (Sutherland-Hodgman)
// ---------------------------------------------------------------------------

function clipEdge(
  poly: Polygon,
  edgeStart: Point,
  edgeEnd: Point,
): Point[] {
  const output: Point[] = [];
  const n = poly.length;
  if (n === 0) return output;

  for (let i = 0; i < n; i++) {
    const cur = poly[i];
    const next = poly[(i + 1) % n];
    if (cur === undefined || next === undefined) continue;

    const curInside = isLeft(edgeStart, edgeEnd, cur);
    const nextInside = isLeft(edgeStart, edgeEnd, next);

    if (curInside) {
      output.push(cur);
      if (!nextInside) {
        const ix = lineIntersection(edgeStart, edgeEnd, cur, next);
        if (ix !== null) output.push(ix);
      }
    } else if (nextInside) {
      const ix = lineIntersection(edgeStart, edgeEnd, cur, next);
      if (ix !== null) output.push(ix);
    }
  }
  return output;
}

function isLeft(a: Point, b: Point, p: Point): boolean {
  return (b.x_m - a.x_m) * (p.y_m - a.y_m) - (b.y_m - a.y_m) * (p.x_m - a.x_m) >= 0;
}

function lineIntersection(
  a1: Point, a2: Point,
  b1: Point, b2: Point,
): Point | null {
  const d1x = a2.x_m - a1.x_m;
  const d1y = a2.y_m - a1.y_m;
  const d2x = b2.x_m - b1.x_m;
  const d2y = b2.y_m - b1.y_m;

  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-12) return null;

  const t = ((b1.x_m - a1.x_m) * d2y - (b1.y_m - a1.y_m) * d2x) / denom;

  return {
    x_m: a1.x_m + t * d1x,
    y_m: a1.y_m + t * d1y,
  };
}

// ---------------------------------------------------------------------------
// Boolean operations
// ---------------------------------------------------------------------------

/**
 * Compute polygon intersection using Sutherland-Hodgman.
 * Works correctly when the clip polygon is convex.
 */
function polygonIntersection(subject: Polygon, clip: Polygon): Polygon {
  let output: Point[] = [...subject];

  const clipCCW = ensureCCW(clip);
  const n = clipCCW.length;

  for (let i = 0; i < n; i++) {
    const edgeStart = clipCCW[i];
    const edgeEnd = clipCCW[(i + 1) % n];
    if (edgeStart === undefined || edgeEnd === undefined) continue;

    output = clipEdge(output, edgeStart, edgeEnd);
    if (output.length === 0) return [];
  }

  return output;
}

/**
 * Simple polygon union: merge vertices from both polygons.
 * For convex polygons, computes the convex hull of the union.
 */
function polygonUnion(a: Polygon, b: Polygon): Polygon {
  const all = [...a, ...b];
  return convexHull(all);
}

/**
 * Compute convex hull (Graham scan).
 */
function convexHull(points: readonly Point[]): Polygon {
  if (points.length < 3) return [...points];

  const sorted = [...points].sort((p, q) => {
    const dx = p.x_m - q.x_m;
    return dx !== 0 ? dx : p.y_m - q.y_m;
  });

  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2) {
      const a = lower[lower.length - 2];
      const b = lower[lower.length - 1];
      if (a !== undefined && b !== undefined && cross(a, b, p) <= 0) {
        lower.pop();
      } else {
        break;
      }
    }
    lower.push(p);
  }

  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    if (p === undefined) continue;
    while (upper.length >= 2) {
      const a = upper[upper.length - 2];
      const b = upper[upper.length - 1];
      if (a !== undefined && b !== undefined && cross(a, b, p) <= 0) {
        upper.pop();
      } else {
        break;
      }
    }
    upper.push(p);
  }

  // Remove last point of each half (duplicate of the other half's first)
  lower.pop();
  upper.pop();

  return [...lower, ...upper];
}

function cross(o: Point, a: Point, b: Point): number {
  return (a.x_m - o.x_m) * (b.y_m - o.y_m) - (a.y_m - o.y_m) * (b.x_m - o.x_m);
}

/**
 * Polygon subtraction: points of A that are not inside B,
 * plus intersection points.
 */
function polygonSubtraction(subject: Polygon, clip: Polygon): Polygon {
  // Simple approach: keep subject vertices outside clip,
  // add intersection points on subject edges
  const result: Point[] = [];
  const n = subject.length;
  const clipCCW = ensureCCW(clip);

  for (let i = 0; i < n; i++) {
    const cur = subject[i];
    const next = subject[(i + 1) % n];
    if (cur === undefined || next === undefined) continue;

    const curInside = pointInPolygon(cur, clipCCW);

    if (!curInside) {
      result.push(cur);
    }

    // Add intersection points on this edge
    const cn = clipCCW.length;
    const intersections: Array<{ point: Point; t: number }> = [];
    for (let j = 0; j < cn; j++) {
      const c1 = clipCCW[j];
      const c2 = clipCCW[(j + 1) % cn];
      if (c1 === undefined || c2 === undefined) continue;
      const ix = segmentIntersection(cur, next, c1, c2);
      if (ix !== null) {
        const dx = next.x_m - cur.x_m;
        const dy = next.y_m - cur.y_m;
        const len = Math.sqrt(dx * dx + dy * dy);
        const dix = Math.sqrt((ix.x_m - cur.x_m) ** 2 + (ix.y_m - cur.y_m) ** 2);
        intersections.push({ point: ix, t: len > 0 ? dix / len : 0 });
      }
    }
    intersections.sort((a, b) => a.t - b.t);
    for (const ix of intersections) {
      result.push(ix.point);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Execute a boolean operation on two footprint polygons.
 *
 * The result is validated: if the resulting polygon is invalid
 * (self-intersecting, too few vertices, or area below tolerance),
 * the operation fails with EDIT.BOOLEAN_RESULT_INVALID rather
 * than producing degenerate geometry.
 */
export function booleanOperation(
  a: Polygon,
  b: Polygon,
  op: BooleanOp,
): BooleanResult {
  let result: Polygon;

  switch (op) {
    case 'union':
      result = polygonUnion(a, b);
      break;
    case 'subtract':
      result = polygonSubtraction(a, b);
      break;
    case 'intersect':
      result = polygonIntersection(a, b);
      break;
  }

  return validateResult(result);
}
