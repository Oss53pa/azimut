import type {
  SiteData,
  Edge,
  TravelProfile,
  Destination,
  Outcome,
} from '@azimut/core-model';

export type DecisionPoint = {
  readonly node_id: string;
  readonly branch_count: number;
};

function isEdgeTraversableFrom(
  edge: Edge,
  nodeId: string,
  profile: TravelProfile,
  nodeKindMap: Map<string, string>,
): boolean {
  if (profile.require_accessible && !edge.accessible) return false;
  if (edge.direction === 'forward' && nodeId !== edge.from_node_id) {
    return false;
  }
  if (edge.direction === 'backward' && nodeId !== edge.to_node_id) {
    return false;
  }
  if (profile.excluded_edge_kinds.length > 0) {
    const excluded = new Set(profile.excluded_edge_kinds);
    const fromKind = nodeKindMap.get(edge.from_node_id) ?? '';
    const toKind = nodeKindMap.get(edge.to_node_id) ?? '';
    if (excluded.has(fromKind) || excluded.has(toKind)) return false;
  }
  return true;
}

export function deriveDecisionPoints(
  site: SiteData,
  profile: TravelProfile,
  destinations: readonly Destination[],
): Outcome<readonly DecisionPoint[]> {
  const destNodeIds = new Set(destinations.map((d) => d.node_id));
  const nodeKindMap = new Map<string, string>();
  const outDegree = new Map<string, number>();
  for (const n of site.graph.nodes) {
    outDegree.set(n.id, 0);
    nodeKindMap.set(n.id, n.kind);
  }

  for (const edge of site.graph.edges) {
    if (edge.from_node_id === edge.to_node_id) continue;

    if (isEdgeTraversableFrom(edge, edge.from_node_id, profile, nodeKindMap)) {
      outDegree.set(
        edge.from_node_id,
        (outDegree.get(edge.from_node_id) ?? 0) + 1,
      );
    }
    if (isEdgeTraversableFrom(edge, edge.to_node_id, profile, nodeKindMap)) {
      outDegree.set(
        edge.to_node_id,
        (outDegree.get(edge.to_node_id) ?? 0) + 1,
      );
    }
  }

  const points: DecisionPoint[] = [];
  const sorted = [...site.graph.nodes].sort((a, b) =>
    a.id.localeCompare(b.id),
  );

  for (const n of sorted) {
    const degree = outDegree.get(n.id) ?? 0;
    if (degree <= 1) continue;
    if (destNodeIds.has(n.id)) continue;
    points.push({
      node_id: n.id,
      branch_count: degree,
    });
  }

  return { ok: true, value: points, warnings: [] };
}
