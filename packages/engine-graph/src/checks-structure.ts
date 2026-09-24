import type { Finding, GraphNode } from '@azimut/core-model';
import type { GraphScope } from './graph-scope.js';
import { POINT_COINCIDENCE_M, roundHalfAwayFromZero } from '@azimut/core-model';
import { buildDirectedAdjacency, bfs } from './graph-traversal.js';
import { buildExcludedKindsSet, isEdgeTraversableFrom } from './edge-traversal.js';

export function crossLevelWithoutVlFindings(
  site: GraphScope,
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
  site: GraphScope,
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
  site: GraphScope,
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
 * M01.S10 — une arête entre deux bâtiments sans sa ligne `building_link`.
 *
 * « Toute arête dont les deux extrémités appartiennent à des bâtiments
 * différents porte une ligne `building_link`, qui déclare si le passage est
 * couvert. » Règle symétrique de celle des liaisons verticales, et le contrôle
 * est bâti sur le même modèle que `crossLevelWithoutVlFindings` : la
 * connectivité est portée par l'arête, l'attribut de passage par la liaison.
 *
 * Le bâtiment d'un nœud se déduit de son niveau. Une extrémité dont le niveau
 * est inconnu ne compte pas comme franchissant une limite de bâtiment : c'est
 * un nœud orphelin, que `orphanNodeFindings` signale pour ce qu'il est, et le
 * signaler deux fois dirait deux fois le même fait.
 *
 * **Limite déclarée**, celle que la règle nomme : aucun calcul ne lit
 * `sheltered` aujourd'hui. Le contrôle exige la ligne, il ne juge pas sa
 * valeur.
 */
export function crossBuildingWithoutLinkFindings(site: GraphScope): Finding[] {
  const levelBuilding = new Map<string, string>();
  for (const level of site.levels) levelBuilding.set(level.id, level.building_id);

  const nodeBuilding = new Map<string, string>();
  for (const node of site.graph.nodes) {
    const building = levelBuilding.get(node.level_id);
    if (building !== undefined) nodeBuilding.set(node.id, building);
  }

  const linked = new Set(site.graph.building_links.map(link => link.edge_id));

  const findings: Finding[] = [];
  for (const edge of [...site.graph.edges].sort((a, b) => a.id.localeCompare(b.id))) {
    const from = nodeBuilding.get(edge.from_node_id);
    const to = nodeBuilding.get(edge.to_node_id);
    if (from === undefined || to === undefined || from === to) continue;
    if (linked.has(edge.id)) continue;
    findings.push({
      code: 'GRAPH.BUILDING_LINK_MISSING',
      severity: 'blocking',
      entity: { kind: 'edge', id: edge.id },
      params: { from_building: from, to_building: to },
      ruleRef: 'M01.S10',
    });
  }
  return findings;
}

/**
 * Un bâtiment que rien ne relie au reste du site, et ce qu'on en dit.
 *
 * « Relié » se lit sur le graphe : une arête dont les deux extrémités
 * retombent, par leur niveau, sur deux bâtiments différents. Aucune ligne de
 * `building_link` n'est requise pour cela — la table existe, rien ne l'écrit
 * encore, et fonder le constat sur elle ferait passer tout site pour isolé.
 *
 * Deux codes selon ce que le bâtiment a par ailleurs :
 *
 *  · `GRAPH.BUILDING_ISOLATED` — ni liaison, ni accès indépendant. Le
 *    bâtiment est inatteignable.
 *  · `GRAPH.BUILDING_ACCESS_INDEPENDENT_ONLY` — pas de liaison, mais un
 *    accès propre. T-1.5 : « signalé, pas refusé ». C'est un relevé possible,
 *    pas une faute.
 *
 * Les deux sont des avertissements : ni l'un ni l'autre n'interdit de
 * continuer.
 */
export function buildingIsolatedFindings(
  site: GraphScope,
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
  // Un site d'un seul bâtiment n'a pas de « reste du site » auquel se relier.
  // Signaler son unique bâtiment ferait porter un avertissement à tout site
  // simple, et un avertissement que tout site porte ne signale plus rien.
  const severalBuildings = site.buildings.length > 1;

  for (const building of sortedBuildings) {
    if (linkedBuildings.has(building.id)) continue;
    if (building.independent_access && !severalBuildings) continue;
    // T-1.5 : « Un bâtiment à accès indépendant sans liaison est signalé, pas
    // refusé. » Il ne se taisait pas à demi, il se taisait tout court : le
    // bâtiment à accès propre était écarté avant tout constat, et un site
    // dont un bâtiment n'était relié à rien passait sans un mot dès lors que
    // la case était cochée.
    //
    // Deux codes plutôt qu'un, parce que ce ne sont pas les mêmes faits. Sans
    // accès propre et sans liaison, le bâtiment est inatteignable. Avec un
    // accès propre, il est atteignable depuis la voie publique et l'absence
    // de liaison peut être le relevé exact d'un site réel : le signaler dit
    // « vérifiez », non « corrigez ».
    findings.push(building.independent_access
      ? {
        code: 'GRAPH.BUILDING_ACCESS_INDEPENDENT_ONLY',
        severity: 'warning',
        entity: { kind: 'building', id: building.id },
        params: { name: building.name },
        ruleRef: null,
      }
      : {
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
  site: GraphScope,
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
 * `GRAPH.VERTICAL_LINK_MISALIGNED` — une liaison verticale qui ne tombe pas au
 * même endroit d'un niveau à l'autre.
 *
 * D2.2 : « Liaison verticale non alignée entre deux niveaux, ascenseurs et
 * escaliers droits seulement, tolérance de la section D1.5. » Un visiteur qui monte par
 * l'ascenseur ressort au même endroit du plan ; si les deux nœuds ne
 * coïncident pas, le plan du niveau supérieur place la sortie ailleurs que là
 * où elle est, et aucun contrôle existant ne le voyait — `VERTICAL_LINK_MISSING`
 * ne juge que la présence de la liaison, pas sa position.
 *
 * **Le seuil n'est pas inventé et n'est pas normatif.** D2.2 renvoie à D1.5,
 * qui définit `POINT_COINCIDENCE_M` comme la distance en deçà
 * de laquelle deux points sont le même point, et la range explicitement parmi
 * les tolérances techniques. Le contrôle applique cette définition, il n'en
 * pose pas une nouvelle.
 *
 * **L'escalier mécanique et la rampe sont hors du contrôle**, pour une seule et
 * même raison : l'un comme l'autre gagne sa hauteur en avançant, et leurs deux
 * extrémités ne peuvent donc pas coïncider en plan. Les retenir produirait une
 * anomalie bloquante sur une géométrie correcte — et sur toute rampe réelle,
 * la coïncidence exigée n'étant tenable que par ce qui occupe une gaine
 * verticale. Restent donc l'ascenseur et l'escalier, les deux natures qui en
 * occupent une, et pour lesquelles la coïncidence est le fait à vérifier.
 *
 * Deux natures retenues sur quatre, et c'est D2.2 qui le dit désormais. Sans
 * cette lecture, aucun passage entre deux bâtiments ne serait représentable —
 * il franchit toujours une limite de niveau (M01.S10), donc porte une liaison,
 * et ses deux têtes sont par construction distantes.
 */
export function verticalLinkMisalignedFindings(
  site: GraphScope,
): Finding[] {
  const nodeById = new Map(site.graph.nodes.map((n) => [n.id, n]));
  const edgeById = new Map(site.graph.edges.map((e) => [e.id, e]));

  const findings: Finding[] = [];
  const sorted = [...site.graph.vertical_links].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (const link of sorted) {
    if (link.kind === 'escalator' || link.kind === 'ramp') continue;
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
      ruleRef: 'D1.5',
    });
  }
  return findings;
}

/**
 * `GRAPH.DESTINATION_ENTRANCE_COVERAGE` — une destination que toutes les
 * entrées empruntées n'atteignent pas.
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
 *
 * **Deux points tranchés par l'éditeur**, et non par ce module.
 *
 * L'anomalie est un **avertissement** et non un refus. QC-10 la donnait pour
 * bloquante ; une desserte partielle est un défaut de jalonnement à examiner,
 * pas une donnée impossible.
 *
 * Elle ne compte que les **entrées empruntées par au moins un profil de
 * visiteur** : une entrée qu'aucun profil ne peut franchir — service,
 * livraison, issue à sens unique qu'aucun profil n'emprunte — n'a pas à
 * desservir l'annuaire, et l'exiger d'elle produisait une anomalie sur un
 * relevé exact. « Empruntée » se lit sur le graphe : le profil peut franchir
 * au moins une arête depuis cette entrée, au sens de `isEdgeTraversableFrom`.
 *
 * Conséquence à dire plutôt qu'à découvrir : **un site qui ne déclare aucun
 * profil ne lève rien**. « Empruntée par au moins un profil » n'est pas
 * décidable sans profil, et le supposer emprunté par tous rendrait la portée
 * inopérante. C'est le cas de la session d'atelier de la tranche 1, qui n'en
 * porte aucun.
 */
export function destinationNotReachedFromEveryEntranceFindings(
  site: GraphScope,
): Finding[] {
  const { nodes, edges } = site.graph;
  const entrances = entrancesUsedByAProfile(site);
  // Sans entrée retenue, `GRAPH.NO_ENTRANCE` dit déjà le manque d'entrée ; le
  // redire ici n'ajouterait rien et masquerait le vrai manque derrière un
  // bruit de destinations. Sans profil, voir la note ci-dessus.
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
      severity: 'warning',
      entity: { kind: 'destination', id: dest.id },
      params: {
        node_id: dest.node_id,
        reached_from: reached.length,
        entrances_total: entrances.length,
        unreached_entrance_ids: missing.join(','),
      },
      ruleRef: null,
    });
  }
  return findings;
}

