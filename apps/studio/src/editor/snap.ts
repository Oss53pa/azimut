/**
 * E8 — Snap (magnétisme) and constraints.
 *
 * Snap targets are expressed in pixel-space (tolerance is constant
 * on screen, not in meters). Priority is deterministic (E8.2):
 *   vertex > intersection > midpoint > guide > grid
 * Ties broken by target id.
 *
 * Snap never introduces indeterminism: same view state + same gesture
 * = same snap target.
 */

import type { Point } from '@azimut/core-model';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default snap tolerance in screen pixels (E8.2). */
export const DEFAULT_SNAP_TOLERANCE_PX = 8;

// ---------------------------------------------------------------------------
// Snap target types
// ---------------------------------------------------------------------------

export type SnapKind = 'vertex' | 'intersection' | 'midpoint' | 'guide' | 'grid';

/** Priority order — lower is higher priority (E8.2). */
const SNAP_PRIORITY: Record<SnapKind, number> = {
  vertex: 0,
  intersection: 1,
  midpoint: 2,
  guide: 3,
  grid: 4,
};

export type SnapTarget = {
  readonly kind: SnapKind;
  /** Position in meter-space. */
  readonly point: Point;
  /** Screen-space position (for distance calculation). */
  readonly screenX: number;
  readonly screenY: number;
  /** Owning object id, for deterministic tiebreaking. */
  readonly sourceId: string;
};

export type SnapResult = {
  /** The snapped position in meter-space. */
  readonly point: Point;
  /** Which target was matched, or null if no snap. */
  readonly target: SnapTarget | null;
};

// ---------------------------------------------------------------------------
// Core snap function
// ---------------------------------------------------------------------------

/**
 * Find the best snap target for a cursor position.
 *
 * Deterministic: same inputs, same result. Priority order per E8.2,
 * final tiebreak by sourceId.
 *
 * @param cursorScreenX - Cursor X in screen pixels.
 * @param cursorScreenY - Cursor Y in screen pixels.
 * @param cursorMeter - Cursor position in meter-space (unsnapped).
 * @param targets - Available snap targets.
 * @param tolerancePx - Snap tolerance in screen pixels.
 * @returns Snapped position and matched target.
 */
export function findSnapTarget(
  cursorScreenX: number,
  cursorScreenY: number,
  cursorMeter: Point,
  targets: readonly SnapTarget[],
  tolerancePx: number = DEFAULT_SNAP_TOLERANCE_PX,
): SnapResult {
  let best: SnapTarget | null = null;
  let bestDist = tolerancePx + 1;

  for (const t of targets) {
    const dx = t.screenX - cursorScreenX;
    const dy = t.screenY - cursorScreenY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > tolerancePx) continue;

    if (best === null) {
      best = t;
      bestDist = dist;
      continue;
    }

    // Compare by priority, then distance, then sourceId (E8.2)
    const priCmp = SNAP_PRIORITY[t.kind] - SNAP_PRIORITY[best.kind];
    if (priCmp < 0) {
      best = t;
      bestDist = dist;
    } else if (priCmp === 0) {
      if (dist < bestDist) {
        best = t;
        bestDist = dist;
      } else if (dist === bestDist && t.sourceId.localeCompare(best.sourceId) < 0) {
        best = t;
        bestDist = dist;
      }
    }
  }

  if (best === null) {
    return { point: cursorMeter, target: null };
  }

  return { point: best.point, target: best };
}

// ---------------------------------------------------------------------------
// Grid snap target generation
// ---------------------------------------------------------------------------

/**
 * Generate grid snap targets visible in the current viewport region.
 *
 * @param gridSpacing_m - Grid spacing in meters.
 * @param minX_m - Visible region min X in meters.
 * @param minY_m - Visible region min Y in meters.
 * @param maxX_m - Visible region max X in meters.
 * @param maxY_m - Visible region max Y in meters.
 * @param toScreen - Conversion function from meters to screen pixels.
 */
export function generateGridTargets(
  gridSpacing_m: number,
  minX_m: number,
  minY_m: number,
  maxX_m: number,
  maxY_m: number,
  toScreen: (p: Point) => { x: number; y: number },
): readonly SnapTarget[] {
  if (gridSpacing_m <= 0) return [];

  const targets: SnapTarget[] = [];
  const startX = Math.ceil(minX_m / gridSpacing_m) * gridSpacing_m;
  const startY = Math.ceil(minY_m / gridSpacing_m) * gridSpacing_m;

  // Cap iterations to prevent runaway loops
  const maxIterations = 10000;
  let count = 0;

  for (let x = startX; x <= maxX_m && count < maxIterations; x += gridSpacing_m) {
    for (let y = startY; y <= maxY_m && count < maxIterations; y += gridSpacing_m) {
      const point: Point = { x_m: x, y_m: y };
      const screen = toScreen(point);
      targets.push({
        kind: 'grid',
        point,
        screenX: screen.x,
        screenY: screen.y,
        sourceId: `grid-${x}-${y}`,
      });
      count++;
    }
  }

  return targets;
}

// ---------------------------------------------------------------------------
// Segment midpoint generation
// ---------------------------------------------------------------------------

/**
 * Generate midpoint snap targets from a list of segments.
 */
export function generateMidpointTargets(
  segments: readonly { readonly from: Point; readonly to: Point; readonly id: string }[],
  toScreen: (p: Point) => { x: number; y: number },
): readonly SnapTarget[] {
  return segments.map((seg) => {
    const mid: Point = {
      x_m: (seg.from.x_m + seg.to.x_m) / 2,
      y_m: (seg.from.y_m + seg.to.y_m) / 2,
    };
    const screen = toScreen(mid);
    return {
      kind: 'midpoint' as const,
      point: mid,
      screenX: screen.x,
      screenY: screen.y,
      sourceId: `mid-${seg.id}`,
    };
  });
}

// ---------------------------------------------------------------------------
// Constraint helpers (E8.2)
// ---------------------------------------------------------------------------

/**
 * Constrain a point to the nearest axis-aligned direction from an origin.
 * Used for orthogonal drawing constraint (shift held).
 */
export function constrainOrthogonal(origin: Point, cursor: Point): Point {
  const dx = Math.abs(cursor.x_m - origin.x_m);
  const dy = Math.abs(cursor.y_m - origin.y_m);

  if (dx >= dy) {
    return { x_m: cursor.x_m, y_m: origin.y_m };
  }
  return { x_m: origin.x_m, y_m: cursor.y_m };
}

/**
 * Constrain to angle multiples from an origin.
 *
 * @param angleDeg - Angle step in degrees (e.g. 15, 45).
 */
export function constrainAngle(
  origin: Point,
  cursor: Point,
  angleDeg: number,
): Point {
  if (angleDeg <= 0) return cursor;

  const dx = cursor.x_m - origin.x_m;
  const dy = cursor.y_m - origin.y_m;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return cursor;

  const currentAngle = Math.atan2(dy, dx);
  const stepRad = (angleDeg * Math.PI) / 180;
  const snappedAngle = Math.round(currentAngle / stepRad) * stepRad;

  return {
    x_m: origin.x_m + dist * Math.cos(snappedAngle),
    y_m: origin.y_m + dist * Math.sin(snappedAngle),
  };
}
