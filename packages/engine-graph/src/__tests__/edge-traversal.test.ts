import { describe, it, expect } from 'vitest';
import { isEdgeTraversableFrom } from '../edge-traversal.js';
import type { Edge, TravelProfile } from '@azimut/core-model';

function makeEdge(overrides?: Partial<Edge>): Edge {
  return {
    id: 'e1',
    org_id: 'org1',
    from_node_id: 'a',
    to_node_id: 'b',
    length_m: 5,
    width_m: 2,
    slope_pct: 0,
    accessible: true,
    direction: 'both',
    evacuation_route: false,
    ...overrides,
  };
}

function makeProfile(overrides?: Partial<TravelProfile>): TravelProfile {
  return {
    id: 'tp1',
    org_id: 'org1',
    site_id: 's1',
    key: 'standard',
    name: 'Standard',
    excluded_edge_kinds: [],
    require_accessible: false,
    honor_hours: false,
    ...overrides,
  };
}

describe('isEdgeTraversableFrom', () => {
  const nodeKinds = new Map([
    ['a', 'junction'],
    ['b', 'junction'],
    ['c', 'elevator'],
  ]);

  it('traversable in both directions by default', () => {
    const edge = makeEdge({ direction: 'both' });
    const profile = makeProfile();
    expect(isEdgeTraversableFrom(edge, 'a', profile, nodeKinds)).toBe(true);
    expect(isEdgeTraversableFrom(edge, 'b', profile, nodeKinds)).toBe(true);
  });

  it('forward direction: only from from_node_id', () => {
    const edge = makeEdge({ direction: 'forward' });
    const profile = makeProfile();
    expect(isEdgeTraversableFrom(edge, 'a', profile, nodeKinds)).toBe(true);
    expect(isEdgeTraversableFrom(edge, 'b', profile, nodeKinds)).toBe(false);
  });

  it('backward direction: only from to_node_id', () => {
    const edge = makeEdge({ direction: 'backward' });
    const profile = makeProfile();
    expect(isEdgeTraversableFrom(edge, 'a', profile, nodeKinds)).toBe(false);
    expect(isEdgeTraversableFrom(edge, 'b', profile, nodeKinds)).toBe(true);
  });

  it('rejects non-accessible edge for accessible profile', () => {
    const edge = makeEdge({ accessible: false });
    const profile = makeProfile({ require_accessible: true });
    expect(isEdgeTraversableFrom(edge, 'a', profile, nodeKinds)).toBe(false);
  });

  it('accepts accessible edge for accessible profile', () => {
    const edge = makeEdge({ accessible: true });
    const profile = makeProfile({ require_accessible: true });
    expect(isEdgeTraversableFrom(edge, 'a', profile, nodeKinds)).toBe(true);
  });

  it('rejects edge touching excluded node kind', () => {
    const edge = makeEdge({ from_node_id: 'a', to_node_id: 'c' });
    const profile = makeProfile({ excluded_edge_kinds: ['elevator'] });
    expect(isEdgeTraversableFrom(edge, 'a', profile, nodeKinds)).toBe(false);
  });

  it('accepts edge when excluded kinds do not match', () => {
    const edge = makeEdge({ from_node_id: 'a', to_node_id: 'b' });
    const profile = makeProfile({ excluded_edge_kinds: ['elevator'] });
    expect(isEdgeTraversableFrom(edge, 'a', profile, nodeKinds)).toBe(true);
  });

  it('handles unknown node kinds gracefully', () => {
    const edge = makeEdge({ from_node_id: 'x', to_node_id: 'y' });
    const profile = makeProfile({ excluded_edge_kinds: ['elevator'] });
    const emptyKinds = new Map<string, string>();
    expect(isEdgeTraversableFrom(edge, 'x', profile, emptyKinds)).toBe(true);
  });
});