/**
 * Les entrées qu'au moins un profil de visiteur peut emprunter, triées.
 *
 * « Emprunter » se lit sur le graphe et non sur une déclaration : le profil
 * franchit au moins une arête depuis cette entrée. `isEdgeTraversableFrom`
 * porte déjà cette lecture — sens de circulation, accessibilité requise,
 * natures exclues — et la réécrire ici donnerait deux définitions de la même
 * règle.
 *
 * Aucun profil, aucune entrée retenue : voir la note de
 * `destinationNotReachedFromEveryEntranceFindings`.
 */
function entrancesUsedByAProfile(site: GraphScope): GraphNode[] {
  if (site.travel_profiles.length === 0) return [];

  const nodeKinds = new Map(site.graph.nodes.map(node => [node.id, node.kind]));
  const excludedByProfile = site.travel_profiles.map(profile => ({
    profile, excluded: buildExcludedKindsSet(profile),
  }));

  return site.graph.nodes
    .filter(node => node.kind === 'entrance')
    .filter(entrance => excludedByProfile.some(({ profile, excluded }) =>
      site.graph.edges.some(edge =>
        (edge.from_node_id === entrance.id || edge.to_node_id === entrance.id)
        && isEdgeTraversableFrom(edge, entrance.id, profile, nodeKinds, excluded))))
    .sort((a, b) => a.id.localeCompare(b.id));
}
