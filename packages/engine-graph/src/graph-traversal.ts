import type { GraphNode, Edge } from '@azimut/core-model';

export function buildAdjacency(
  nodes: readonly GraphNode[],
  edges: readonly Edge[],
): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) {
    adj.set(n.id, new Set());
  }
  for (const e of edges) {
    if (e.from_node_id === e.to_node_id) continue;
    const fromSet = adj.get(e.from_node_id);
    const toSet = adj.get(e.to_node_id);
    if (fromSet) fromSet.add(e.to_node_id);
    if (toSet) toSet.add(e.from_node_id);
  }
  return adj;
}

export function bfs(
  adj: Map<string, Set<string>>,
  start: string,
): Set<string> {
  const visited = new Set<string>();
  const queue: string[] = [start];
  visited.add(start);
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    const neighbors = adj.get(current);
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }
  return visited;
}
