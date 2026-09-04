import { describe, it, expect } from 'vitest';
import {
  auditCoverage,
  auditAccessibility,
  auditEvacuation,
} from '../audit.js';
import type { Support } from '../audit.js';
import {
  refMinimal,
  refBroken,
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

describe('auditCoverage', () => {
  it('refuses when validateGraph fails', () => {
    const result = auditCoverage(
      refBroken,
      getProfile(refBroken.travel_profiles, 0),
      [],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.findings[0]?.code).toBe(
        'GRAPH.NOT_VALIDATED',
      );
    }
  });

  it('computes coverage on valid site', () => {
    const supports: Support[] = [
      { id: 'sup-1', node_id: 'n-junction' },
    ];
    const result = auditCoverage(refMinimal, stdProfile, supports);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.total_decision_points).toBe(1);
      expect(result.value.covered_decision_points).toBe(1);
      expect(result.value.coverage_ratio).toBe(1);
      expect(result.value.uncovered_points).toHaveLength(0);
      expect(result.value.unused_supports).toHaveLength(0);
    }
  });

  it('reports uncovered decision points', () => {
    const result = auditCoverage(refMinimal, stdProfile, []);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.uncovered_points).toContain('n-junction');
      expect(result.value.coverage_ratio).toBe(0);
    }
  });

  it('reports unused supports', () => {
    const supports: Support[] = [
      { id: 'sup-1', node_id: 'n-junction' },
      { id: 'sup-orphan', node_id: 'n-entrance' },
    ];
    const result = auditCoverage(refMinimal, stdProfile, supports);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.unused_supports).toContain('sup-orphan');
    }
  });

  it('deterministic results (INV-4)', () => {
    const supports: Support[] = [
      { id: 'sup-1', node_id: 'n-junction' },
    ];
    const r1 = auditCoverage(refMinimal, stdProfile, supports);
    const r2 = auditCoverage(refMinimal, stdProfile, supports);
    expect(r1).toStrictEqual(r2);
  });

});

describe('auditAccessibility', () => {
  it('rejects non-accessible profile', () => {
    const result = auditAccessibility(refMinimal, stdProfile);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.findings[0]?.code).toBe(
        'GRAPH.PROFILE_NOT_ACCESSIBLE',
      );
    }
  });

  it('all destinations reachable on fully accessible site', () => {
    const accProfile: TravelProfile = {
      ...stdProfile,
      id: 'tp-acc',
      key: 'accessible',
      require_accessible: true,
    };
    const result = auditAccessibility(refMinimal, accProfile);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.unreachable).toHaveLength(0);
      expect(result.value.reachable_destinations).toBe(4);
    }
  });

  it('returns zero unreachable when site has no destinations', () => {
    const noDestSite: SiteData = {
      ...refMinimal,
      destinations: [],
    };
    const accProfile: TravelProfile = {
      ...stdProfile,
      id: 'tp-acc',
      key: 'accessible',
      require_accessible: true,
    };
    const result = auditAccessibility(noDestSite, accProfile);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total_destinations).toBe(0);
    expect(result.value.reachable_destinations).toBe(0);
    expect(result.value.unreachable).toHaveLength(0);
  });

  it('reports unreachable destination via non-accessible edge', () => {
    const partialSite: SiteData = {
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
      id: 'tp-acc',
      key: 'accessible',
      require_accessible: true,
    };
    const result = auditAccessibility(partialSite, accProfile);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const ids = result.value.unreachable.map((u) => u.dest_id);
      expect(ids).toContain('dest-a');
    }
  });
});

describe('auditCoverage — zero decision points', () => {
  it('coverage_ratio is 1 when total is 0', () => {
    // Build a linear graph: two nodes with one edge → max out-degree 1 → no DPs.
    const linearSite: SiteData = {
      ...refMinimal,
      destinations: [],
      graph: {
        ...refMinimal.graph,
        nodes: [
          {
            id: 'n-a',
            org_id: 'org-test-001',
            level_id: 'lvl-gf',
            kind: 'entrance' as const,
            position: { x_m: 0, y_m: 0 },
            label: 'A',
          },
          {
            id: 'n-b',
            org_id: 'org-test-001',
            level_id: 'lvl-gf',
            kind: 'junction' as const,
            position: { x_m: 5, y_m: 0 },
            label: 'B',
          },
        ],
        edges: [
          {
            id: 'e-ab',
            org_id: 'org-test-001',
            from_node_id: 'n-a',
            to_node_id: 'n-b',
            direction: 'both' as const,
            accessible: true,
            evacuation_route: true,
            length_m: 5,
            width_m: 1.5,
            slope_pct: 0,
          },
        ],
        vertical_links: [],
      },
    };
    const result = auditCoverage(linearSite, stdProfile, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total_decision_points).toBe(0);
    expect(result.value.coverage_ratio).toBe(1);
    expect(result.value.uncovered_points).toHaveLength(0);
  });
});

describe('auditAccessibility — self-loop edge', () => {
  it('self-loop edge is skipped in adjacency graph', () => {
    const site: SiteData = {
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
            direction: 'both' as const,
            accessible: true,
            evacuation_route: false,
            length_m: 0,
            width_m: 1.5,
            slope_pct: 0,
          },
        ],
      },
    };
    const accProfile: TravelProfile = {
      ...stdProfile,
      id: 'tp-acc',
      key: 'accessible',
      require_accessible: true,
    };
    const result = auditAccessibility(site, accProfile);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Self-loop should not affect reachability
    expect(result.value.unreachable).toHaveLength(0);
  });
});

describe('auditEvacuation', () => {
  it('reports nodes not on evacuation routes', () => {
    const result = auditEvacuation(refMinimal);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.nodes_with_evacuation_route).toBe(2);
      expect(result.value.uncovered_nodes.length).toBeGreaterThan(0);
    }
  });

  it('entrance and junction are on evacuation route', () => {
    const result = auditEvacuation(refMinimal);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.uncovered_nodes).not.toContain('n-entrance');
      expect(result.value.uncovered_nodes).not.toContain('n-junction');
    }
  });

  it('all nodes uncovered when no evacuation edges', () => {
    const noEvacSite: SiteData = {
      ...refMinimal,
      graph: {
        ...refMinimal.graph,
        edges: refMinimal.graph.edges.map((e) => ({
          ...e,
          evacuation_route: false,
        })),
      },
    };
    const result = auditEvacuation(noEvacSite);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.nodes_with_evacuation_route).toBe(0);
    expect(result.value.uncovered_nodes.length).toBe(
      noEvacSite.graph.nodes.length,
    );
  });

  it('deterministic results (INV-4)', () => {
    const r1 = auditEvacuation(refMinimal);
    const r2 = auditEvacuation(refMinimal);
    expect(r1).toStrictEqual(r2);
  });
});
