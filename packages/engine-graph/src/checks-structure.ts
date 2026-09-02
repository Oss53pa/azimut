import type { SiteData, Finding } from '@azimut/core-model';

export function crossLevelWithoutVlFindings(
  site: SiteData,
): Finding[] {
  const nodeLevelMap = new Map<string, string>();
  for (const n of site.graph.nodes) {
    nodeLevelMap.set(n.id, n.level_id);
  }

  const edgesWithVl = new Set<string>();
  for (const vl of site.graph.vertical_links) {
    edgesWithVl.add(vl.edge_id);
  }

  const findings: Finding[] = [];
  const sorted = [...site.graph.edges].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (const e of sorted) {
    const fromLevel = nodeLevelMap.get(e.from_node_id);
    const toLevel = nodeLevelMap.get(e.to_node_id);
    if (fromLevel !== toLevel && !edgesWithVl.has(e.id)) {
      findings.push({
        code: 'GRAPH.CROSS_LEVEL_WITHOUT_VL',
        severity: 'blocking',
        entity: { kind: 'edge', id: e.id },
        params: {
          from_node_id: e.from_node_id,
          to_node_id: e.to_node_id,
        },
        ruleRef: null,
      });
    }
  }
  return findings;
}

export function multiLevelWithoutAccessibleVlFindings(
  site: SiteData,
): Finding[] {
  const buildingLevels = new Map<string, string[]>();
  for (const level of site.levels) {
    const existing = buildingLevels.get(level.building_id);
    if (existing) {
      existing.push(level.id);
    } else {
      buildingLevels.set(level.building_id, [level.id]);
    }
  }

  const nodeLevelMap = new Map<string, string>();
  for (const n of site.graph.nodes) {
    nodeLevelMap.set(n.id, n.level_id);
  }

  const buildingsWithAccessibleVl = new Set<string>();
  for (const vl of site.graph.vertical_links) {
    if (!vl.accessible) continue;
    const edge = site.graph.edges.find((e) => e.id === vl.edge_id);
    if (!edge) continue;
    const fromLevel = nodeLevelMap.get(edge.from_node_id);
    const toLevel = nodeLevelMap.get(edge.to_node_id);
    if (fromLevel && toLevel && fromLevel !== toLevel) {
      for (const [buildingId, levels] of buildingLevels) {
        if (levels.includes(fromLevel) && levels.includes(toLevel)) {
          buildingsWithAccessibleVl.add(buildingId);
        }
      }
    }
  }

  const findings: Finding[] = [];
  const sortedBuildings = [...site.buildings].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (const building of sortedBuildings) {
    const levels = buildingLevels.get(building.id);
    if (!levels || levels.length < 2) continue;
    if (!buildingsWithAccessibleVl.has(building.id)) {
      findings.push({
        code: 'GRAPH.NO_ACCESSIBLE_VERTICAL_LINK',
        severity: 'warning',
        entity: { kind: 'building', id: building.id },
        params: { name: building.name, level_count: levels.length },
        ruleRef: null,
      });
    }
  }
  return findings;
}

export function missingDestinationNameFindings(
  site: SiteData,
): Finding[] {
  const langs = new Set<string>();
  for (const dn of site.destination_names) {
    langs.add(dn.lang);
  }

  if (langs.size === 0) return [];

  const namesByDest = new Map<string, Set<string>>();
  for (const dn of site.destination_names) {
    const existing = namesByDest.get(dn.destination_id);
    if (existing) {
      existing.add(dn.lang);
    } else {
      namesByDest.set(dn.destination_id, new Set([dn.lang]));
    }
  }

  const findings: Finding[] = [];
  const sorted = [...site.destinations].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const activeLangs = [...langs].sort();
  for (const dest of sorted) {
    const destLangs = namesByDest.get(dest.id);
    for (const lang of activeLangs) {
      if (!destLangs?.has(lang)) {
        findings.push({
          code: 'GRAPH.MISSING_DESTINATION_NAME',
          severity: 'warning',
          entity: { kind: 'destination', id: dest.id },
          params: { lang },
          ruleRef: null,
        });
      }
    }
  }
  return findings;
}
