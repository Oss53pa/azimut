import type {
  SiteData,
  TravelProfile,
  Outcome,
} from '@azimut/core-model';
import { validateGraph } from './validate-graph.js';
import { deriveDecisionPoints } from './decision-points.js';
import { bfs } from './graph-traversal.js';

export type Support = {
  readonly id: string;
  readonly node_id: string;
};

export type CoverageReport = {
  readonly total_decision_points: number;
  readonly covered_decision_points: number;
  readonly coverage_ratio: number;
  readonly uncovered_points: readonly string[];
  readonly unused_supports: readonly string[];
};

export type AccessibilityReport = {
  readonly total_destinations: number;
  readonly reachable_destinations: number;
  readonly unreachable: readonly { dest_id: string; node_id: string }[];
};

export type EvacuationReport = {
  readonly total_nodes: number;
  readonly nodes_with_evacuation_route: number;
  readonly uncovered_nodes: readonly string[];
};

export function auditCoverage(
  site: SiteData,
  profile: TravelProfile,
  supports: readonly Support[],
): Outcome<CoverageReport> {
  const validation = validateGraph(site);
  if (!validation.ok) {
    return {
      ok: false,
      findings: [
        {
          code: 'GRAPH.NOT_VALIDATED',
          severity: 'blocking',
          entity: null,
          params: {},
          ruleRef: null,
        },
        ...validation.findings,
      ],
    };
  }

  const dpResult = deriveDecisionPoints(
    site,
    profile,
    site.destinations,
  );
  if (!dpResult.ok) return dpResult as Outcome<CoverageReport>;

  const decisionPointNodeIds = new Set(
    dpResult.value.map((dp) => dp.node_id),
  );
  const supportNodeIds = new Set(supports.map((s) => s.node_id));

  const covered: string[] = [];
  const uncovered: string[] = [];
  const sortedDps = [...decisionPointNodeIds].sort();
  for (const nodeId of sortedDps) {
    if (supportNodeIds.has(nodeId)) {
      covered.push(nodeId);
    } else {
      uncovered.push(nodeId);
    }
  }

  const dpNodes = new Set(decisionPointNodeIds);
  const unused: string[] = [];
  const sortedSupports = [...supports].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (const s of sortedSupports) {
    if (!dpNodes.has(s.node_id)) {
      unused.push(s.id);
    }
  }

  const total = decisionPointNodeIds.size;
  return {
    ok: true,
    value: {
      total_decision_points: total,
      covered_decision_points: covered.length,
      coverage_ratio: total === 0 ? 1 : covered.length / total,
      uncovered_points: uncovered,
      unused_supports: unused,
    },
    warnings: validation.warnings,
  };
}

export function auditAccessibility(
  site: SiteData,
  profile: TravelProfile,
): Outcome<AccessibilityReport> {
  if (!profile.require_accessible) {
    return {
      ok: false,
      findings: [
        {
          code: 'GRAPH.PROFILE_NOT_ACCESSIBLE',
          severity: 'blocking',
          entity: null,
          params: { profile_id: profile.id },
          ruleRef: null,
        },
      ],
    };
  }

  const adj = new Map<string, Set<string>>();
  for (const n of site.graph.nodes) {
    adj.set(n.id, new Set());
  }
  for (const edge of site.graph.edges) {
    if (edge.from_node_id === edge.to_node_id) continue;
    if (!edge.accessible) continue;
    const fromSet = adj.get(edge.from_node_id);
    const toSet = adj.get(edge.to_node_id);
    if (fromSet) fromSet.add(edge.to_node_id);
    if (toSet) toSet.add(edge.from_node_id);
  }

  const entrances = site.graph.nodes.filter(
    (n) => n.kind === 'entrance',
  );
  const reachable = new Set<string>();
  for (const entrance of entrances) {
    for (const id of bfs(adj, entrance.id)) {
      reachable.add(id);
    }
  }

  const unreachable: { dest_id: string; node_id: string }[] = [];
  const sorted = [...site.destinations].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (const dest of sorted) {
    if (!reachable.has(dest.node_id)) {
      unreachable.push({ dest_id: dest.id, node_id: dest.node_id });
    }
  }

  return {
    ok: true,
    value: {
      total_destinations: site.destinations.length,
      reachable_destinations:
        site.destinations.length - unreachable.length,
      unreachable,
    },
    warnings: [],
  };
}

export function auditEvacuation(
  site: SiteData,
): Outcome<EvacuationReport> {
  const nodesOnEvacRoute = new Set<string>();
  for (const edge of site.graph.edges) {
    if (!edge.evacuation_route) continue;
    nodesOnEvacRoute.add(edge.from_node_id);
    nodesOnEvacRoute.add(edge.to_node_id);
  }

  const uncovered: string[] = [];
  const sorted = [...site.graph.nodes].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (const n of sorted) {
    if (!nodesOnEvacRoute.has(n.id)) {
      uncovered.push(n.id);
    }
  }

  return {
    ok: true,
    value: {
      total_nodes: site.graph.nodes.length,
      nodes_with_evacuation_route: nodesOnEvacRoute.size,
      uncovered_nodes: uncovered,
    },
    warnings: [],
  };
}
