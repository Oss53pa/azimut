/**
 * Ce que la validation du graphe lit, tel que la session le porte.
 *
 * M5 (partie M) fait tourner `validateGraph` sur le travail en cours. Le
 * moteur lit six champs — `GraphScope` les nomme — et ce module les assemble
 * depuis le magasin de session, par le chemin inverse de celui qui les a
 * écrits.
 *
 * Rien n'est complété. Une ligne dont les champs requis manquent est écartée
 * et comptée : valider un site complété d'office reviendrait à valider ce que
 * personne n'a saisi, et l'écran rendrait un verdict sur une saisie
 * imaginaire. Ce que la session ne porte pas reste vide, et les contrôles qui
 * s'y rattachent ne lèvent rien — ce qui est exact : un site sans destination
 * n'a pas de destination non reliée.
 */
import type { Building, Footprint, Level, Polygon } from '@azimut/core-model';
import type { GraphScope } from '@azimut/engine-graph';
import type { SessionState, StoredRow } from './session-store.js';
import { rowsOf } from './session-store.js';
import { readSessionGraph } from './session-graph.js';
import { text, numeric, boolean, structured, point } from './row-values.js';

export type SessionScope = {
  readonly scope: GraphScope;
  /** Identifiants des lignes que le magasin porte et qui n'ont pas pu être lues. */
  readonly unreadable: readonly string[];
};

function polygon(raw: unknown): Polygon | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { vertices } = raw as { vertices?: unknown };
  if (!Array.isArray(vertices)) return null;
  const read = vertices.map((vertex: unknown) => point(vertex));
  if (read.some(vertex => vertex === null)) return null;
  return { vertices: read.filter((v): v is NonNullable<typeof v> => v !== null) };
}

function readFootprint(row: StoredRow): Footprint | null {
  const levelId = text(row.values, 'level_id');
  const kind = text(row.values, 'kind');
  const geometry = polygon(structured(row.values, 'geometry'));
  if (levelId === null || kind === null || geometry === null) return null;
  const unitCode = text(row.values, 'unit_code');
  return {
    id: row.id,
    org_id: text(row.values, 'org_id') ?? '',
    level_id: levelId,
    geometry,
    kind: kind as Footprint['kind'],
    // Facultatif au modèle : une empreinte relevée avant que son code soit
    // connu se charge et se signale (N1.2). L'omettre n'est pas la même chose
    // que le porter vide, et `exactOptionalPropertyTypes` l'exige.
    ...(unitCode === null ? {} : { unit_code: unitCode }),
  };
}

/**
 * Les niveaux que la session porte, ordonnés.
 *
 * T-1.5 : une liaison verticale relie deux niveaux, et l'atelier n'en
 * connaissait qu'un — celui du chemin. Le magasin en porte pourtant autant
 * que le site en compte, la session chargeant le site entier. Ce lecteur les
 * rend, pour que l'écran désigne l'autre extrémité au lieu de la supposer.
 *
 * L'ordre est celui du bâtiment puis du rang, l'identifiant départageant :
 * deux lectures d'un même magasin doivent rendre la même liste (A9).
 */
export function levelsOfSession(session: SessionState): {
  readonly levels: readonly Level[];
  readonly unreadable: readonly string[];
} {
  const unreadable: string[] = [];
  const levels = collect(session, 'level', readLevel, unreadable);
  levels.sort((a, b) =>
    a.building_id.localeCompare(b.building_id)
    || a.ordinal - b.ordinal
    || a.id.localeCompare(b.id));
  return { levels, unreadable };
}

function readLevel(row: StoredRow): Level | null {
  const buildingId = text(row.values, 'building_id');
  const name = text(row.values, 'name');
  const ordinal = numeric(row.values, 'ordinal');
  const elevation = numeric(row.values, 'elevation_m');
  if (buildingId === null || name === null) return null;
  if (ordinal === null || elevation === null) return null;
  return {
    id: row.id,
    org_id: text(row.values, 'org_id') ?? '',
    building_id: buildingId,
    name,
    ordinal,
    elevation_m: elevation,
  };
}

function readBuilding(row: StoredRow): Building | null {
  const siteId = text(row.values, 'site_id');
  const name = text(row.values, 'name');
  if (siteId === null || name === null) return null;
  return {
    id: row.id,
    org_id: text(row.values, 'org_id') ?? '',
    site_id: siteId,
    name,
    independent_access: boolean(row.values, 'independent_access'),
  };
}

function collect<T>(
  session: SessionState,
  table: string,
  read: (row: StoredRow) => T | null,
  unreadable: string[],
): T[] {
  const out: T[] = [];
  for (const row of rowsOf(session, table)) {
    const value = read(row);
    if (value === null) unreadable.push(row.id);
    else out.push(value);
  }
  return out;
}

export function graphScopeFromSession(session: SessionState): SessionScope {
  const graph = readSessionGraph(session);
  const unreadable: string[] = [...graph.unreadable];

  return {
    scope: {
      buildings: collect(session, 'building', readBuilding, unreadable),
      levels: collect(session, 'level', readLevel, unreadable),
      graph: {
        nodes: graph.nodes,
        edges: graph.edges,
        vertical_links: graph.vertical_links,
      },
      // L'annuaire entre avec le module 02. Tant qu'il n'est pas là, la
      // session n'en porte pas, et les contrôles de destination ne lèvent
      // rien : un site sans destination n'a pas de destination non reliée.
      destinations: [],
      destination_names: [],
      footprints: collect(session, 'footprint', readFootprint, unreadable),
    },
    unreadable,
  };
}
