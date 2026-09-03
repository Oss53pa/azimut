import type {
  SiteData,
  Edge,
  TravelProfile,
  Outcome,
} from '@azimut/core-model';
import { isEdgeTraversableFrom, buildExcludedKindsSet } from './edge-traversal.js';

export type Route = {
  readonly from_node_id: string;
  readonly to_node_id: string;
  readonly path: readonly string[];
  readonly edges: readonly string[];
  readonly cost: number;
};

type AdjEntry = {
  readonly neighbor: string;
  readonly edge_id: string;
  readonly cost: number;
};

function edgeCost(edge: Edge): number {
  return edge.length_m;
}

function buildWeightedAdj(
  site: SiteData,
  profile: TravelProfile,
): Map<string, AdjEntry[]> {
  const adj = new Map<string, AdjEntry[]>();
  const nodeKindMap = new Map<string, string>();
  for (const n of site.graph.nodes) {
    adj.set(n.id, []);
    nodeKindMap.set(n.id, n.kind);
  }

  const excludedKinds = buildExcludedKindsSet(profile);

  for (const edge of site.graph.edges) {
    if (edge.from_node_id === edge.to_node_id) continue;

    const cost = edgeCost(edge);

    if (isEdgeTraversableFrom(edge, edge.from_node_id, profile, nodeKindMap, excludedKinds)) {
      const list = adj.get(edge.from_node_id);
      if (list) {
        list.push({
          neighbor: edge.to_node_id,
          edge_id: edge.id,
          cost,
        });
      }
    }

    if (isEdgeTraversableFrom(edge, edge.to_node_id, profile, nodeKindMap, excludedKinds)) {
      const list = adj.get(edge.to_node_id);
      if (list) {
        list.push({
          neighbor: edge.from_node_id,
          edge_id: edge.id,
          cost,
        });
      }
    }
  }

  return adj;
}

function dijkstra(
  adj: Map<string, AdjEntry[]>,
  from: string,
  to: string,
): Route | null {
  const dist = new Map<string, number>();
  const prev = new Map<string, { node: string; edge_id: string }>();
  dist.set(from, 0);

  const unvisited = new Set(adj.keys());

  while (unvisited.size > 0) {
    let current: string | null = null;
    let currentDist = Infinity;
    const sorted = [...unvisited].sort();
    for (const id of sorted) {
      const d = dist.get(id);
      if (d !== undefined && (d < currentDist || (d === currentDist && (current === null || id < current)))) {
        current = id;
        currentDist = d;
      }
    }

    if (current === null || currentDist === Infinity) break;
    if (current === to) break;

    unvisited.delete(current);

    const neighbors = adj.get(current);
    if (!neighbors) continue;

    const sortedNeighbors = [...neighbors].sort((a, b) =>
      a.edge_id.localeCompare(b.edge_id),
    );

    for (const entry of sortedNeighbors) {
      const newDist = currentDist + entry.cost;
      const existingDist = dist.get(entry.neighbor);
      if (existingDist === undefined || newDist < existingDist) {
        dist.set(entry.neighbor, newDist);
        prev.set(entry.neighbor, {
          node: current,
          edge_id: entry.edge_id,
        });
      }
    }
  }

  const toDist = dist.get(to);
  if (toDist === undefined) return null;

  const path: string[] = [];
  const edges: string[] = [];
  let cursor = to;
  while (cursor !== from) {
    path.unshift(cursor);
    const previous = prev.get(cursor);
    if (!previous) return null;
    edges.unshift(previous.edge_id);
    cursor = previous.node;
  }
  path.unshift(from);

  return {
    from_node_id: from,
    to_node_id: to,
    path,
    edges,
    cost: toDist,
  };
}

export function computeRoute(
  site: SiteData,
  profile: TravelProfile,
  from: string,
  to: string,
): Outcome<Route> {
  if (from === to) {
    return {
      ok: true,
      value: {
        from_node_id: from,
        to_node_id: to,
        path: [from],
        edges: [],
        cost: 0,
      },
      warnings: [],
    };
  }

  const nodeIds = new Set(site.graph.nodes.map((n) => n.id));
  if (!nodeIds.has(from)) {
    return {
      ok: false,
      findings: [
        {
          code: 'GRAPH.ROUTE_NODE_NOT_FOUND',
          severity: 'blocking',
          entity: { kind: 'node', id: from },
          params: {},
          ruleRef: null,
        },
      ],
    };
  }
  if (!nodeIds.has(to)) {
    return {
      ok: false,
      findings: [
        {
          code: 'GRAPH.ROUTE_NODE_NOT_FOUND',
          severity: 'blocking',
          entity: { kind: 'node', id: to },
          params: {},
          ruleRef: null,
        },
      ],
    };
  }

  const adj = buildWeightedAdj(site, profile);
  const route = dijkstra(adj, from, to);

  if (route === null) {
    return {
      ok: false,
      findings: [
        {
          code: 'GRAPH.ROUTE_UNREACHABLE',
          severity: 'blocking',
          entity: { kind: 'node', id: to },
          params: { from_node_id: from, to_node_id: to },
          ruleRef: null,
        },
      ],
    };
  }

  return { ok: true, value: route, warnings: [] };
}
