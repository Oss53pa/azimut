/**
 * Relire une colonne `jsonb` au lieu de la transtyper.
 *
 * 0082 et 0084 contraignent les écritures nouvelles ; une ligne antérieure,
 * posée avant ces contraintes (NOT VALID), peut encore être mal formée. La
 * transtyper la ferait entrer dans le modèle sans coordonnées.
 *
 * A0, ligne 626 du cahier : une structure mal formée ne donne « ni résultat
 * partiel » ni valeur comblée. Le précédent de `DATA.VOCABULARY_UNREADABLE`,
 * retiré par l'éditeur, range une donnée illisible parmi les défaillances de
 * dépôt (F7), non parmi les anomalies de moteur : le lecteur refuse donc de
 * construire le site et nomme la ligne, sans en citer le contenu.
 */
import type { Point, Polygon } from '@azimut/core-model';

/** Une ligne stockée que le lecteur ne sait pas relire. */
export class StoredRowUnreadable extends Error {
  readonly table: string;
  readonly rowId: string;

  constructor(table: string, rowId: string, column: string) {
    super(`${table}.${column} illisible (ligne ${rowId})`);
    this.name = 'StoredRowUnreadable';
    this.table = table;
    this.rowId = rowId;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Un point `{x_m, y_m}` à deux nombres finis, ou `null`. */
export function storedPoint(value: unknown): Point | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value).sort();
  if (keys.length !== 2 || keys[0] !== 'x_m' || keys[1] !== 'y_m') return null;
  const { x_m: x, y_m: y } = value;
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x_m: x, y_m: y };
}

/**
 * Un polygone `{vertices}` d'au moins trois points, ou `null`. La forme
 * seulement : la simplicité du polygone relève du moteur géométrique, qui la
 * signale par ses codes (`GEOM.POLYGON_*`), et de la base pour les écritures.
 */
export function storedPolygon(value: unknown): Polygon | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== 'vertices') return null;
  const raw = value['vertices'];
  if (!Array.isArray(raw) || raw.length < 3) return null;
  const vertices: Point[] = [];
  for (const item of raw as unknown[]) {
    const point = storedPoint(item);
    if (point === null) return null;
    vertices.push(point);
  }
  return { vertices };
}

export function pointOrRefuse(table: string, rowId: string, column: string, value: unknown): Point {
  const point = storedPoint(value);
  if (point === null) throw new StoredRowUnreadable(table, rowId, column);
  return point;
}

export function polygonOrRefuse(table: string, rowId: string, column: string, value: unknown): Polygon {
  const polygon = storedPolygon(value);
  if (polygon === null) throw new StoredRowUnreadable(table, rowId, column);
  return polygon;
}
