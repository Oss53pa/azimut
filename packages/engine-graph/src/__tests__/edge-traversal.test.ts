import { describe, it, expect } from 'vitest';
import { isEdgeTraversableFrom, buildExcludedKindsSet } from '../edge-traversal.js';
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

  it('uses pre-built excludedKinds set when provided', () => {
    const edge = makeEdge({ from_node_id: 'a', to_node_id: 'c' });
    const profile = makeProfile({ excluded_edge_kinds: ['elevator'] });
    const preBuilt = buildExcludedKindsSet(profile);
    expect(isEdgeTraversableFrom(edge, 'a', profile, nodeKinds, preBuilt)).toBe(false);
  });

  it('pre-built empty set allows traversal', () => {
    const edge = makeEdge({ from_node_id: 'a', to_node_id: 'c' });
    const profile = makeProfile({ excluded_edge_kinds: [] });
    const preBuilt = buildExcludedKindsSet(profile);
    expect(isEdgeTraversableFrom(edge, 'a', profile, nodeKinds, preBuilt)).toBe(true);
  });
});

describe('buildExcludedKindsSet', () => {
  it('returns a set with the profile excluded kinds', () => {
    const profile = makeProfile({ excluded_edge_kinds: ['elevator', 'stairs'] });
    const set = buildExcludedKindsSet(profile);
    expect(set.has('elevator')).toBe(true);
    expect(set.has('stairs')).toBe(true);
    expect(set.has('junction')).toBe(false);
  });

  it('returns empty set for no exclusions', () => {
    const profile = makeProfile({ excluded_edge_kinds: [] });
    const set = buildExcludedKindsSet(profile);
    expect(set.size).toBe(0);
  });

  it('deduplicates repeated excluded kinds', () => {
    const profile = makeProfile({ excluded_edge_kinds: ['elevator', 'elevator'] });
    const set = buildExcludedKindsSet(profile);
    expect(set.size).toBe(1);
    expect(set.has('elevator')).toBe(true);
  });
});

describe('isEdgeTraversableFrom — inline excluded set', () => {
  const nodeKinds = new Map([
    ['a', 'junction'],
    ['b', 'junction'],
    ['c', 'elevator'],
  ]);

  it('builds inline set when excludedKinds not provided', () => {
    const edge = makeEdge({ from_node_id: 'a', to_node_id: 'c' });
    const profile = makeProfile({ excluded_edge_kinds: ['elevator'] });
    // No pre-built set → source line 36-40 builds one inline
    expect(isEdgeTraversableFrom(edge, 'a', profile, nodeKinds)).toBe(false);
  });

  it('accessible edge rejected by non-accessible profile still passes direction check first', () => {
    const edge = makeEdge({ direction: 'forward', accessible: false });
    const profile = makeProfile({ require_accessible: true });
    // Rejected at line 27 (accessible), never reaches direction check
    expect(isEdgeTraversableFrom(edge, 'a', profile, nodeKinds)).toBe(false);
    // But from wrong node, still rejected
    expect(isEdgeTraversableFrom(edge, 'b', profile, nodeKinds)).toBe(false);
  });

  it('rejects edge when from_node has excluded kind', () => {
    const edge = makeEdge({ from_node_id: 'c', to_node_id: 'a' });
    const profile = makeProfile({ excluded_edge_kinds: ['elevator'] });
    // c is elevator (excluded), a is junction → rejected via fromKind
    expect(isEdgeTraversableFrom(edge, 'c', profile, nodeKinds)).toBe(false);
  });

  it('backward direction combined with excluded kind', () => {
    const edge = makeEdge({
      from_node_id: 'a',
      to_node_id: 'c',
      direction: 'backward',
    });
    const profile = makeProfile({ excluded_edge_kinds: ['elevator'] });
    // backward → only traversable from to_node_id ('c'), but 'c' is elevator (excluded)
    expect(isEdgeTraversableFrom(edge, 'c', profile, nodeKinds)).toBe(false);
    // from 'a' → wrong direction
    expect(isEdgeTraversableFrom(edge, 'a', profile, nodeKinds)).toBe(false);
  });
});
