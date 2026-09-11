/**
 * E7.3 — Bridge between the document and the clipboard.
 *
 * The clipboard stores serializable data, never object references, so
 * shapes are encoded on copy and decoded on paste. Decoding validates
 * the payload instead of asserting its type: a clipboard payload can
 * come from an earlier version of the document and must not be trusted
 * on shape alone.
 *
 * Cross-organization paste is refused upstream by `preparePaste`
 * (EDIT.CROSS_ORG_PASTE_DENIED); this module never sees it.
 */

import type { Point } from '@azimut/core-model';
import type { ClipboardItem, ClipboardPayload } from './clipboard.js';
import type {
  DecorationGeometry,
  DecorationKind,
  DecorationShape,
  DecorationStyle,
} from './scene-objects.js';
import type { EditorDocument } from './editor-document.js';
import { geometryBounds, translateGeometry } from './shape-geometry.js';

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

function encodeShape(shape: DecorationShape): ClipboardItem {
  return {
    type: shape.kind,
    geometry: shape.geometry,
    properties: {
      styleRole: shape.styleRole,
      style: shape.style,
      label: shape.label,
      rotation_deg: shape.rotation_deg,
    },
  };
}

/**
 * Centroid of a set of shapes: the centre of their combined bounds.
 * Used as the paste anchor when the target is another level or site.
 */
function centroidOf(shapes: readonly DecorationShape[]): Point {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let found = false;

  for (const shape of shapes) {
    const b = geometryBounds(shape.geometry);
    if (b === null) continue;
    if (b.minX_m < minX) minX = b.minX_m;
    if (b.minY_m < minY) minY = b.minY_m;
    if (b.maxX_m > maxX) maxX = b.maxX_m;
    if (b.maxY_m > maxY) maxY = b.maxY_m;
    found = true;
  }

  if (!found) return { x_m: 0, y_m: 0 };
  return { x_m: (minX + maxX) / 2, y_m: (minY + maxY) / 2 };
}

export type CopyContext = {
  readonly orgId: string;
  readonly siteId: string;
  readonly levelId: string;
};

/**
 * Build a clipboard payload from the selected shapes, in draw order.
 * Returns null when the selection holds no habillage shape.
 */
export function buildClipboardPayload(
  doc: EditorDocument,
  selectedIds: readonly string[],
  context: CopyContext,
): ClipboardPayload | null {
  const selected = new Set(selectedIds);
  const shapes = doc.shapes.filter(s => selected.has(s.id));
  if (shapes.length === 0) return null;

  return {
    sourceOrgId: context.orgId,
    sourceSiteId: context.siteId,
    sourceLevelId: context.levelId,
    items: shapes.map(encodeShape),
    centroid: centroidOf(shapes),
  };
}

// ---------------------------------------------------------------------------
// Decoding
// ---------------------------------------------------------------------------

function isPoint(value: unknown): value is Point {
  if (typeof value !== 'object' || value === null) return false;
  const p: Record<string, unknown> = { ...value };
  return typeof p['x_m'] === 'number' && typeof p['y_m'] === 'number';
}

function isPointArray(value: unknown): value is readonly Point[] {
  return Array.isArray(value) && value.every(isPoint);
}

/** Validate an unknown clipboard geometry against the E9.3 shapes. */
export function decodeGeometry(value: unknown): DecorationGeometry | null {
  if (typeof value !== 'object' || value === null) return null;
  const g: Record<string, unknown> = { ...value };

  switch (g['type']) {
    case 'polygon':
      return isPointArray(g['points']) ? { type: 'polygon', points: g['points'] } : null;
    case 'polyline':
      return isPointArray(g['points']) ? { type: 'polyline', points: g['points'] } : null;
    case 'rectangle':
      return isPoint(g['origin'])
        && typeof g['width_m'] === 'number'
        && typeof g['height_m'] === 'number'
        ? { type: 'rectangle', origin: g['origin'], width_m: g['width_m'], height_m: g['height_m'] }
        : null;
    case 'ellipse':
      return isPoint(g['center'])
        && typeof g['rx_m'] === 'number'
        && typeof g['ry_m'] === 'number'
        ? { type: 'ellipse', center: g['center'], rx_m: g['rx_m'], ry_m: g['ry_m'] }
        : null;
    case 'symbol_ref':
      return isPoint(g['position'])
        && typeof g['symbolId'] === 'string'
        && typeof g['scale'] === 'number'
        ? { type: 'symbol_ref', position: g['position'], symbolId: g['symbolId'], scale: g['scale'] }
        : null;
    default:
      return null;
  }
}

function decodeStyle(value: unknown): DecorationStyle | null {
  if (typeof value !== 'object' || value === null) return null;
  const s: Record<string, unknown> = { ...value };
  const { fillRole, strokeRole, strokeWidth_m, opacity } = s;

  if (typeof strokeWidth_m !== 'number' || typeof opacity !== 'number') return null;
  if (fillRole !== null && typeof fillRole !== 'string') return null;
  if (strokeRole !== null && typeof strokeRole !== 'string') return null;

  return { fillRole, strokeRole, strokeWidth_m, opacity };
}

function decodeKind(value: unknown): DecorationKind | null {
  switch (value) {
    case 'area': return 'area';
    case 'path': return 'path';
    case 'symbol': return 'symbol';
    case 'group': return 'group';
    default: return null;
  }
}

export type PasteTarget = {
  readonly orgId: string;
  readonly layerId: string;
  /** Identifier to give the n-th decoded shape. */
  readonly idAt: (index: number) => string;
};

/**
 * Decode clipboard items into shapes placed at the paste offset.
 * Items that fail validation are skipped rather than pasted degraded.
 */
export function shapesFromClipboard(
  items: readonly ClipboardItem[],
  offset: Point,
  target: PasteTarget,
): readonly DecorationShape[] {
  const shapes: DecorationShape[] = [];

  for (const item of items) {
    const geometry = decodeGeometry(item.geometry);
    const kind = decodeKind(item.type);
    const style = decodeStyle(item.properties['style']);
    if (geometry === null || kind === null || style === null) continue;

    const styleRole = item.properties['styleRole'];
    const label = item.properties['label'];
    const rotation = item.properties['rotation_deg'];

    shapes.push({
      id: target.idAt(shapes.length),
      orgId: target.orgId,
      layerId: target.layerId,
      kind,
      geometry: translateGeometry(geometry, offset.x_m, offset.y_m),
      styleRole: typeof styleRole === 'string' ? styleRole : null,
      style,
      label: typeof label === 'string' ? label : '',
      rotation_deg: typeof rotation === 'number' ? rotation : 0,
    });
  }

  return shapes;
}
