import { describe, it, expect } from 'vitest';
import {
  crossLevelWithoutVlFindings,
  buildingIsolatedFindings,
  missingDestinationNameFindings,
} from '../checks-structure.js';
import { refMinimal, refMultilevel } from '@azimut/testkit';
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

describe('buildingIsolatedFindings', () => {
  it('returns no findings when buildings have independent access', () => {
    // All reference sites set independent_access: true.
    expect(buildingIsolatedFindings(refMinimal)).toEqual([]);
    expect(buildingIsolatedFindings(refMultilevel)).toEqual([]);
  });

  it('emits a warning for a building with no link nor independent access', () => {
    const site: SiteData = {
      ...refMinimal,
      buildings: refMinimal.buildings.map((b) => ({
        ...b,
        independent_access: false,
      })),
    };
    const findings = buildingIsolatedFindings(site);
    expect(findings.length).toBe(1);
    expect(findings[0]?.code).toBe('GRAPH.BUILDING_ISOLATED');
    expect(findings[0]?.severity).toBe('warning');
    expect(findings[0]?.entity?.kind).toBe('building');
    expect(findings[0]?.entity?.id).toBe('bldg-001');
  });

  it('does not flag a building linked to another building by an edge', () => {
    // Two buildings: bldg-001 (independent access) and bldg-002 (no independent
    // access) tied together by an inter-building edge → neither is isolated.
    const site: SiteData = {
      ...refMinimal,
      buildings: [
        ...refMinimal.buildings,
        {
          id: 'bldg-002',
          org_id: 'org-test-001',
          site_id: refMinimal.site.id,
          name: 'Annexe',
          independent_access: false,
        },
      ],
      levels: [
        ...refMinimal.levels,
        {
          id: 'lvl-002',
          org_id: 'org-test-001',
          building_id: 'bldg-002',
          name: 'RDC Annexe',
          ordinal: 0,
          elevation_m: 0,
        },
      ],
      graph: {
        ...refMinimal.graph,
        nodes: [
          ...refMinimal.graph.nodes,
          {
            id: 'n-annexe',
            org_id: 'org-test-001',
            level_id: 'lvl-002',
            kind: 'junction' as const,
            position: { x_m: 50, y_m: 0 },
            label: 'Annexe',
          },
        ],
        edges: [
          ...refMinimal.graph.edges,
          {
            id: 'e-link-buildings',
            org_id: 'org-test-001',
            from_node_id: 'n-junction',
            to_node_id: 'n-annexe',
            width_m: 2,
            slope_pct: 0,
            accessible: true,
            direction: 'both' as const,
            evacuation_route: false,
            length_m: 50,
          },
        ],
      },
    };
    expect(buildingIsolatedFindings(site)).toEqual([]);
  });

  it('flags the isolated building but not the linked one', () => {
    // bldg-002 has no independent access AND no link → isolated.
    // bldg-001 has independent access and no link either, on a site that now
    // holds two buildings → signalled, not refused (T-1.5).
    const site: SiteData = {
      ...refMinimal,
      buildings: [
        ...refMinimal.buildings,
        {
          id: 'bldg-002',
          org_id: 'org-test-001',
          site_id: refMinimal.site.id,
          name: 'Annexe',
          independent_access: false,
        },
      ],
      levels: [
        ...refMinimal.levels,
        {
          id: 'lvl-002',
          org_id: 'org-test-001',
          building_id: 'bldg-002',
          name: 'RDC Annexe',
          ordinal: 0,
          elevation_m: 0,
        },
      ],
    };
    const findings = buildingIsolatedFindings(site);
    expect(findings.map((f) => [f.entity?.id, f.code])).toEqual([
      ['bldg-001', 'GRAPH.BUILDING_ACCESS_INDEPENDENT_ONLY'],
      ['bldg-002', 'GRAPH.BUILDING_ISOLATED'],
    ]);
    // T-1.5 : « signalé, pas refusé ». Ni l'un ni l'autre n'est bloquant.
    expect(findings.every((f) => f.severity === 'warning')).toBe(true);
  });

  /**
   * T-1.5 : « Un bâtiment à accès indépendant sans liaison est signalé, pas
   * refusé. » Le contrôle l'écartait avant tout constat : un site dont un
   * bâtiment n'était relié à rien passait sans un mot dès que la case était
   * cochée.
   */
  it('signale le bâtiment que son seul accès propre relie au site', () => {
    const site: SiteData = {
      ...refMinimal,
      buildings: [
        ...refMinimal.buildings,
        {
          id: 'bldg-002',
          org_id: 'org-test-001',
          site_id: refMinimal.site.id,
          name: 'Annexe',
          independent_access: true,
        },
      ],
    };
    const findings = buildingIsolatedFindings(site);
    expect(findings.map((f) => f.code)).toEqual([
      'GRAPH.BUILDING_ACCESS_INDEPENDENT_ONLY',
      'GRAPH.BUILDING_ACCESS_INDEPENDENT_ONLY',
    ]);
    expect(findings.every((f) => f.severity === 'warning')).toBe(true);
  });

  /**
   * Le contre-exemple : un site d'un seul bâtiment n'a pas de « reste du
   * site » auquel se relier, et un avertissement que tout site simple
   * porterait ne signalerait plus rien.
   */
  it('ne signale pas l’unique bâtiment d’un site', () => {
    expect(refMinimal.buildings.length).toBe(1);
    expect(buildingIsolatedFindings(refMinimal)).toEqual([]);
  });

  it('findings are sorted by building id', () => {
    const site: SiteData = {
      ...refMinimal,
      buildings: [
        {
          id: 'bldg-zzz',
          org_id: 'org-test-001',
          site_id: refMinimal.site.id,
          name: 'Z',
          independent_access: false,
        },
        {
          id: 'bldg-aaa',
          org_id: 'org-test-001',
          site_id: refMinimal.site.id,
          name: 'A',
          independent_access: false,
        },
      ],
    };
    const ids = buildingIsolatedFindings(site).map((f) => f.entity?.id ?? '');
    expect(ids).toEqual([...ids].sort());
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
