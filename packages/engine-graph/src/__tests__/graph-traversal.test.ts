import { describe, it, expect } from 'vitest';
import { buildAdjacency, bfs } from '../graph-traversal.js';
import type { GraphNode, Edge } from '@azimut/core-model';

function node(id: string, levelId = 'l1'): GraphNode {
  return {
    id,
    org_id: 'org1',
    level_id: levelId,
    kind: 'junction',
    label: id,
    position: { x_m: 0, y_m: 0 },
  };
}

function edge(id: string, from: string, to: string): Edge {
  return {
    id,
    org_id: 'org1',
    from_node_id: from,
    to_node_id: to,
    length_m: 1,
    width_m: 2,
    slope_pct: 0,
    accessible: true,
    direction: 'both',
    evacuation_route: false,
  };
}

describe('buildAdjacency', () => {
  it('creates empty sets for isolated nodes', () => {
    const adj = buildAdjacency([node('a'), node('b')], []);
    expect(adj.get('a')?.size).toBe(0);
    expect(adj.get('b')?.size).toBe(0);
  });

  it('builds bidirectional adjacency from edges', () => {
    const adj = buildAdjacency(
      [node('a'), node('b'), node('c')],
      [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')],
    );
    expect([...(adj.get('a') ?? [])]).toEqual(['b']);
    expect([...(adj.get('b') ?? [])].sort()).toEqual(['a', 'c']);
    expect([...(adj.get('c') ?? [])]).toEqual(['b']);
  });

  it('skips self-loops', () => {
    const adj = buildAdjacency(
      [node('a')],
      [edge('e1', 'a', 'a')],
    );
    expect(adj.get('a')?.size).toBe(0);
  });

  it('ignores edges with unknown nodes', () => {
    const adj = buildAdjacency(
      [node('a')],
      [edge('e1', 'a', 'x')],
    );
    expect(adj.get('a')?.has('x')).toBe(true);
    expect(adj.has('x')).toBe(false);
  });

  it('handles duplicate edges without duplicating neighbors', () => {
    const adj = buildAdjacency(
      [node('a'), node('b')],
      [edge('e1', 'a', 'b'), edge('e2', 'a', 'b')],
    );
    expect(adj.get('a')?.size).toBe(1);
  });
});

describe('bfs', () => {
  it('visits all connected nodes', () => {
    const adj = buildAdjacency(
      [node('a'), node('b'), node('c')],
      [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')],
    );
    const visited = bfs(adj, 'a');
    expect(visited.size).toBe(3);
    expect(visited.has('a')).toBe(true);
    expect(visited.has('b')).toBe(true);
    expect(visited.has('c')).toBe(true);
  });

  it('does not visit disconnected components', () => {
    const adj = buildAdjacency(
      [node('a'), node('b'), node('c')],
      [edge('e1', 'a', 'b')],
    );
    const visited = bfs(adj, 'a');
    expect(visited.size).toBe(2);
    expect(visited.has('c')).toBe(false);
  });

  it('handles single node', () => {
    const adj = buildAdjacency([node('a')], []);
    const visited = bfs(adj, 'a');
    expect(visited.size).toBe(1);
    expect(visited.has('a')).toBe(true);
  });

  it('handles start not in adjacency map', () => {
    const adj = new Map<string, Set<string>>();
    const visited = bfs(adj, 'unknown');
    expect(visited.size).toBe(1);
    expect(visited.has('unknown')).toBe(true);
  });

  it('handles cyclic graphs', () => {
    const adj = buildAdjacency(
      [node('a'), node('b'), node('c')],
      [edge('e1', 'a', 'b'), edge('e2', 'b', 'c'), edge('e3', 'c', 'a')],
    );
    const visited = bfs(adj, 'a');
    expect(visited.size).toBe(3);
  });
});
