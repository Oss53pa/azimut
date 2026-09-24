/**
 * Le graphe du site tel que le magasin de session le porte.
 *
 * D7.2 veut l'empreinte des nœuds, des arêtes et des liaisons du site, et
 * `computeGraphHash` la calcule depuis la forme du modèle. Ce module fait le
 * chemin inverse du chemin d'écriture du graphe, et lui seul : deux lectures
 * concurrentes finiraient par produire deux empreintes pour un même graphe.
 *
 * Une ligne illisible n'est pas devinée. Elle est écartée et comptée : une
 * empreinte calculée sur un graphe amputé vaudrait pour un graphe qui
 * n'existe pas, et validerait ce que personne n'a saisi.
 */
import type { BuildingLink, Edge, GraphNode, VerticalLink } from '@azimut/core-model';
import type { SessionState, StoredRow } from './session-store.js';
import { rowsOf } from './session-store.js';
import { text, numeric, boolean, structured, point } from './row-values.js';

export type SessionGraph = {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly Edge[];
  readonly vertical_links: readonly VerticalLink[];
  /** M01.S10 — les passages entre bâtiments que la session porte. */
  readonly building_links: readonly BuildingLink[];
  /** Identifiants des lignes que le magasin porte et qui n'ont pas pu être lues. */
  readonly unreadable: readonly string[];
};

function readNode(row: StoredRow): GraphNode | null {
  const kind = text(row.values, 'kind');
  const levelId = text(row.values, 'level_id');
  const position = point(structured(row.values, 'position'));
  if (kind === null || levelId === null || position === null) return null;
  return {
    id: row.id,
    org_id: text(row.values, 'org_id') ?? '',
    level_id: levelId,
    kind: kind as GraphNode['kind'],
    position,
    label: text(row.values, 'label') ?? '',
  };
}

function readEdge(row: StoredRow): Edge | null {
  const from = text(row.values, 'from_node_id');
  const to = text(row.values, 'to_node_id');
  const width = numeric(row.values, 'width_m');
  const slope = numeric(row.values, 'slope_pct');
  const length = numeric(row.values, 'length_m');
  const direction = text(row.values, 'direction');
  if (from === null || to === null || direction === null) return null;
  if (width === null || slope === null || length === null) return null;
  return {
    id: row.id,
    org_id: text(row.values, 'org_id') ?? '',
    from_node_id: from,
    to_node_id: to,
    width_m: width,
    slope_pct: slope,
    accessible: boolean(row.values, 'accessible'),
    direction: direction as Edge['direction'],
    evacuation_route: boolean(row.values, 'evacuation_route'),
    length_m: length,
  };
}

function readVerticalLink(row: StoredRow): VerticalLink | null {
  const edgeId = text(row.values, 'edge_id');
  const kind = text(row.values, 'kind');
  const capacity = numeric(row.values, 'capacity');
  if (edgeId === null || kind === null || capacity === null) return null;
  return {
    id: row.id,
    org_id: text(row.values, 'org_id') ?? '',
    edge_id: edgeId,
    kind: kind as VerticalLink['kind'],
    capacity,
    accessible: boolean(row.values, 'accessible'),
  };
}

function readBuildingLink(row: StoredRow): BuildingLink | null {
  const edgeId = text(row.values, 'edge_id');
  const from = text(row.values, 'from_building_id');
  const to = text(row.values, 'to_building_id');
  if (edgeId === null || from === null || to === null) return null;
  return {
    id: row.id,
    org_id: text(row.values, 'org_id') ?? '',
    edge_id: edgeId,
    from_building_id: from,
    to_building_id: to,
    sheltered: boolean(row.values, 'sheltered'),
  };
}

export function readSessionGraph(session: SessionState): SessionGraph {
  const unreadable: string[] = [];

  function collect<T>(table: string, read: (row: StoredRow) => T | null): T[] {
    const out: T[] = [];
    for (const row of rowsOf(session, table)) {
      const value = read(row);
      if (value === null) unreadable.push(row.id);
      else out.push(value);
    }
    return out;
  }

  return {
    nodes: collect('node', readNode),
    edges: collect('edge', readEdge),
    vertical_links: collect('vertical_link', readVerticalLink),
    building_links: collect('building_link', readBuildingLink),
    unreadable,
  };
}
