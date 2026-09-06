/**
 * E9 — Scene objects: decoration layer and annotations.
 *
 * Decoration objects are strictly separated from the business layer (E9.2).
 * They carry no business attributes. If they need one, they belong
 * to the business layer instead.
 *
 * This module defines the in-memory representation of decoration shapes,
 * annotations, and imported assets used by the editor viewport.
 */

import type { Point } from '@azimut/core-model';

// ---------------------------------------------------------------------------
// Decoration shapes (E9.3 decoration_shape)
// ---------------------------------------------------------------------------

export type DecorationKind = 'area' | 'path' | 'symbol' | 'group';

export type DecorationStyle = {
  readonly fillRole: string | null;
  readonly strokeRole: string | null;
  readonly strokeWidth_m: number;
  readonly opacity: number;
};

export type DecorationShape = {
  readonly id: string;
  readonly orgId: string;
  readonly layerId: string;
  readonly kind: DecorationKind;
  readonly geometry: DecorationGeometry;
  readonly styleRole: string | null;
  readonly style: DecorationStyle;
  readonly label: string;
  readonly rotation_deg: number;
};

export type DecorationGeometry =
  | { readonly type: 'polygon'; readonly points: readonly Point[] }
  | { readonly type: 'polyline'; readonly points: readonly Point[] }
  | { readonly type: 'rectangle'; readonly origin: Point; readonly width_m: number; readonly height_m: number }
  | { readonly type: 'ellipse'; readonly center: Point; readonly rx_m: number; readonly ry_m: number }
  | { readonly type: 'symbol_ref'; readonly position: Point; readonly symbolId: string; readonly scale: number };

// ---------------------------------------------------------------------------
// Decoration layers (E9.3 decoration_layer)
// ---------------------------------------------------------------------------

export type DecorationLayer = {
  readonly id: string;
  readonly orgId: string;
  readonly siteId: string;
  readonly levelId: string;
  readonly name: string;
  readonly zOrder: number;
  readonly visible: boolean;
  readonly printVisible: boolean;
  readonly locked: boolean;
};

// ---------------------------------------------------------------------------
// Annotations (E9.3 annotation)
// ---------------------------------------------------------------------------

export type Annotation = {
  readonly id: string;
  readonly orgId: string;
  readonly levelId: string;
  /** Anchor position in meter-space. */
  readonly anchor: Point;
  /** Leader line: list of points from annotation to anchor. */
  readonly leader: readonly Point[];
  /** Localized text. */
  readonly text: Readonly<Record<string, string>>;
  readonly styleRole: string | null;
};

// ---------------------------------------------------------------------------
// Imported assets (E9.3 imported_asset)
// ---------------------------------------------------------------------------

export type AssetKind = 'logo' | 'symbol' | 'background';

export type ImportedAsset = {
  readonly id: string;
  readonly orgId: string;
  readonly siteId: string;
  readonly kind: AssetKind;
  readonly storagePath: string;
  readonly sanitized: boolean;
  readonly originalName: string;
  readonly checksum: string;
};

// ---------------------------------------------------------------------------
// Layout composition (E9.3 layout_composition)
// ---------------------------------------------------------------------------

export type CompositionTarget = 'print' | 'kiosk' | 'web';

export type LayoutComposition = {
  readonly id: string;
  readonly orgId: string;
  readonly siteId: string;
  readonly levelId: string;
  readonly target: CompositionTarget;
  readonly pageFormat: string;
  readonly elements: readonly CompositionElement[];
};

export type CompositionElement =
  | { readonly type: 'title_block'; readonly x_m: number; readonly y_m: number; readonly width_m: number; readonly height_m: number }
  | { readonly type: 'legend'; readonly x_m: number; readonly y_m: number }
  | { readonly type: 'compass'; readonly x_m: number; readonly y_m: number; readonly rotation_deg: number }
  | { readonly type: 'margin'; readonly top_m: number; readonly right_m: number; readonly bottom_m: number; readonly left_m: number };

// ---------------------------------------------------------------------------
// Layer operations
// ---------------------------------------------------------------------------

/**
 * Sort layers by z-order for rendering. Deterministic: equal z-order
 * broken by id.
 */
export function sortLayers(
  layers: readonly DecorationLayer[],
): readonly DecorationLayer[] {
  return [...layers].sort((a, b) => {
    const zCmp = a.zOrder - b.zOrder;
    if (zCmp !== 0) return zCmp;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Filter shapes belonging to visible, unlocked layers.
 */
export function editableShapes(
  shapes: readonly DecorationShape[],
  layers: readonly DecorationLayer[],
): readonly DecorationShape[] {
  const editableLayerIds = new Set(
    layers
      .filter(l => l.visible && !l.locked)
      .map(l => l.id),
  );
  return shapes.filter(s => editableLayerIds.has(s.layerId));
}

/**
 * Filter shapes belonging to visible layers (locked or not).
 */
export function visibleShapes(
  shapes: readonly DecorationShape[],
  layers: readonly DecorationLayer[],
): readonly DecorationShape[] {
  const visibleLayerIds = new Set(
    layers.filter(l => l.visible).map(l => l.id),
  );
  return shapes.filter(s => visibleLayerIds.has(s.layerId));
}

/**
 * Filter shapes visible for print output.
 */
export function printableShapes(
  shapes: readonly DecorationShape[],
  layers: readonly DecorationLayer[],
): readonly DecorationShape[] {
  const printLayerIds = new Set(
    layers.filter(l => l.printVisible).map(l => l.id),
  );
  return shapes.filter(s => printLayerIds.has(s.layerId));
}
