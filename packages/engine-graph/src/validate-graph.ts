import type {
  SiteData,
  GraphNode,
  Edge,
  Finding,
  Outcome,
} from '@azimut/core-model';
import { buildAdjacency, bfs } from './graph-traversal.js';
import {
  crossLevelWithoutVlFindings,
  multiLevelWithoutAccessibleVlFindings,
  missingDestinationNameFindings,
} from './checks-structure.js';

export type ValidationResult = {
  readonly valid: boolean;
};

function selfLoopFindings(edges: readonly Edge[]): Finding[] {
  const findings: Finding[] = [];
  for (const e of edges) {
    if (e.from_node_id === e.to_node_id) {
      findings.push({
        code: 'GRAPH.SELF_LOOP',
        severity: 'blocking',
        entity: { kind: 'edge', id: e.id },
        params: { node_id: e.from_node_id },
        ruleRef: null,
      });
    }
  }
  return findings;
}

function zeroLengthFindings(edges: readonly Edge[]): Finding[] {
  const findings: Finding[] = [];
  for (const e of edges) {
    if (e.length_m === 0 && e.from_node_id !== e.to_node_id) {
      findings.push({
        code: 'GRAPH.ZERO_LENGTH_EDGE',
        severity: 'blocking',
        entity: { kind: 'edge', id: e.id },
        params: {
          from_node_id: e.from_node_id,
          to_node_id: e.to_node_id,
        },
        ruleRef: null,
      });
    }
  }
  return findings;
}

function orphanNodeFindings(
  nodes: readonly GraphNode[],
  edges: readonly Edge[],
): Finding[] {
  const connected = new Set<string>();
  for (const e of edges) {
    connected.add(e.from_node_id);
    connected.add(e.to_node_id);
  }
  const findings: Finding[] = [];
  for (const n of nodes) {
    if (!connected.has(n.id)) {
      findings.push({
        code: 'GRAPH.ORPHAN_NODE',
        severity: 'blocking',
        entity: { kind: 'node', id: n.id },
        params: { label: n.label },
        ruleRef: null,
      });
    }
  }
  return findings;
}

function disconnectedFindings(
  nodes: readonly GraphNode[],
  edges: readonly Edge[],
): Finding[] {
  if (nodes.length === 0) return [];
  const adj = buildAdjacency(nodes, edges);

  const allIds = nodes.map((n) => n.id);
  const sorted = [...allIds].sort();
  const firstId = sorted[0];
  if (firstId === undefined) return [];

  const reachable = bfs(adj, firstId);
  if (reachable.size === nodes.length) return [];

  const unreachableIds = sorted.filter((id) => !reachable.has(id));
  const findings: Finding[] = [];
  for (const id of unreachableIds) {
    findings.push({
      code: 'GRAPH.DISCONNECTED',
      severity: 'blocking',
      entity: { kind: 'node', id },
      params: {},
      ruleRef: null,
    });
  }
  return findings;
}

function unreachableFromEntranceFindings(
  nodes: readonly GraphNode[],
  edges: readonly Edge[],
): Finding[] {
  const entrances = nodes.filter((n) => n.kind === 'entrance');
  if (entrances.length === 0 && nodes.length > 0) {
    return [
      {
        code: 'GRAPH.NO_ENTRANCE',
        severity: 'blocking',
        entity: null,
        params: {},
        ruleRef: null,
      },
    ];
  }

  const adj = buildAdjacency(nodes, edges);
  const reachable = new Set<string>();
  for (const entrance of entrances) {
    for (const id of bfs(adj, entrance.id)) {
      reachable.add(id);
    }
  }

  const findings: Finding[] = [];
  const sorted = [...nodes].sort((a, b) => a.id.localeCompare(b.id));
  for (const n of sorted) {
    if (n.kind === 'entrance') continue;
    if (!reachable.has(n.id)) {
      findings.push({
        code: 'GRAPH.UNREACHABLE_FROM_ENTRANCE',
        severity: 'blocking',
        entity: { kind: 'node', id: n.id },
        params: { label: n.label },
        ruleRef: null,
      });
    }
  }
  return findings;
}

function unreachableDestinationFindings(
  site: SiteData,
  reachableFromEntrance: Set<string>,
): Finding[] {
  const findings: Finding[] = [];
  const sorted = [...site.destinations].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (const dest of sorted) {
    if (!reachableFromEntrance.has(dest.node_id)) {
      findings.push({
        code: 'GRAPH.DESTINATION_UNREACHABLE',
        severity: 'blocking',
        entity: { kind: 'destination', id: dest.id },
        params: { node_id: dest.node_id },
        ruleRef: null,
      });
    }
  }
  return findings;
}

function deadEndFindings(
  nodes: readonly GraphNode[],
  edges: readonly Edge[],
): Finding[] {
  const degree = new Map<string, number>();
  for (const n of nodes) {
    degree.set(n.id, 0);
  }
  for (const e of edges) {
    if (e.from_node_id === e.to_node_id) continue;
    degree.set(e.from_node_id, (degree.get(e.from_node_id) ?? 0) + 1);
    degree.set(e.to_node_id, (degree.get(e.to_node_id) ?? 0) + 1);
  }

  const justified = new Set<string>([
    'destination_access',
    'emergency_exit',
    'entrance',
  ]);

  const findings: Finding[] = [];
  const sorted = [...nodes].sort((a, b) => a.id.localeCompare(b.id));
  for (const n of sorted) {
    const d = degree.get(n.id) ?? 0;
    if (d === 1 && !justified.has(n.kind)) {
      findings.push({
        code: 'GRAPH.UNJUSTIFIED_DEAD_END',
        severity: 'warning',
        entity: { kind: 'node', id: n.id },
        params: { kind: n.kind, label: n.label },
        ruleRef: null,
      });
    }
  }
  return findings;
}

export function validateGraph(
  site: SiteData,
): Outcome<ValidationResult> {
  const { nodes, edges } = site.graph;

  const allFindings: Finding[] = [
    ...selfLoopFindings(edges),
    ...zeroLengthFindings(edges),
    ...orphanNodeFindings(nodes, edges),
    ...disconnectedFindings(nodes, edges),
    ...unreachableFromEntranceFindings(nodes, edges),
    ...crossLevelWithoutVlFindings(site),
    ...deadEndFindings(nodes, edges),
    ...multiLevelWithoutAccessibleVlFindings(site),
    ...missingDestinationNameFindings(site),
  ];

  const adj = buildAdjacency(nodes, edges);
  const entrances = nodes.filter((n) => n.kind === 'entrance');
  const reachableFromEntrance = new Set<string>();
  for (const entrance of entrances) {
    for (const id of bfs(adj, entrance.id)) {
      reachableFromEntrance.add(id);
    }
  }
  allFindings.push(
    ...unreachableDestinationFindings(site, reachableFromEntrance),
  );

  const blockings = allFindings.filter((f) => f.severity === 'blocking');
  const warnings = allFindings.filter(
    (f) => f.severity === 'warning' || f.severity === 'info',
  );

  if (blockings.length > 0) {
    return { ok: false, findings: [...blockings, ...warnings] };
  }

  return { ok: true, value: { valid: true }, warnings };
}
