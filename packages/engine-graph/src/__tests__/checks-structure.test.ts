import { describe, it, expect } from 'vitest';
import {
  crossLevelWithoutVlFindings,
  multiLevelWithoutAnyVlFindings,
  multiLevelWithoutAccessibleVlFindings,
  missingDestinationNameFindings,
} from '../checks-structure.js';
import { refMinimal, refMultilevel, refBroken } from '@azimut/testkit';
import type { SiteData } from '@azimut/core-model';

describe('crossLevelWithoutVlFindings', () => {
  it('returns no findings for minimal site (single level)', () => {
    const findings = crossLevelWithoutVlFindings(refMinimal);
    expect(findings).toEqual([]);
  });

  it('returns no findings when all cross-level edges have VLs', () => {
    const findings = crossLevelWithoutVlFindings(refMultilevel);
    expect(findings).toEqual([]);
  });

  it('emits GRAPH.VERTICAL_LINK_MISSING for cross-level edge without VL', () => {
    const site: SiteData = {
      ...refMultilevel,
      graph: {
        ...refMultilevel.graph,
        vertical_links: [],
      },
    };
    const findings = crossLevelWithoutVlFindings(site);
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      expect(f.code).toBe('GRAPH.VERTICAL_LINK_MISSING');
      expect(f.severity).toBe('blocking');
      expect(f.entity?.kind).toBe('edge');
    }
  });

  it('partial VL removal: only uncovered edge emits finding', () => {
    const site: SiteData = {
      ...refMultilevel,
      graph: {
        ...refMultilevel.graph,
        vertical_links: refMultilevel.graph.vertical_links.filter((vl) => vl.id !== 'vl-ml-elevator'),
      },
    };
    const findings = crossLevelWithoutVlFindings(site);
    expect(findings.length).toBe(1);
    expect(findings[0]?.entity?.id).toBe('e-ml-elevator-vl');
  });

  it('findings are sorted by edge id', () => {
    const site: SiteData = {
      ...refMultilevel,
      graph: {
        ...refMultilevel.graph,
        vertical_links: [],
      },
    };
    const findings = crossLevelWithoutVlFindings(site);
    const ids = findings.map((f) => f.entity?.id ?? '');
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it('edge referencing orphan node is treated as cross-level', () => {
    const site: SiteData = { ...refMinimal, graph: { ...refMinimal.graph,
      edges: [...refMinimal.graph.edges, { id: 'e-orphan', org_id: 'org-test-001', from_node_id: 'n-nonexistent', to_node_id: 'n-entrance', width_m: 2, slope_pct: 0, accessible: true, direction: 'both' as const, evacuation_route: false, length_m: 0 }] } };
    const findings = crossLevelWithoutVlFindings(site);
    expect(findings.some((f) => f.entity?.id === 'e-orphan')).toBe(true);
  });
});

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

describe('missingDestinationNameFindings', () => {
  it('returns no findings when no destination names exist', () => {
    const site: SiteData = {
      ...refMinimal,
      destination_names: [],
    };
    const findings = missingDestinationNameFindings(site);
    expect(findings).toEqual([]);
  });

  it('returns no findings when all destinations have all langs', () => {
    const findings = missingDestinationNameFindings(refMultilevel);
    expect(findings).toEqual([]);
  });

  it('emits warning for missing lang on a destination', () => {
    // Remove 'en' for only the first destination; the second still has it
    // so 'en' remains an active lang, but first dest is missing it
    const firstDestId = refMultilevel.destinations[0]?.id;
    if (!firstDestId) return;
    const site: SiteData = {
      ...refMultilevel,
      destination_names: refMultilevel.destination_names.filter(
        (dn) => !(dn.destination_id === firstDestId && dn.lang === 'en'),
      ),
    };
    const findings = missingDestinationNameFindings(site);
    const enFindings = findings.filter((f) => f.params['lang'] === 'en');
    expect(enFindings.length).toBeGreaterThan(0);
    expect(enFindings[0]?.entity?.id).toBe(firstDestId);
    for (const f of enFindings) {
      expect(f.code).toBe('GRAPH.DESTINATION_NAME_MISSING');
      expect(f.severity).toBe('warning');
      expect(f.entity?.kind).toBe('destination');
    }
  });

  it('findings are sorted by destination id', () => {
    // Remove 'en' for first dest only, ensuring sorted output
    const firstDestId = refMultilevel.destinations[0]?.id;
    if (!firstDestId) return;
    const site: SiteData = {
      ...refMultilevel,
      destination_names: refMultilevel.destination_names.filter(
        (dn) => !(dn.destination_id === firstDestId && dn.lang === 'en'),
      ),
    };
    const findings = missingDestinationNameFindings(site);
    const ids = findings.map((f) => f.entity?.id ?? '');
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it('emits findings for destination with zero name entries', () => {
    // Add a destination that has NO entries in destination_names at all.
    // Other destinations keep their names → langs set is non-empty →
    // the new dest triggers DESTINATION_NAME_MISSING for every active lang.
    const site: SiteData = {
      ...refMultilevel,
      destinations: [
        ...refMultilevel.destinations,
        {
          id: 'dest-nonames',
          org_id: 'org-test-001',
          footprint_id: 'fp-ml-hall',
          node_id: 'n-ml-hall',
          category_id: 'cat-ml-office',
          occupant_name: 'No Names',
          occupancy_status: 'occupied' as const,
          display_priority: 0,
        },
      ],
    };
    const findings = missingDestinationNameFindings(site);
    const noNameFindings = findings.filter(
      (f) => f.entity?.id === 'dest-nonames',
    );
    // Should have one finding per active language
    const activeLangs = new Set(
      site.destination_names.map((dn) => dn.lang),
    );
    expect(noNameFindings).toHaveLength(activeLangs.size);
    for (const f of noNameFindings) {
      expect(f.code).toBe('GRAPH.DESTINATION_NAME_MISSING');
    }
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
