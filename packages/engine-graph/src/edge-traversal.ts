import type { Edge, TravelProfile } from '@azimut/core-model';

/**
 * Checks whether an edge can be traversed FROM the given node,
 * respecting direction, accessibility and profile exclusions.
 */
export function isEdgeTraversableFrom(
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
