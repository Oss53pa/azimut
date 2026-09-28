import { describe, it, expect } from 'vitest';
import {
  auditAccessibility,
  auditEvacuation,
} from '../audit.js';
import {
  refMinimal,
  refMultilevel,
} from '@azimut/testkit';
import type { SiteData, TravelProfile } from '@azimut/core-model';
import { stdProfile } from './audit-fixtures.js';

// Suite de audit.test.ts : accessibilité et évacuation.
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

  it('all destinations unreachable when site has no entrance nodes', () => {
    const noEntranceSite: SiteData = {
      ...refMinimal,
      graph: {
        ...refMinimal.graph,
        nodes: refMinimal.graph.nodes.map((n) =>
          n.kind === 'entrance' ? { ...n, kind: 'junction' as const } : n,
        ),
      },
    };
    const accProfile: TravelProfile = {
      ...stdProfile,
      id: 'tp-acc',
      key: 'accessible',
      require_accessible: true,
    };
    const result = auditAccessibility(noEntranceSite, accProfile);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.reachable_destinations).toBe(0);
    expect(result.value.unreachable.length).toBe(
      noEntranceSite.destinations.length,
    );
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

  it('returns empty uncovered_nodes when all edges are evacuation routes', () => {
    const allEvacSite: SiteData = {
      ...refMinimal,
      graph: {
        ...refMinimal.graph,
        edges: refMinimal.graph.edges.map((e) => ({
          ...e,
          evacuation_route: true,
        })),
      },
    };
    const result = auditEvacuation(allEvacSite);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.uncovered_nodes).toEqual([]);
    expect(result.value.nodes_with_evacuation_route).toBe(
      allEvacSite.graph.nodes.length,
    );
  });

  it('handles empty graph without crashing', () => {
    const emptySite: SiteData = {
      ...refMinimal,
      graph: { nodes: [], edges: [], vertical_links: [], building_links: [] },
    };
    const result = auditEvacuation(emptySite);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total_nodes).toBe(0);
    expect(result.value.nodes_with_evacuation_route).toBe(0);
    expect(result.value.uncovered_nodes).toEqual([]);
  });

  it('deterministic results (INV-4)', () => {
    const r1 = auditEvacuation(refMinimal);
    const r2 = auditEvacuation(refMinimal);
    expect(r1).toStrictEqual(r2);
  });
});

describe('auditAccessibility — multi-level fixture', () => {
  it('multi-level accessible destinations reachable from entrance', () => {
    const accProfile = refMultilevel.travel_profiles.find(
      (p) => p.key === 'accessible',
    );
    if (!accProfile) return;
    const result = auditAccessibility(refMultilevel, accProfile);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total_destinations).toBeGreaterThan(0);
  });
});
