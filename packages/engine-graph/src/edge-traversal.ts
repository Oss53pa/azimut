import type { Edge, TravelProfile } from '@azimut/core-model';

/**
 * Build a Set from a profile's excluded_edge_kinds once,
 * then pass it to every isEdgeTraversableFrom call in the loop.
 */
export function buildExcludedKindsSet(
  profile: TravelProfile,
): ReadonlySet<string> {
  return new Set(profile.excluded_edge_kinds);
}

/**
 * Checks whether an edge can be traversed FROM the given node,
 * respecting direction, accessibility and profile exclusions.
 *
 * Pass a pre-built `excludedKinds` set (via `buildExcludedKindsSet`)
 * to avoid allocating a Set on every call in hot loops.
 */
export function isEdgeTraversableFrom(
  edge: Edge,
  nodeId: string,
  profile: TravelProfile,
  nodeKindMap: Map<string, string>,
  excludedKinds?: ReadonlySet<string>,
): boolean {
  if (profile.require_accessible && !edge.accessible) return false;

  if (edge.direction === 'forward' && nodeId !== edge.from_node_id) {
    return false;
  }
  if (edge.direction === 'backward' && nodeId !== edge.to_node_id) {
    return false;
  }

  const excluded = excludedKinds ?? (
    profile.excluded_edge_kinds.length > 0
      ? new Set(profile.excluded_edge_kinds)
      : null
  );

  if (excluded !== null && excluded.size > 0) {
    const fromKind = nodeKindMap.get(edge.from_node_id) ?? '';
    const toKind = nodeKindMap.get(edge.to_node_id) ?? '';
    if (excluded.has(fromKind) || excluded.has(toKind)) return false;
  }

  return true;
}
