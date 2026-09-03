import { describe, it, expect } from 'vitest';
import { computeRoute } from '../compute-route.js';
import { RouteCache } from '../route-cache.js';
import {
  refMinimal,
  refBroken,
  refAdversarial,
} from '@azimut/testkit';
import type { SiteData } from '@azimut/core-model';

import type { TravelProfile } from '@azimut/core-model';

function getProfile(
  profiles: readonly TravelProfile[],
  idx: number,
): TravelProfile {
  const p = profiles[idx];
  if (!p) throw new Error(`No profile at index ${idx}`);
  return p;
}

const stdProfile = getProfile(refMinimal.travel_profiles, 0);
const advProfile = getProfile(refAdversarial.travel_profiles, 0);

describe('computeRoute', () => {
  it('finds shortest path on refMinimal', () => {
    const result = computeRoute(
      refMinimal,
      stdProfile,
      'n-entrance',
      'n-dest-a',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.path).toStrictEqual([
        'n-entrance',
        'n-junction',
        'n-dest-a',
      ]);
      expect(result.value.cost).toBeCloseTo(21.18, 1);
    }
  });

  it('same origin and destination returns zero-cost path', () => {
    const result = computeRoute(
      refMinimal,
      stdProfile,
      'n-entrance',
      'n-entrance',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.path).toStrictEqual(['n-entrance']);
      expect(result.value.edges).toStrictEqual([]);
      expect(result.value.cost).toBe(0);
    }
  });

  it('returns error for unknown node', () => {
    const result = computeRoute(
      refMinimal,
      stdProfile,
      'n-entrance',
      'n-nonexistent',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.findings[0]?.code).toBe('GRAPH.ROUTE_NODE_NOT_FOUND');
    }
  });

  it('returns unreachable for disconnected graph', () => {
    const result = computeRoute(
      refBroken,
      getProfile(refBroken.travel_profiles, 0),
      'n-brk-entrance',
      'n-brk-island-a',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.findings[0]?.code).toBe('GRAPH.ROUTE_UNREACHABLE');
    }
  });

  it('deterministic: same result on two calls (INV-4)', () => {
    const r1 = computeRoute(
      refMinimal,
      stdProfile,
      'n-entrance',
      'n-dest-b',
    );
    const r2 = computeRoute(
      refMinimal,
      stdProfile,
      'n-entrance',
      'n-dest-b',
    );
    expect(r1).toStrictEqual(r2);
  });

  it('respects edge direction (forward only)', () => {
    const oneWaySite: SiteData = {
      ...refMinimal,
      graph: {
        ...refMinimal.graph,
        edges: refMinimal.graph.edges.map((e) =>
          e.id === 'e-02'
            ? { ...e, direction: 'forward' as const }
            : e,
        ),
      },
    };
    const forward = computeRoute(
      oneWaySite,
      stdProfile,
      'n-junction',
      'n-dest-a',
    );
    expect(forward.ok).toBe(true);

    const backward = computeRoute(
      oneWaySite,
      stdProfile,
      'n-dest-a',
      'n-junction',
    );
    expect(backward.ok).toBe(false);
    if (!backward.ok) {
      expect(backward.findings[0]?.code).toBe('GRAPH.ROUTE_UNREACHABLE');
    }
  });

  it('accessible profile avoids non-accessible edges', () => {
    const mixedSite: SiteData = {
      ...refMinimal,
      graph: {
        ...refMinimal.graph,
        edges: refMinimal.graph.edges.map((e) =>
          e.id === 'e-02' ? { ...e, accessible: false } : e,
        ),
      },
      travel_profiles: [
        {
          ...stdProfile,
          id: 'tp-accessible',
          key: 'accessible',
          require_accessible: true,
        },
      ],
    };
    const accProfile = getProfile(mixedSite.travel_profiles, 0);

    const result = computeRoute(
      mixedSite,
      accProfile,
      'n-entrance',
      'n-dest-a',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.findings[0]?.code).toBe('GRAPH.ROUTE_UNREACHABLE');
    }
  });

  it('returns error for unknown from node', () => {
    const result = computeRoute(
      refMinimal,
      stdProfile,
      'n-nonexistent',
      'n-dest-a',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.findings[0]?.code).toBe('GRAPH.ROUTE_NODE_NOT_FOUND');
    }
  });

  it('self-loop edge is skipped in routing', () => {
    const selfLoopSite: SiteData = {
      ...refMinimal,
      graph: {
        ...refMinimal.graph,
        edges: [
          ...refMinimal.graph.edges,
          {
            id: 'e-self',
            org_id: 'org-test-001',
            from_node_id: 'n-junction',
            to_node_id: 'n-junction',
            length_m: 1,
            width_m: 2,
            slope_pct: 0,
            accessible: true,
            direction: 'both' as const,
            evacuation_route: false,
          },
        ],
      },
    };
    // Route should still work — self-loop is silently discarded
    const result = computeRoute(
      selfLoopSite,
      stdProfile,
      'n-entrance',
      'n-dest-a',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Path goes through junction; self-loop doesn't appear as a detour
      expect(result.value.path).toContain('n-junction');
      expect(result.value.cost).toBeGreaterThan(0);
      // Self-loop edge is not in the route
      expect(result.value.edges).not.toContain('e-self');
    }
  });

  it('handles equal-cost paths deterministically on refAdversarial', () => {
    const r1 = computeRoute(
      refAdversarial,
      advProfile,
      'n-adv-a',
      'n-adv-c',
    );
    const r2 = computeRoute(
      refAdversarial,
      advProfile,
      'n-adv-a',
      'n-adv-c',
    );
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (r1.ok && r2.ok) {
      expect(r1.value.path).toStrictEqual(r2.value.path);
      expect(r1.value.cost).toBe(r2.value.cost);
    }
  });
});

