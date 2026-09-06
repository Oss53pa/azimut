/**
 * E7.2 — Domain-specific tools: graph operations.
 *
 * Circulation axis tracing, typed node placement, series
 * duplication, and level report. These tools produce graph
 * elements (nodes + edges), not just geometry.
 *
 * Each tool is a pure function. Side effects are handled
 * by the caller through Commands (E5).
 *
 * No external geometry library (A3.3).
 * Split from domain-tools.ts to stay under 400 lines (A2.4).
 */

import type { Point } from '@azimut/core-model';

// ---------------------------------------------------------------------------
// Types
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

// ---------------------------------------------------------------------------
// Circulation axis tracing (tracé d'axe de circulation)
// ---------------------------------------------------------------------------

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
