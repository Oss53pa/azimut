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

describe('buildAdjacency — additional edge cases', () => {
  it('returns empty map for zero nodes and zero edges', () => {
    const adj = buildAdjacency([], []);
    expect(adj.size).toBe(0);
  });

  it('edge with unknown from but known to adds to known node', () => {
    const adj = buildAdjacency(
      [node('a')],
      [edge('e1', 'x', 'a')],
    );
    // 'a' knows about 'x' as a neighbor
    expect(adj.get('a')?.has('x')).toBe(true);
    // 'x' has no entry in the map (not a node)
    expect(adj.has('x')).toBe(false);
  });
});

describe('bfs — additional edge cases', () => {
  it('node with explicit empty neighbor set terminates immediately', () => {
    const adj = new Map<string, Set<string>>();
    adj.set('solo', new Set());
    const visited = bfs(adj, 'solo');
    expect(visited.size).toBe(1);
    expect(visited.has('solo')).toBe(true);
  });
});

describe('buildAdjacency — both endpoints unknown', () => {
  it('edge with both unknown from and to is silently ignored', () => {
    const adj = buildAdjacency(
      [node('a')],
      [edge('e1', 'x', 'y')],
    );
    // 'a' has no neighbors since the edge doesn't touch it
    expect(adj.get('a')?.size).toBe(0);
    // Neither 'x' nor 'y' are registered as nodes
    expect(adj.has('x')).toBe(false);
    expect(adj.has('y')).toBe(false);
  });

  it('multiple edges form star topology', () => {
    const adj = buildAdjacency(
      [node('hub'), node('s1'), node('s2'), node('s3')],
      [edge('e1', 'hub', 's1'), edge('e2', 'hub', 's2'), edge('e3', 'hub', 's3')],
    );
    expect(adj.get('hub')?.size).toBe(3);
    const fromHub = bfs(adj, 'hub');
    expect(fromHub.size).toBe(4);
  });

  it('bfs visits neighbor not keyed in adj map (skips its children)', () => {
    // Manually build an adj map where 'x' is a neighbor of 'a' but not a key
    const adj = new Map<string, Set<string>>();
    adj.set('a', new Set(['x']));
    const visited = bfs(adj, 'a');
    expect(visited.size).toBe(2);
    expect(visited.has('a')).toBe(true);
    expect(visited.has('x')).toBe(true);
  });

  it('forward-only edge produces bidirectional adjacency (connectivity analysis)', () => {
    const fwdEdge: Edge = {
      ...edge('e-fwd', 'a', 'b'),
      direction: 'forward',
    };
    const adj = buildAdjacency([node('a'), node('b')], [fwdEdge]);
    // buildAdjacency ignores direction → both directions available
    expect(adj.get('a')?.has('b')).toBe(true);
    expect(adj.get('b')?.has('a')).toBe(true);
    // BFS from 'b' can still reach 'a'
    const fromB = bfs(adj, 'b');
    expect(fromB.has('a')).toBe(true);
  });
});
