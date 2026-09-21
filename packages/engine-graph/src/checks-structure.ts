import type { SiteData, Finding } from '@azimut/core-model';
import { POINT_COINCIDENCE_M, roundHalfAwayFromZero } from '@azimut/core-model';
import { buildDirectedAdjacency, bfs } from './graph-traversal.js';

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
        code: 'GRAPH.VERTICAL_LINK_MISSING',
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

export function multiLevelWithoutAnyVlFindings(
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

  const buildingsWithVl = new Set<string>();
  for (const vl of site.graph.vertical_links) {
    const edge = site.graph.edges.find((e) => e.id === vl.edge_id);
    if (!edge) continue;
    const fromLevel = nodeLevelMap.get(edge.from_node_id);
    const toLevel = nodeLevelMap.get(edge.to_node_id);
    if (fromLevel && toLevel && fromLevel !== toLevel) {
      for (const [buildingId, levels] of buildingLevels) {
        if (levels.includes(fromLevel) && levels.includes(toLevel)) {
          buildingsWithVl.add(buildingId);
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
    if (!buildingsWithVl.has(building.id)) {
      findings.push({
        code: 'GRAPH.LEVEL_NO_VERTICAL_LINK',
        severity: 'blocking',
        entity: { kind: 'building', id: building.id },
        params: { name: building.name, level_count: levels.length },
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
        code: 'GRAPH.LEVEL_NO_ACCESSIBLE_LINK',
        severity: 'warning',
        entity: { kind: 'building', id: building.id },
        params: { name: building.name, level_count: levels.length },
        ruleRef: null,
      });
    }
  }
  return findings;
}

/**
 * GRAPH.BUILDING_ISOLATED — a building that has neither a link to the rest
 * of the site (an edge whose two endpoints resolve to two different
 * buildings) nor its own independent access. Warning per D2.2.
 */
export function buildingIsolatedFindings(
  site: SiteData,
): Finding[] {
  const levelBuilding = new Map<string, string>();
  for (const level of site.levels) {
    levelBuilding.set(level.id, level.building_id);
  }

  const nodeBuilding = new Map<string, string>();
  for (const n of site.graph.nodes) {
    const b = levelBuilding.get(n.level_id);
    if (b !== undefined) nodeBuilding.set(n.id, b);
  }

  // Buildings tied to the rest of the site by at least one inter-building edge.
  const linkedBuildings = new Set<string>();
  for (const e of site.graph.edges) {
    const fromB = nodeBuilding.get(e.from_node_id);
    const toB = nodeBuilding.get(e.to_node_id);
    if (fromB !== undefined && toB !== undefined && fromB !== toB) {
      linkedBuildings.add(fromB);
      linkedBuildings.add(toB);
    }
  }

  const findings: Finding[] = [];
  const sortedBuildings = [...site.buildings].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (const building of sortedBuildings) {
    if (building.independent_access) continue;
    if (linkedBuildings.has(building.id)) continue;
    findings.push({
      code: 'GRAPH.BUILDING_ISOLATED',
      severity: 'warning',
      entity: { kind: 'building', id: building.id },
      params: { name: building.name },
      ruleRef: null,
    });
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
          code: 'GRAPH.DESTINATION_NAME_MISSING',
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

/**
 * QC-12 — une liaison verticale qui ne tombe pas au même endroit d'un niveau à
 * l'autre (complément atelier).
 *
 * P5 (complément atelier) : « Un ascenseur, un escalier ou une rampe occupe le
 * même point sur les deux niveaux qu'il relie. » Un visiteur qui monte par
 * l'ascenseur ressort au même endroit du plan ; si les deux nœuds ne
 * coïncident pas, le plan du niveau supérieur place la sortie ailleurs que là
 * où elle est, et aucun contrôle existant ne le voyait — `VERTICAL_LINK_MISSING`
 * ne juge que la présence de la liaison, pas sa position.
 *
 * **Le seuil n'est pas inventé et n'est pas normatif.** P5 dit « le même
 * point » ; D1.5 définit déjà `POINT_COINCIDENCE_M` comme la distance en deçà
 * de laquelle deux points sont le même point, et la range explicitement parmi
 * les tolérances techniques. Le contrôle applique cette définition, il n'en
 * pose pas une nouvelle.
 *
 * **L'escalier mécanique est hors du contrôle**, et c'est le seul choix que ce
 * module prend. P5 énumère trois natures et ne le cite pas ; un escalier
 * mécanique franchit d'ailleurs sa hauteur en avançant, ses deux extrémités ne
 * peuvent pas coïncider. Le retenir produirait une anomalie bloquante sur une
 * géométrie correcte. Le titre de QC-12, « liaison verticale non alignée », se
 * lirait plus largement : l'écart entre l'énumération de P5 et ce titre n'est
 * pas tranché ici.
 */
export function verticalLinkMisalignedFindings(
  site: SiteData,
): Finding[] {
  const nodeById = new Map(site.graph.nodes.map((n) => [n.id, n]));
  const edgeById = new Map(site.graph.edges.map((e) => [e.id, e]));

  const findings: Finding[] = [];
  const sorted = [...site.graph.vertical_links].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (const link of sorted) {
    if (link.kind === 'escalator') continue;
    const edge = edgeById.get(link.edge_id);
    if (edge === undefined) continue;
    const from = nodeById.get(edge.from_node_id);
    const to = nodeById.get(edge.to_node_id);
    if (from === undefined || to === undefined) continue;
    // Une liaison dont les deux nœuds sont sur le même niveau n'est pas une
    // liaison verticale : `VERTICAL_LINK_MISSING` couvre l'inverse, et il n'y a
    // rien à aligner entre un niveau et lui-même.
    if (from.level_id === to.level_id) continue;

    const offset = Math.hypot(
      from.position.x_m - to.position.x_m,
      from.position.y_m - to.position.y_m,
    );
    if (offset <= POINT_COINCIDENCE_M) continue;

    findings.push({
      code: 'GRAPH.VERTICAL_LINK_MISALIGNED',
      severity: 'blocking',
      entity: { kind: 'vertical_link', id: link.id },
      params: {
        kind: link.kind,
        edge_id: link.edge_id,
        from_node_id: from.id,
        to_node_id: to.id,
        from_level_id: from.level_id,
        to_level_id: to.level_id,
        // Rapporté au millimètre entier, par D1.4 : un écart s'annonce au
        // millimètre, pas avec quinze décimales.
        offset_mm: roundHalfAwayFromZero(offset * 1000),
      },
      ruleRef: 'atelier-QC-12',
    });
  }
  return findings;
}

/**
 * QC-10 — une destination que toutes les entrées n'atteignent pas (complément
 * atelier).
 *
 * Le contrôle existant, `GRAPH.DESTINATION_UNREACHABLE`, réunit ce que toutes
 * les entrées atteignent et signale ce qui reste dehors. Il répond donc à
 * « peut-on y aller ? », quand QC-10 demande « peut-on y aller **d'où qu'on
 * entre** ? ». Un visiteur qui pousse la porte nord et un autre qui pousse la
 * porte sud ne sont pas au même endroit ; une aile qu'une seule des deux
 * dessert est un défaut de jalonnement que rien ne voyait.
 *
 * Il lit de plus le sens de circulation, que les contrôles de structure
 * ignorent — voir `buildDirectedAdjacency`. Un sens unique qui coupe une aile
 * la laisse reliée au sens du modèle, donc muette pour eux.
 *
 * **« Nœud public » est lu comme « nœud portant une destination ».** Le modèle
 * ne classe pas les nœuds en publics et privés ; en inventer la notion serait
 * un choix de modèle de données (A2.2). Les destinations sont ce que le site
 * publie, et le rapprochement est le plus étroit que le modèle permette. Les
 * commodités qui ne portent pas de destination — sanitaires, point
 * d'information — restent donc hors du contrôle.
 *
 * Une anomalie par destination, et non par couple entrée-destination : une aile
 * coupée est un défaut, pas cinq. Les entrées en défaut sont nommées dans les
 * paramètres.
 */
export function destinationNotReachedFromEveryEntranceFindings(
  site: SiteData,
): Finding[] {
  const { nodes, edges } = site.graph;
  const entrances = nodes
    .filter((n) => n.kind === 'entrance')
    .sort((a, b) => a.id.localeCompare(b.id));
  // Sans entrée, `GRAPH.NO_ENTRANCE` le dit déjà ; le redire ici n'ajouterait
  // rien et masquerait le vrai manque derrière un bruit de destinations.
  if (entrances.length === 0) return [];

  const adj = buildDirectedAdjacency(nodes, edges);
  const reachedBy = new Map<string, string[]>();
  for (const entrance of entrances) {
    for (const id of bfs(adj, entrance.id)) {
      const list = reachedBy.get(id);
      if (list) list.push(entrance.id);
      else reachedBy.set(id, [entrance.id]);
    }
  }

  // Une destination dont le nœud n'existe pas n'est pas mal desservie, elle est
  // mal rattachée, et `GRAPH.DESTINATION_UNLINKED` le dit déjà dans
  // `validateDirectory`. La signaler ici aussi donnerait au lecteur une cause
  // fausse : il chercherait un problème de cheminement là où la référence est
  // rompue.
  const nodeIds = new Set(nodes.map((n) => n.id));

  const findings: Finding[] = [];
  const sorted = [...site.destinations].sort((a, b) => a.id.localeCompare(b.id));
  for (const dest of sorted) {
    if (!nodeIds.has(dest.node_id)) continue;
    const reached = reachedBy.get(dest.node_id) ?? [];
    if (reached.length === entrances.length) continue;
    const missing = entrances
      .map((e) => e.id)
      .filter((id) => !reached.includes(id));
    findings.push({
      code: 'GRAPH.DESTINATION_ENTRANCE_COVERAGE',
      severity: 'blocking',
      entity: { kind: 'destination', id: dest.id },
      params: {
        node_id: dest.node_id,
        reached_from: reached.length,
        entrances_total: entrances.length,
        unreached_entrance_ids: missing.join(','),
      },
      ruleRef: 'atelier-QC-10',
    });
  }
  return findings;
}
