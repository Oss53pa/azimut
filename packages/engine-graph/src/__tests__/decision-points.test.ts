import { describe, it, expect } from 'vitest';
import { deriveDecisionPoints } from '../decision-points.js';
import {
  refMinimal,
  refBroken,
  refAdversarial,
} from '@azimut/testkit';
import type { SiteData, TravelProfile } from '@azimut/core-model';

function getProfile(
  profiles: readonly TravelProfile[],
  idx: number,
): TravelProfile {
  const p = profiles[idx];
  if (!p) throw new Error(`No profile at index ${idx}`);
  return p;
}

const stdProfile = getProfile(refMinimal.travel_profiles, 0);

describe('deriveDecisionPoints', () => {
  it('identifies junction in refMinimal as decision point', () => {
    const result = deriveDecisionPoints(
      refMinimal,
      stdProfile,
      refMinimal.destinations,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const ids = result.value.map((dp) => dp.node_id);
      expect(ids).toContain('n-junction');
      const junction = result.value.find(
        (dp) => dp.node_id === 'n-junction',
      );
      expect(junction?.branch_count).toBe(5);
    }
  });

  it('entrance with single edge is NOT a decision point', () => {
    const result = deriveDecisionPoints(
      refMinimal,
      stdProfile,
      refMinimal.destinations,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const ids = result.value.map((dp) => dp.node_id);
      expect(ids).not.toContain('n-entrance');
    }
  });

  it('destination_access with single edge is NOT a decision point', () => {
    const result = deriveDecisionPoints(
      refMinimal,
      stdProfile,
      refMinimal.destinations,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const ids = result.value.map((dp) => dp.node_id);
      expect(ids).not.toContain('n-dest-a');
    }
  });

  it('node B in refAdversarial is a decision point (3 branches)', () => {
    const advProfile = getProfile(refAdversarial.travel_profiles, 0);
    const result = deriveDecisionPoints(
      refAdversarial,
      advProfile,
      refAdversarial.destinations,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const b = result.value.find((dp) => dp.node_id === 'n-adv-b');
      expect(b).toBeDefined();
      expect(b?.branch_count).toBe(3);
    }
  });

  it('destination node is excluded from decision points', () => {
    const advProfile = getProfile(refAdversarial.travel_profiles, 0);
    const result = deriveDecisionPoints(
      refAdversarial,
      advProfile,
      refAdversarial.destinations,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const ids = result.value.map((dp) => dp.node_id);
      expect(ids).not.toContain('n-adv-c');
    }
  });

  it('orphan node is not a decision point', () => {
    const brkProfile = getProfile(refBroken.travel_profiles, 0);
    const result = deriveDecisionPoints(
      refBroken,
      brkProfile,
      refBroken.destinations,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const ids = result.value.map((dp) => dp.node_id);
      expect(ids).not.toContain('n-brk-orphan');
    }
  });

  it('deterministic: identical results on two calls (INV-4)', () => {
    const r1 = deriveDecisionPoints(
      refMinimal,
      stdProfile,
      refMinimal.destinations,
    );
    const r2 = deriveDecisionPoints(
      refMinimal,
      stdProfile,
      refMinimal.destinations,
    );
    expect(r1).toStrictEqual(r2);
  });

  it('accessible profile reduces branch count', () => {
    const mixedSite: SiteData = {
      ...refMinimal,
      graph: {
        ...refMinimal.graph,
        edges: refMinimal.graph.edges.map((e) =>
          e.id === 'e-02' ? { ...e, accessible: false } : e,
        ),
      },
    };
    const accProfile: TravelProfile = {
      ...stdProfile,
      id: 'tp-accessible',
      key: 'accessible',
      require_accessible: true,
    };
    const result = deriveDecisionPoints(
      mixedSite,
      accProfile,
      refMinimal.destinations,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const junction = result.value.find(
        (dp) => dp.node_id === 'n-junction',
      );
      expect(junction?.branch_count).toBe(4);
    }
  });

  it('handles empty graph', () => {
    const empty: SiteData = {
      ...refMinimal,
      graph: { nodes: [], edges: [], vertical_links: [] },
      destinations: [],
      destination_names: [],
    };
    const result = deriveDecisionPoints(empty, stdProfile, []);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(0);
    }
  });

  it('self-loop edge does not inflate degree', () => {
    const selfLoopSite: SiteData = {
      ...refMinimal,
      graph: {
        ...refMinimal.graph,
        edges: [
          ...refMinimal.graph.edges,
          {
            id: 'e-self',
            org_id: 'org-ref',
            from_node_id: 'n-entrance',
            to_node_id: 'n-entrance',
            length_m: 0,
            width_m: 1,
            slope_pct: 0,
            accessible: true,
            direction: 'both' as const,
            evacuation_route: false,
          },
        ],
      },
    };
    const result = deriveDecisionPoints(
      selfLoopSite,
      stdProfile,
      refMinimal.destinations,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const ids = result.value.map((dp) => dp.node_id);
      // Entrance still has only 1 real edge → not a decision point
      expect(ids).not.toContain('n-entrance');
    }
  });

  it('forward-only edge increments only from-node degree', () => {
    const fwdSite: SiteData = {
      ...refMinimal,
      graph: {
        ...refMinimal.graph,
        edges: refMinimal.graph.edges.map((e) => ({
          ...e,
          direction: 'forward' as const,
        })),
      },
    };
    const result = deriveDecisionPoints(
      fwdSite,
      stdProfile,
      refMinimal.destinations,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // With forward-only edges, to-nodes don't see traversals from them
    // n-junction: still has 3 forward out-edges → degree 3 → DP
    const dp = result.value.find((p) => p.node_id === 'n-junction');
    expect(dp).toBeDefined();
  });

  it('degree exactly 2 qualifies as decision point', () => {
    // Build a Y-graph: 3 nodes, center has degree 2
    const ySite: SiteData = {
      ...refMinimal,
      destinations: [],
      graph: {
        nodes: [
          { id: 'n-1', org_id: 'org-test-001', level_id: 'lvl-gf', kind: 'junction' as const, position: { x_m: 0, y_m: 0 }, label: '1' },
          { id: 'n-2', org_id: 'org-test-001', level_id: 'lvl-gf', kind: 'junction' as const, position: { x_m: 1, y_m: 0 }, label: '2' },
          { id: 'n-3', org_id: 'org-test-001', level_id: 'lvl-gf', kind: 'junction' as const, position: { x_m: 2, y_m: 0 }, label: '3' },
        ],
        edges: [
          { id: 'e-12', org_id: 'org-test-001', from_node_id: 'n-1', to_node_id: 'n-2', direction: 'both' as const, accessible: true, evacuation_route: false, length_m: 1, width_m: 1.5, slope_pct: 0 },
          { id: 'e-23', org_id: 'org-test-001', from_node_id: 'n-2', to_node_id: 'n-3', direction: 'both' as const, accessible: true, evacuation_route: false, length_m: 1, width_m: 1.5, slope_pct: 0 },
        ],
        vertical_links: [],
      },
    };
    const result = deriveDecisionPoints(ySite, stdProfile, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const dp = result.value.find((p) => p.node_id === 'n-2');
    expect(dp).toBeDefined();
    expect(dp?.branch_count).toBe(2);
  });

  it('dead-end junction (degree 1) is not a decision point', () => {
    const brkProfile = getProfile(refBroken.travel_profiles, 0);
    const result = deriveDecisionPoints(refBroken, brkProfile, refBroken.destinations);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.value.map((dp) => dp.node_id);
    expect(ids).not.toContain('n-brk-deadend');
  });

  it('backward-only edge increments only to-node degree', () => {
    const bwdSite: SiteData = {
      ...refMinimal,
      graph: {
        ...refMinimal.graph,
        edges: refMinimal.graph.edges.map((e) => ({
          ...e,
          direction: 'backward' as const,
        })),
      },
    };
    const result = deriveDecisionPoints(bwdSite, stdProfile, refMinimal.destinations);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // With backward-only, from_node cannot traverse → degree comes from to-side only
    const dp = result.value.find((p) => p.node_id === 'n-junction');
    // n-junction is from_node on most edges → cannot traverse backward → low degree
    expect(dp).toBeUndefined();
  });

  it('fully inaccessible graph yields zero decision points', () => {
    const inaccessibleSite: SiteData = {
      ...refMinimal,
      graph: {
        ...refMinimal.graph,
        edges: refMinimal.graph.edges.map((e) => ({
          ...e,
          accessible: false,
        })),
      },
    };
    const accProfile: TravelProfile = {
      ...stdProfile,
      id: 'tp-acc',
      key: 'accessible',
      require_accessible: true,
    };
    const result = deriveDecisionPoints(
      inaccessibleSite,
      accProfile,
      refMinimal.destinations,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(0);
    }
  });
});