describe('RouteCache', () => {
  it('caches and returns same result', () => {
    const cache = new RouteCache();
    const r1 = cache.computeOrGet(
      refMinimal,
      stdProfile,
      'n-entrance',
      'n-dest-a',
    );
    const r2 = cache.computeOrGet(
      refMinimal,
      stdProfile,
      'n-entrance',
      'n-dest-a',
    );
    expect(r1).toStrictEqual(r2);
    expect(cache.size).toBe(1);
  });

  it('invalidates cache when edge changes', () => {
    const cache = new RouteCache();
    cache.computeOrGet(
      refMinimal,
      stdProfile,
      'n-entrance',
      'n-dest-a',
    );
    expect(cache.size).toBe(1);

    cache.invalidateForEdge('e-02');
    expect(cache.size).toBe(0);
  });

  it('detects stale cache by inputs_hash change', () => {
    const cache = new RouteCache();
    const r1 = cache.computeOrGet(
      refMinimal,
      stdProfile,
      'n-entrance',
      'n-dest-a',
    );
    expect(cache.size).toBe(1);

    const modifiedSite: SiteData = {
      ...refMinimal,
      graph: {
        ...refMinimal.graph,
        edges: refMinimal.graph.edges.map((e) =>
          e.id === 'e-02' ? { ...e, length_m: 999 } : e,
        ),
      },
    };

    const r2 = cache.computeOrGet(
      modifiedSite,
      stdProfile,
      'n-entrance',
      'n-dest-a',
    );
    expect(r2.ok).toBe(true);
    if (r1.ok && r2.ok) {
      expect(r2.value.cost).toBeGreaterThan(r1.value.cost);
    }
  });

  it('invalidateAll clears entire cache', () => {
    const cache = new RouteCache();
    cache.computeOrGet(
      refMinimal,
      stdProfile,
      'n-entrance',
      'n-dest-a',
    );
    cache.computeOrGet(
      refMinimal,
      stdProfile,
      'n-entrance',
      'n-dest-b',
    );
    expect(cache.size).toBe(2);

    cache.invalidateAll();
    expect(cache.size).toBe(0);
  });
});
