/**
 * E7.2 — Domain-specific tools.
 *
 * These tools do NOT exist in a generic vector editor and justify
 * building our own. They operate on business-layer objects,
 * producing structured data, not just graphics.
 *
 * Each tool is a pure function: inputs → outputs.
 * Side effects (creating objects, updating the graph) are handled
 * by the caller through Commands (E5).
 *
 * No external geometry library (A3.3).
 */

import type { Point } from '@azimut/core-model';

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
 * @param cell - Rectangular cell defined by its bounds.
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

// ---------------------------------------------------------------------------
// Circulation axis tracing (tracé d'axe de circulation)
// ---------------------------------------------------------------------------

export type GraphNodeOutput = {
  readonly id: string;
  readonly position: Point;
  readonly kind: string;
};

export type GraphEdgeOutput = {
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly weight_m: number;
};

export type CirculationAxisResult = {
  readonly nodes: readonly GraphNodeOutput[];
  readonly edges: readonly GraphEdgeOutput[];
};

/**
 * Generate graph nodes and edges from a circulation axis polyline.
 *
 * This is NOT a simple line — it produces proper graph elements:
 * a node at each vertex, and an edge between consecutive nodes.
 *
 * @param points - Polyline vertices.
 * @param nodeKind - Kind for all generated nodes (e.g. 'corridor').
 * @param idPrefix - Prefix for generated ids.
 */
export function traceCirculationAxis(
  points: readonly Point[],
  nodeKind: string,
  idPrefix: string,
): CirculationAxisResult {
  if (points.length < 2) {
    return { nodes: [], edges: [] };
  }

  const nodes: GraphNodeOutput[] = points.map((p, i) => ({
    id: `${idPrefix}-n${i}`,
    position: p,
    kind: nodeKind,
  }));

  const edges: GraphEdgeOutput[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const from = nodes[i];
    const to = nodes[i + 1];
    if (from === undefined || to === undefined) continue;

    const dx = to.position.x_m - from.position.x_m;
    const dy = to.position.y_m - from.position.y_m;
    const weight = Math.sqrt(dx * dx + dy * dy);

    edges.push({
      fromNodeId: from.id,
      toNodeId: to.id,
      weight_m: weight,
    });
  }

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Typed node placement (placement de nœud typé)
// ---------------------------------------------------------------------------

/**
 * Create a typed node at a given position.
 * The type is chosen BEFORE the gesture, not after (E7.2).
 *
 * @param position - Position in meter-space.
 * @param nodeKind - Node type (chosen before placement).
 * @param id - Node id.
 */
export function placeTypedNode(
  position: Point,
  nodeKind: string,
  id: string,
): GraphNodeOutput {
  return { id, position, kind: nodeKind };
}

// ---------------------------------------------------------------------------
// Series duplication (duplication en série)
// ---------------------------------------------------------------------------

export type SeriesDuplicationResult = {
  readonly positions: readonly Point[];
};

/**
 * Distribute n identical cells along an axis.
 *
 * Used for regular-grid galleries (galeries à trame régulière).
 *
 * @param origin - Start position.
 * @param direction - Axis direction (unit-ish vector).
 * @param spacing_m - Distance between cell centers.
 * @param count - Number of cells to create.
 */
export function duplicateInSeries(
  origin: Point,
  direction: Point,
  spacing_m: number,
  count: number,
): SeriesDuplicationResult {
  if (count <= 0 || spacing_m <= 0) return { positions: [] };

  const dx = direction.x_m;
  const dy = direction.y_m;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return { positions: [] };

  const ux = dx / len;
  const uy = dy / len;

  const positions: Point[] = [];
  for (let i = 0; i < count; i++) {
    positions.push({
      x_m: origin.x_m + ux * spacing_m * i,
      y_m: origin.y_m + uy * spacing_m * i,
    });
  }

  return { positions };
}

// ---------------------------------------------------------------------------
// Level report (report de niveau)
// ---------------------------------------------------------------------------

export type LevelReportInput = {
  readonly nodeId: string;
  readonly position: Point;
  readonly kind: string;
};

export type LevelReportResult = {
  /** Nodes to create on the target level, with new ids. */
  readonly nodes: readonly GraphNodeOutput[];
  /** Edges to create between the new nodes. */
  readonly edges: readonly GraphEdgeOutput[];
};

/**
 * Copy circulation paths and vertical cores from one level to another.
 *
 * This is the most frequent gesture on a multi-storey building (E7.2).
 * Positions are preserved (same X/Y), only the level changes.
 * New ids are generated with the target prefix.
 *
 * @param sourceNodes - Nodes to copy.
 * @param sourceEdges - Edges between those nodes.
 * @param targetPrefix - Id prefix for the target level.
 */
export function reportLevel(
  sourceNodes: readonly LevelReportInput[],
  sourceEdges: readonly { fromId: string; toId: string }[],
  targetPrefix: string,
): LevelReportResult {
  // Map old ids to new ids
  const idMap = new Map<string, string>();
  const nodes: GraphNodeOutput[] = sourceNodes.map((n, i) => {
    const newId = `${targetPrefix}-n${i}`;
    idMap.set(n.nodeId, newId);
    return { id: newId, position: n.position, kind: n.kind };
  });

  const edges: GraphEdgeOutput[] = [];
  for (const e of sourceEdges) {
    const fromId = idMap.get(e.fromId);
    const toId = idMap.get(e.toId);
    if (fromId === undefined || toId === undefined) continue;

    // Find positions to compute weight
    const fromNode = nodes.find(n => n.id === fromId);
    const toNode = nodes.find(n => n.id === toId);
    if (fromNode === undefined || toNode === undefined) continue;

    const dx = toNode.position.x_m - fromNode.position.x_m;
    const dy = toNode.position.y_m - fromNode.position.y_m;

    edges.push({
      fromNodeId: fromId,
      toNodeId: toId,
      weight_m: Math.sqrt(dx * dx + dy * dy),
    });
  }

  return { nodes, edges };
}
