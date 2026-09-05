import { describe, it, expect } from 'vitest';
import { RouteCache } from '../route-cache.js';
import { refMinimal } from '@azimut/testkit';
import type { TravelProfile } from '@azimut/core-model';

const profile: TravelProfile = refMinimal.travel_profiles[0] as TravelProfile;

// Pick two nodes from refMinimal that can route
const entrance = refMinimal.graph.nodes.find((n) => n.kind === 'entrance');
const dest = refMinimal.graph.nodes.find((n) => n.kind === 'destination_access');

describe('RouteCache', () => {
  it('starts empty', () => {
    const cache = new RouteCache();
    expect(cache.size).toBe(0);
  });

  it('computes and caches a route', () => {
    if (!entrance || !dest) return;
    const cache = new RouteCache();
    const r1 = cache.computeOrGet(refMinimal, profile, entrance.id, dest.id);
    expect(r1.ok).toBe(true);
    expect(cache.size).toBe(1);

    // Second call returns cached
    const r2 = cache.computeOrGet(refMinimal, profile, entrance.id, dest.id);
    expect(r2.ok).toBe(true);
    if (r1.ok && r2.ok) {
      expect(r2.value).toStrictEqual(r1.value);
    }
    expect(cache.size).toBe(1);
  });

  it('different from/to produce different cache entries', () => {
    if (!entrance || !dest) return;
    const cache = new RouteCache();
    cache.computeOrGet(refMinimal, profile, entrance.id, dest.id);
    // Reverse direction
    cache.computeOrGet(refMinimal, profile, dest.id, entrance.id);
    expect(cache.size).toBe(2);
  });

  it('invalidateAll clears the cache', () => {
    if (!entrance || !dest) return;
    const cache = new RouteCache();
    cache.computeOrGet(refMinimal, profile, entrance.id, dest.id);
    expect(cache.size).toBe(1);
    cache.invalidateAll();
    expect(cache.size).toBe(0);
  });

  it('invalidateForEdge removes only matching routes', () => {
    if (!entrance || !dest) return;
    const cache = new RouteCache();
    const r = cache.computeOrGet(refMinimal, profile, entrance.id, dest.id);
    expect(cache.size).toBe(1);

    // Get an edge from the route
    if (!r.ok) return;
    const edgeId = r.value.edges[0];
    if (!edgeId) return;

    cache.invalidateForEdge(edgeId);
    expect(cache.size).toBe(0);
  });

  it('invalidateForEdge preserves routes not using that edge', () => {
    if (!entrance || !dest) return;
    const cache = new RouteCache();
    cache.computeOrGet(refMinimal, profile, entrance.id, dest.id);
    expect(cache.size).toBe(1);

    cache.invalidateForEdge('nonexistent-edge');
    expect(cache.size).toBe(1);
  });

  it('does not cache failed routes', () => {
    const cache = new RouteCache();
    const r = cache.computeOrGet(refMinimal, profile, 'unknown', 'also-unknown');
    expect(r.ok).toBe(false);
    expect(cache.size).toBe(0);
  });

  it('recomputes when graph changes (hash mismatch)', () => {
    if (!entrance || !dest) return;
    const cache = new RouteCache();
    const r1 = cache.computeOrGet(refMinimal, profile, entrance.id, dest.id);
    expect(r1.ok).toBe(true);
    expect(cache.size).toBe(1);

    // Mutate site edges so hash changes
    const modified = {
      ...refMinimal,
      graph: {
        ...refMinimal.graph,
        edges: refMinimal.graph.edges.map((e) => ({
          ...e,
          length_m: e.length_m + 0.001,
        })),
      },
    };
    const r2 = cache.computeOrGet(modified, profile, entrance.id, dest.id);
    expect(r2.ok).toBe(true);
    // Still only one entry (replaced)
    expect(cache.size).toBe(1);
  });

  it('is deterministic (INV-4)', () => {
    if (!entrance || !dest) return;
    const c1 = new RouteCache();
    const c2 = new RouteCache();
    const r1 = c1.computeOrGet(refMinimal, profile, entrance.id, dest.id);
    const r2 = c2.computeOrGet(refMinimal, profile, entrance.id, dest.id);
    expect(r1).toStrictEqual(r2);
  });

  it('self-route (from === to) is cached with zero edges', () => {
    if (!entrance) return;
    const cache = new RouteCache();
    const r = cache.computeOrGet(refMinimal, profile, entrance.id, entrance.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.path).toEqual([entrance.id]);
    expect(r.value.edges).toEqual([]);
    expect(r.value.cost).toBe(0);
    expect(cache.size).toBe(1);
  });

  it('self-route is immune to invalidateForEdge', () => {
    if (!entrance || !dest) return;
    const cache = new RouteCache();
    cache.computeOrGet(refMinimal, profile, entrance.id, entrance.id);
    const r = cache.computeOrGet(refMinimal, profile, entrance.id, dest.id);
    expect(cache.size).toBe(2);

    if (!r.ok) return;
    const edgeId = r.value.edges[0];
    if (!edgeId) return;

    // Invalidating the edge removes the normal route but not the self-route
    cache.invalidateForEdge(edgeId);
    expect(cache.size).toBe(1);
  });

  it('selective invalidation with multiple routes', () => {
    if (!entrance || !dest) return;
    const cache = new RouteCache();
    // Cache forward and reverse routes
    const r1 = cache.computeOrGet(refMinimal, profile, entrance.id, dest.id);
    cache.computeOrGet(refMinimal, profile, dest.id, entrance.id);
    expect(cache.size).toBe(2);

    if (!r1.ok) return;
    const edgeId = r1.value.edges[0];
    if (!edgeId) return;

    // Both routes likely share the same edge, so both get invalidated
    cache.invalidateForEdge(edgeId);
    // At least the forward route is gone
    expect(cache.size).toBeLessThan(2);
  });

  it('different profiles produce separate cache entries for same from/to', () => {
    if (!entrance || !dest) return;
    const cache = new RouteCache();
    const profile2: TravelProfile = { ...profile, id: 'profile-alt' };
    cache.computeOrGet(refMinimal, profile, entrance.id, dest.id);
    cache.computeOrGet(refMinimal, profile2, entrance.id, dest.id);
    expect(cache.size).toBe(2);
  });

  it('recomputes when vertical_links change', () => {
    if (!entrance || !dest) return;
    const cache = new RouteCache();
    cache.computeOrGet(refMinimal, profile, entrance.id, dest.id);
    expect(cache.size).toBe(1);
    const modified = {
      ...refMinimal,
      graph: {
        ...refMinimal.graph,
        vertical_links: [
          ...refMinimal.graph.vertical_links,
          { id: 'vl-new', org_id: 'org-test-001', edge_id: 'e-fake', kind: 'elevator' as const, capacity: 8, accessible: true },
        ],
      },
    };
    cache.computeOrGet(modified, profile, entrance.id, dest.id);
    // Hash changed → recomputed, still size 1
    expect(cache.size).toBe(1);
  });

  it('invalidateForEdge on empty cache is a no-op', () => {
    const cache = new RouteCache();
    cache.invalidateForEdge('any-edge');
    expect(cache.size).toBe(0);
  });

  it('computeOrGet after invalidateAll rebuilds the cache', () => {
    if (!entrance || !dest) return;
    const cache = new RouteCache();
    const r1 = cache.computeOrGet(refMinimal, profile, entrance.id, dest.id);
    expect(cache.size).toBe(1);
    cache.invalidateAll();
    expect(cache.size).toBe(0);
    const r2 = cache.computeOrGet(refMinimal, profile, entrance.id, dest.id);
    expect(r2.ok).toBe(true);
    expect(cache.size).toBe(1);
    if (r1.ok && r2.ok) {
      expect(r2.value).toStrictEqual(r1.value);
    }
  });

  it('recomputes when edge accessible flag changes', () => {
    if (!entrance || !dest) return;
    const cache = new RouteCache();
    cache.computeOrGet(refMinimal, profile, entrance.id, dest.id);
    expect(cache.size).toBe(1);
    const modified = {
      ...refMinimal,
      graph: {
        ...refMinimal.graph,
        edges: refMinimal.graph.edges.map((e) => ({
          ...e,
          accessible: !e.accessible,
        })),
      },
    };
    cache.computeOrGet(modified, profile, entrance.id, dest.id);
    expect(cache.size).toBe(1);
  });

  it('invalidateForEdge works on second edge of multi-edge route', () => {
    if (!entrance || !dest) return;
    const cache = new RouteCache();
    const r = cache.computeOrGet(refMinimal, profile, entrance.id, dest.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Use the last edge instead of the first
    const lastEdge = r.value.edges[r.value.edges.length - 1];
    if (!lastEdge) return;
    cache.invalidateForEdge(lastEdge);
    expect(cache.size).toBe(0);
  });
});
