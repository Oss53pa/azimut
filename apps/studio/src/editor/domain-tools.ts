/**
 * E7.2 — Domain-specific tools: cell geometry.
 *
 * Cell tracing, parallel offset, cell division, and cell fusion.
 * These tools operate on footprint geometry, producing polygons.
 *
 * Graph-related tools (circulation axis, node placement, series
 * duplication, level report) live in domain-tools-graph.ts (A2.4).
 *
 * Each tool is a pure function: inputs → outputs.
 * Side effects (creating objects, updating the graph) are handled
 * by the caller through Commands (E5).
 *
 * No external geometry library (A3.3).
 */

import type { Point } from '@azimut/core-model';

// Re-export graph tools for backward compatibility
export {
  type GraphNodeOutput,
  type GraphEdgeOutput,
  type CirculationAxisResult,
  traceCirculationAxis,
  placeTypedNode,
  type SeriesDuplicationResult,
  duplicateInSeries,
  type LevelReportInput,
  type LevelReportResult,
  reportLevel,
} from './domain-tools-graph.js';

// ---------------------------------------------------------------------------
// Cell tracing (tracé de cellule)
// ---------------------------------------------------------------------------

/**
 * Generate a right-angled polygon from a sequence of clicks.
 *
 * By default, each segment is constrained to 90° (orthogonal).
 * When `freeAngle` is true, angles are unconstrained.
 *
 * The polygon is closed automatically: the last point connects
 * to the first with orthogonal segments.
 */
export function traceCell(
  points: readonly Point[],
  freeAngle: boolean,
): readonly Point[] {
  if (points.length < 2) return [...points];

  if (freeAngle) return [...points];

  // Orthogonal constraint: each segment is axis-aligned.
  // Between consecutive clicks, insert an intermediate vertex
  // so the path stays at right angles.
  const first = points[0];
  if (first === undefined) return [];
  const result: Point[] = [first];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    if (prev === undefined || cur === undefined) continue;

    const dx = Math.abs(cur.x_m - prev.x_m);
    const dy = Math.abs(cur.y_m - prev.y_m);

    if (dx > 0 && dy > 0) {
      // Insert corner point: go horizontal first, then vertical
      result.push({ x_m: cur.x_m, y_m: prev.y_m });
    }
    result.push(cur);
  }

  return result;
}

/**
 * Close a cell polygon by connecting the last point back to the
 * first with orthogonal segments.
 */
export function closeCell(points: readonly Point[]): readonly Point[] {
  if (points.length < 3) return [...points];

  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) return [...points];

  if (first.x_m === last.x_m && first.y_m === last.y_m) {
    return [...points]; // already closed
  }

  const dx = Math.abs(first.x_m - last.x_m);
  const dy = Math.abs(first.y_m - last.y_m);

  if (dx > 0 && dy > 0) {
    // Need a corner to close orthogonally
    return [...points, { x_m: first.x_m, y_m: last.y_m }];
  }

  return [...points]; // already axis-aligned to first
}

// ---------------------------------------------------------------------------
// Parallel offset (décalage parallèle)
// ---------------------------------------------------------------------------

/**
 * Generate a wall of given thickness from an axis polyline.
 *
 * Takes the axis line and produces a closed polygon representing
 * the wall (offset on both sides by half the thickness).
 *
 * @param axis - Center-line of the wall.
 * @param thickness_m - Total wall thickness in meters.
 * @returns Closed polygon vertices.
 */
export function parallelOffset(
  axis: readonly Point[],
  thickness_m: number,
): readonly Point[] {
  if (axis.length < 2 || thickness_m <= 0) return [];

  const half = thickness_m / 2;
  const leftSide: Point[] = [];
  const rightSide: Point[] = [];

  for (let i = 0; i < axis.length - 1; i++) {
    const a = axis[i];
    const b = axis[i + 1];
    if (a === undefined || b === undefined) continue;

    const dx = b.x_m - a.x_m;
    const dy = b.y_m - a.y_m;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) continue;

    // Normal vector (perpendicular)
    const nx = -dy / len;
    const ny = dx / len;

    if (i === 0) {
      leftSide.push({ x_m: a.x_m + nx * half, y_m: a.y_m + ny * half });
      rightSide.push({ x_m: a.x_m - nx * half, y_m: a.y_m - ny * half });
    }
    leftSide.push({ x_m: b.x_m + nx * half, y_m: b.y_m + ny * half });
    rightSide.push({ x_m: b.x_m - nx * half, y_m: b.y_m - ny * half });
  }

  // Close: left side forward, right side reversed
  return [...leftSide, ...rightSide.reverse()];
}

// ---------------------------------------------------------------------------
// Cell division (division de cellule)
// ---------------------------------------------------------------------------

export type CellDivisionResult = {
  /** First half of the divided cell. */
  readonly cellA: readonly Point[];
  /** Second half. */
  readonly cellB: readonly Point[];
};

/**
 * Divide a rectangular cell along a line parallel to one axis.
 *
 * @param minX - Cell min X bound.
 * @param minY - Cell min Y bound.
 * @param maxX - Cell max X bound.
 * @param maxY - Cell max Y bound.
 * @param axis - 'horizontal' or 'vertical' split direction.
 * @param position_m - Split position along the axis (in meters).
 * @returns Two sub-cells, or null if position is outside bounds.
 */
export function divideCell(
  minX: number, minY: number, maxX: number, maxY: number,
  axis: 'horizontal' | 'vertical',
  position_m: number,
): CellDivisionResult | null {
  if (axis === 'vertical') {
    if (position_m <= minX || position_m >= maxX) return null;
    return {
      cellA: [
        { x_m: minX, y_m: minY },
        { x_m: position_m, y_m: minY },
        { x_m: position_m, y_m: maxY },
        { x_m: minX, y_m: maxY },
      ],
      cellB: [
        { x_m: position_m, y_m: minY },
        { x_m: maxX, y_m: minY },
        { x_m: maxX, y_m: maxY },
        { x_m: position_m, y_m: maxY },
      ],
    };
  }

  // horizontal split
  if (position_m <= minY || position_m >= maxY) return null;
  return {
    cellA: [
      { x_m: minX, y_m: minY },
      { x_m: maxX, y_m: minY },
      { x_m: maxX, y_m: position_m },
      { x_m: minX, y_m: position_m },
    ],
    cellB: [
      { x_m: minX, y_m: position_m },
      { x_m: maxX, y_m: position_m },
      { x_m: maxX, y_m: maxY },
      { x_m: minX, y_m: maxY },
    ],
  };
}

// ---------------------------------------------------------------------------
// Cell fusion (fusion de cellules)
// ---------------------------------------------------------------------------

/**
 * Fuse two adjacent rectangular cells into one.
 *
 * Returns the bounding box of the union.
 * Attribute arbitration (which cell's properties to keep) is
 * handled by the caller.
 */
export function fuseCells(
  cellA: { minX: number; minY: number; maxX: number; maxY: number },
  cellB: { minX: number; minY: number; maxX: number; maxY: number },
): readonly Point[] {
  const minX = Math.min(cellA.minX, cellB.minX);
  const minY = Math.min(cellA.minY, cellB.minY);
  const maxX = Math.max(cellA.maxX, cellB.maxX);
  const maxY = Math.max(cellA.maxY, cellB.maxY);

  return [
    { x_m: minX, y_m: minY },
    { x_m: maxX, y_m: minY },
    { x_m: maxX, y_m: maxY },
    { x_m: minX, y_m: maxY },
  ];
}
