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

  it('deterministic results (INV-4)', () => {
    const r1 = auditEvacuation(refMinimal);
    const r2 = auditEvacuation(refMinimal);
    expect(r1).toStrictEqual(r2);
  });
});
