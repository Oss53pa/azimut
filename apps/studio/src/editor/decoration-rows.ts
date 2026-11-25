/**
 * S6.1b — relire en objets de l'éditeur les lignes d'habillage que la base
 * porte (0086), pour qu'une commande écrite se relise à l'identique.
 *
 * Une ligne se lit telle que PostgREST la rend : jsonb en objet, `numeric` en
 * nombre ou en texte. Une ligne qui ne se lit pas rend `null` : la base la
 * contraint, et l'éditeur ne devine jamais une forme (A5, `stored-shapes`).
 */
import type { Point } from '@azimut/core-model';
import { kindForGeometry } from './shape-geometry.js';
import type { DecorationGeometry, DecorationLayer, DecorationShape, DecorationStyle } from './scene-objects.js';

type Row = Readonly<Record<string, unknown>>;

function record(value: unknown): Row | null {
  const parsed: unknown = typeof value === 'string' ? safeParse(value) : value;
  return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Row : null;
}

function safeParse(text: string): unknown {
  try { return JSON.parse(text); } catch { return null; }
}

function num(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const bool = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null);

function point(value: unknown): Point | null {
  const p = record(value);
  if (p === null) return null;
  const x = num(p['x_m']);
  const y = num(p['y_m']);
  return x === null || y === null ? null : { x_m: x, y_m: y };
}

function points(value: unknown): readonly Point[] | null {
  if (!Array.isArray(value)) return null;
  const out = value.map(point);
  return out.every((p): p is Point => p !== null) ? out : null;
}

export function geometryFromStored(value: unknown): DecorationGeometry | null {
  const g = record(value);
  if (g === null) return null;
  switch (g['type']) {
    case 'polygon':
    case 'polyline': {
      const pts = points(g['points']);
      return pts === null ? null : { type: g['type'], points: pts };
    }
    case 'rectangle': {
      const origin = point(g['origin']);
      const w = num(g['width_m']);
      const h = num(g['height_m']);
      return origin === null || w === null || h === null ? null : { type: 'rectangle', origin, width_m: w, height_m: h };
    }
    case 'ellipse': {
      const center = point(g['center']);
      const rx = num(g['rx_m']);
      const ry = num(g['ry_m']);
      return center === null || rx === null || ry === null ? null : { type: 'ellipse', center, rx_m: rx, ry_m: ry };
    }
    case 'symbol_ref': {
      const position = point(g['position']);
      const symbolId = str(g['symbol_id']);
      const scale = num(g['scale']);
      return position === null || symbolId === null || scale === null
        ? null : { type: 'symbol_ref', position, symbolId, scale };
    }
    default:
      return null;
  }
}

export function styleFromStored(value: unknown): DecorationStyle | null {
  const s = record(value);
  if (s === null) return null;
  const role = (v: unknown): string | null | undefined => (v === null ? null : str(v) ?? undefined);
  const fillRole = role(s['fill_role']);
  const strokeRole = role(s['stroke_role']);
  const strokeWidth = num(s['stroke_width_m']);
  const opacity = num(s['opacity']);
  if (fillRole === undefined || strokeRole === undefined || strokeWidth === null || opacity === null) return null;
  return { fillRole, strokeRole, strokeWidth_m: strokeWidth, opacity };
}

export function layerFromRow(row: Row): DecorationLayer | null {
  const id = str(row['id']); const orgId = str(row['org_id']);
  const siteId = str(row['site_id']); const levelId = str(row['level_id']);
  const name = str(row['name']); const zOrder = num(row['z_order']);
  const visible = bool(row['visible']); const printVisible = bool(row['print_visible']);
  const locked = bool(row['locked']);
  if (id === null || orgId === null || siteId === null || levelId === null || name === null
    || zOrder === null || visible === null || printVisible === null || locked === null) return null;
  return { id, orgId, siteId, levelId, name, zOrder, visible, printVisible, locked };
}

export function shapeFromRow(row: Row): DecorationShape | null {
  const id = str(row['id']); const orgId = str(row['org_id']); const layerId = str(row['layer_id']);
  const geometry = geometryFromStored(row['geometry']);
  const style = styleFromStored(row['style']);
  const label = str(row['label']);
  const rotation = num(row['rotation_deg']);
  const rawRole = row['style_role'];
  const styleRole = rawRole === null ? null : typeof rawRole === 'string' ? rawRole : undefined;
  if (id === null || orgId === null || layerId === null || geometry === null || style === null
    || label === null || rotation === null || styleRole === undefined) return null;
  // `group` n'a pas de géométrie propre dans l'éditeur ; une autre nature
  // que celle que la géométrie dérive n'est pas une forme qu'il sait tenir.
  const kind = kindForGeometry(geometry);
  if (row['kind'] !== kind) return null;
  return { id, orgId, layerId, kind, geometry, styleRole, style, label, rotation_deg: rotation };
}

/**
 * Le document relu : couches, et formes dans l'ordre de leur `z_order`, puis
 * de leur identifiant. `unreadable` compte les lignes écartées, que
 * l'appelant doit dire plutôt que taire.
 */
export function decorationFromRows(
  layerRows: readonly Row[], shapeRows: readonly Row[],
): { readonly layers: readonly DecorationLayer[]; readonly shapes: readonly DecorationShape[]; readonly unreadable: number } {
  const layers = layerRows.map(layerFromRow);
  const ranked = shapeRows
    .map(row => ({ shape: shapeFromRow(row), z: num(row['z_order']) }))
    .filter((r): r is { shape: DecorationShape; z: number } => r.shape !== null && r.z !== null)
    .sort((a, b) => a.z - b.z || (a.shape.id < b.shape.id ? -1 : a.shape.id > b.shape.id ? 1 : 0));
  const readLayers = layers.filter((l): l is DecorationLayer => l !== null);
  return {
    layers: readLayers,
    shapes: ranked.map(r => r.shape),
    unreadable: (layerRows.length - readLayers.length) + (shapeRows.length - ranked.length),
  };
}
