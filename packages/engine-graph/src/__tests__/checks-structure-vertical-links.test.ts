import { describe, it, expect } from 'vitest';
import {
  multiLevelWithoutAnyVlFindings,
  multiLevelWithoutAccessibleVlFindings,
} from '../checks-structure.js';
import { refMinimal, refMultilevel, refBroken } from '@azimut/testkit';
import type { SiteData } from '@azimut/core-model';

// Suite de checks-structure.test.ts : liaisons verticales entre niveaux.
describe('multiLevelWithoutAccessibleVlFindings', () => {
  it('returns no findings for single-level buildings', () => {
    const findings = multiLevelWithoutAccessibleVlFindings(refMinimal);
    expect(findings).toEqual([]);
  });

  it('returns no findings when multi-level has accessible VL', () => {
    const findings = multiLevelWithoutAccessibleVlFindings(refMultilevel);
    expect(findings).toEqual([]);
  });

  it('emits warning when multi-level building lacks accessible VL', () => {
    const site: SiteData = {
      ...refMultilevel,
      graph: {
        ...refMultilevel.graph,
        vertical_links: refMultilevel.graph.vertical_links.map((vl) => ({
          ...vl,
          accessible: false,
        })),
      },
    };
    const findings = multiLevelWithoutAccessibleVlFindings(site);
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      expect(f.code).toBe('GRAPH.LEVEL_NO_ACCESSIBLE_LINK');
      expect(f.severity).toBe('warning');
      expect(f.entity?.kind).toBe('building');
    }
  });
});

describe('multiLevelWithoutAnyVlFindings', () => {
  it('returns no findings for single-level buildings', () => {
    const findings = multiLevelWithoutAnyVlFindings(refMinimal);
    expect(findings).toEqual([]);
  });

  it('returns no findings when multi-level has vertical links', () => {
    const findings = multiLevelWithoutAnyVlFindings(refMultilevel);
    expect(findings).toEqual([]);
  });

  it('emits blocking finding for multi-level building without any VL', () => {
    const findings = multiLevelWithoutAnyVlFindings(refBroken);
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      expect(f.code).toBe('GRAPH.LEVEL_NO_VERTICAL_LINK');
      expect(f.severity).toBe('blocking');
      expect(f.entity?.kind).toBe('building');
    }
  });

  it('does not fire when VLs exist even if not accessible', () => {
    // refMultilevel has VLs — making them non-accessible should still pass
    // the "any VL" check (only the accessible check should fire).
    const site: SiteData = {
      ...refMultilevel,
      graph: {
        ...refMultilevel.graph,
        vertical_links: refMultilevel.graph.vertical_links.map((vl) => ({
          ...vl,
          accessible: false,
        })),
      },
    };
    const findings = multiLevelWithoutAnyVlFindings(site);
    expect(findings).toEqual([]);
  });

  it('findings are sorted by building id', () => {
    const findings = multiLevelWithoutAnyVlFindings(refBroken);
    const ids = findings.map((f) => f.entity?.id ?? '');
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });
});

describe('multiLevelWithoutAnyVlFindings — VL edge not found', () => {
  it('skips VL whose edge_id does not exist in edges', () => {
    // Give a VL that references a non-existent edge. The check should
    // still report no VL for the building (the orphan VL is skipped).
    const site: SiteData = {
      ...refMultilevel,
      graph: {
        ...refMultilevel.graph,
        vertical_links: [
          {
            id: 'vl-orphan',
            org_id: 'org-test-001',
            edge_id: 'e-does-not-exist',
            kind: 'elevator' as const,
            capacity: 10,
            accessible: true,
          },
        ],
      },
    };
    const findings = multiLevelWithoutAnyVlFindings(site);
    // The building has 2+ levels but the only VL references
    // a non-existent edge → building should be flagged
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]?.code).toBe('GRAPH.LEVEL_NO_VERTICAL_LINK');
  });
});

describe('multiLevelWithoutAnyVlFindings — same-level VL ignored', () => {
  it('flags building when VL edge connects nodes on same level', () => {
    const site: SiteData = {
      ...refMultilevel,
      graph: {
        ...refMultilevel.graph,
        vertical_links: [
          {
            id: 'vl-same-level',
            org_id: 'org-test-001',
            edge_id: 'e-ml-hall-dest',
            kind: 'elevator' as const,
            capacity: 8,
            accessible: true,
          },
        ],
      },
    };
    const findings = multiLevelWithoutAnyVlFindings(site);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]?.code).toBe('GRAPH.LEVEL_NO_VERTICAL_LINK');
  });
});

describe('multiLevelWithoutAccessibleVlFindings — same-level VL ignored', () => {
  it('flags building when accessible VL edge connects nodes on same level', () => {
    const site: SiteData = {
      ...refMultilevel,
      graph: {
        ...refMultilevel.graph,
        vertical_links: [
          {
            id: 'vl-same-level',
            org_id: 'org-test-001',
            edge_id: 'e-ml-hall-dest',
            kind: 'elevator' as const,
            capacity: 8,
            accessible: true,
          },
        ],
      },
    };
    const findings = multiLevelWithoutAccessibleVlFindings(site);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]?.code).toBe('GRAPH.LEVEL_NO_ACCESSIBLE_LINK');
  });
});

describe('multiLevelWithoutAccessibleVlFindings — VL edge not found', () => {
  it('skips VL whose edge_id does not exist in edges', () => {
    const site: SiteData = {
      ...refMultilevel,
      graph: {
        ...refMultilevel.graph,
        vertical_links: [
          {
            id: 'vl-orphan',
            org_id: 'org-test-001',
            edge_id: 'e-does-not-exist',
            kind: 'elevator' as const,
            capacity: 10,
            accessible: true,
          },
        ],
      },
    };
    const findings = multiLevelWithoutAccessibleVlFindings(site);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]?.code).toBe('GRAPH.LEVEL_NO_ACCESSIBLE_LINK');
  });
});

describe('orphan node in VL edge', () => {
  const orphanVlSite: SiteData = {
    ...refMultilevel,
    graph: {
      ...refMultilevel.graph,
      edges: [...refMultilevel.graph.edges, {
        id: 'e-orphan-vl', org_id: 'org-test-001', from_node_id: 'n-ml-elevator-rdc',
        to_node_id: 'n-orphan-missing', width_m: 2, slope_pct: 0, accessible: true,
        direction: 'both' as const, evacuation_route: false, length_m: 0,
      }],
      vertical_links: [{
        id: 'vl-orphan-node', org_id: 'org-test-001', edge_id: 'e-orphan-vl',
        kind: 'elevator' as const, capacity: 10, accessible: true,
      }],
    },
  };

  it('multiLevelWithoutAnyVl — orphan VL does not count as cross-level', () => {
    const findings = multiLevelWithoutAnyVlFindings(orphanVlSite);
    expect(findings.some((f) => f.code === 'GRAPH.LEVEL_NO_VERTICAL_LINK')).toBe(true);
  });

  it('multiLevelWithoutAccessibleVl — orphan VL does not count as cross-level', () => {
    const findings = multiLevelWithoutAccessibleVlFindings(orphanVlSite);
    expect(findings.some((f) => f.code === 'GRAPH.LEVEL_NO_ACCESSIBLE_LINK')).toBe(true);
  });
});
