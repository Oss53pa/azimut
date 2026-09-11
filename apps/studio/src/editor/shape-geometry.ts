/**
 * E9 + E4 — Geometry of decoration shapes.
 *
 * Pure functions converting between tool command data (E5) and the
 * decoration geometry of the habillage layer (E9.3), plus the bounds
 * and translation helpers the set operations of E7.3 need.
 *
 * Quantization (E4.1) happens here, at operation validation, never
 * during the gesture and never at render time.
 */

import { quantizePosition, quantizePoint, quantizeAngle } from '@azimut/core-model';
import type { Point } from '@azimut/core-model';
import type { AlignableBounds } from './alignment.js';
import type { ShapeCommandData } from './command-integration.js';
import type {
  DecorationGeometry,
  DecorationKind,
  DecorationShape,
} from './scene-objects.js';

// ---------------------------------------------------------------------------
// Bounds
// ---------------------------------------------------------------------------

export type Bounds = {
  readonly minX_m: number;
  readonly minY_m: number;
  readonly maxX_m: number;
  readonly maxY_m: number;
};

function boundsOfPoints(points: readonly Point[]): Bounds | null {
  if (points.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x_m < minX) minX = p.x_m;
    if (p.y_m < minY) minY = p.y_m;
    if (p.x_m > maxX) maxX = p.x_m;
    if (p.y_m > maxY) maxY = p.y_m;
  }
  return { minX_m: minX, minY_m: minY, maxX_m: maxX, maxY_m: maxY };
}

/**
 * Axis-aligned bounds of a decoration geometry.
 *
 * A `symbol_ref` has no intrinsic extent until its symbol is resolved
 * from the library (E9.5), so it reports a zero-extent box at its
 * anchor rather than an invented size.
 */
export function geometryBounds(geometry: DecorationGeometry): Bounds | null {
  switch (geometry.type) {
    case 'polygon':
    case 'polyline':
      return boundsOfPoints(geometry.points);
    case 'rectangle': {
      const { origin, width_m, height_m } = geometry;
      return {
        minX_m: Math.min(origin.x_m, origin.x_m + width_m),
        minY_m: Math.min(origin.y_m, origin.y_m + height_m),
        maxX_m: Math.max(origin.x_m, origin.x_m + width_m),
        maxY_m: Math.max(origin.y_m, origin.y_m + height_m),
      };
    }
    case 'ellipse': {
      const { center, rx_m, ry_m } = geometry;
      return {
        minX_m: center.x_m - rx_m,
        minY_m: center.y_m - ry_m,
        maxX_m: center.x_m + rx_m,
        maxY_m: center.y_m + ry_m,
      };
    }
    case 'symbol_ref':
      return {
        minX_m: geometry.position.x_m,
        minY_m: geometry.position.y_m,
        maxX_m: geometry.position.x_m,
        maxY_m: geometry.position.y_m,
      };
  }
}

/** Bounds of a shape, in the form the alignment engine consumes (E7.3). */
export function shapeBounds(shape: DecorationShape): AlignableBounds | null {
  const b = geometryBounds(shape.geometry);
  if (b === null) return null;
  return { id: shape.id, ...b };
}

// ---------------------------------------------------------------------------
// Vertices (snap targets, E8.1)
// ---------------------------------------------------------------------------

/**
 * Vertices a shape offers as snap targets. Curved and point-anchored
 * geometries expose their defining points, not a tessellation.
 */
export function geometryVertices(geometry: DecorationGeometry): readonly Point[] {
  switch (geometry.type) {
    case 'polygon':
    case 'polyline':
      return geometry.points;
    case 'rectangle': {
      const { origin, width_m, height_m } = geometry;
      return [
        origin,
        { x_m: origin.x_m + width_m, y_m: origin.y_m },
        { x_m: origin.x_m + width_m, y_m: origin.y_m + height_m },
        { x_m: origin.x_m, y_m: origin.y_m + height_m },
      ];
    }
    case 'ellipse': {
      const { center, rx_m, ry_m } = geometry;
      return [
        { x_m: center.x_m - rx_m, y_m: center.y_m },
        { x_m: center.x_m + rx_m, y_m: center.y_m },
        { x_m: center.x_m, y_m: center.y_m - ry_m },
        { x_m: center.x_m, y_m: center.y_m + ry_m },
      ];
    }
    case 'symbol_ref':
      return [geometry.position];
  }
}

// ---------------------------------------------------------------------------
// Translation
// ---------------------------------------------------------------------------

function translatePoint(p: Point, dx_m: number, dy_m: number): Point {
  return quantizePoint({ x_m: p.x_m + dx_m, y_m: p.y_m + dy_m });
}

/** Translate a geometry, quantizing the result (E4.1). */
export function translateGeometry(
  geometry: DecorationGeometry,
  dx_m: number,
  dy_m: number,
): DecorationGeometry {
  switch (geometry.type) {
    case 'polygon':
      return { type: 'polygon', points: geometry.points.map(p => translatePoint(p, dx_m, dy_m)) };
    case 'polyline':
      return { type: 'polyline', points: geometry.points.map(p => translatePoint(p, dx_m, dy_m)) };
    case 'rectangle':
      return { ...geometry, origin: translatePoint(geometry.origin, dx_m, dy_m) };
    case 'ellipse':
      return { ...geometry, center: translatePoint(geometry.center, dx_m, dy_m) };
    case 'symbol_ref':
      return { ...geometry, position: translatePoint(geometry.position, dx_m, dy_m) };
  }
}

/** Translate a shape, quantizing the result (E4.1). */
export function translateShape(
  shape: DecorationShape,
  dx_m: number,
  dy_m: number,
): DecorationShape {
  return { ...shape, geometry: translateGeometry(shape.geometry, dx_m, dy_m) };
}

// ---------------------------------------------------------------------------
// Regular polygon
// ---------------------------------------------------------------------------

/**
 * Vertices of a regular polygon. Matches the winding and phase used by
 * the tool preview renderer so the committed shape is identical to the
 * shape the operator saw during the gesture.
 */
export function regularPolygonPoints(
  center: Point,
  radius_m: number,
  sides: number,
  rotation_deg: number,
): readonly Point[] {
  const points: Point[] = [];
  const phase = (rotation_deg * Math.PI) / 180;
  for (let i = 0; i < sides; i++) {
    const angle = (2 * Math.PI * i) / sides + phase;
    points.push(quantizePoint({
      x_m: center.x_m + radius_m * Math.cos(angle),
      y_m: center.y_m + radius_m * Math.sin(angle),
    }));
  }
  return points;
}

// ---------------------------------------------------------------------------
// Tool command data → decoration geometry
// ---------------------------------------------------------------------------

/**
 * Convert committed tool data into a decoration geometry.
 *
 * Returns null for tools that produce no persisted object: `measure`
 * is a read-out, and `dimension` belongs to the annotation table of
 * E9.3, which the editor does not yet write.
 */
export function geometryFromCommandData(
  data: ShapeCommandData,
): DecorationGeometry | null {
  switch (data.kind) {
    case 'rect': {
      const x = Math.min(data.origin.x_m, data.corner.x_m);
      const y = Math.min(data.origin.y_m, data.corner.y_m);
      return {
        type: 'rectangle',
        origin: quantizePoint({ x_m: x, y_m: y }),
        width_m: quantizePosition(Math.abs(data.corner.x_m - data.origin.x_m)),
        height_m: quantizePosition(Math.abs(data.corner.y_m - data.origin.y_m)),
      };
    }
    case 'ellipse':
      return {
        type: 'ellipse',
        center: quantizePoint(data.center),
        rx_m: quantizePosition(data.rx_m),
        ry_m: quantizePosition(data.ry_m),
      };
    case 'polygon':
      return {
        type: 'polygon',
        points: regularPolygonPoints(
          data.center,
          data.radius_m,
          data.sides,
          quantizeAngle(data.rotation_deg),
        ),
      };
    case 'polyline':
      return { type: 'polyline', points: data.points.map(quantizePoint) };
    case 'measure':
    case 'dimension':
      return null;
  }
}

/** The decoration kind a geometry belongs to (E9.3 `kind` column). */
export function kindForGeometry(geometry: DecorationGeometry): DecorationKind {
  switch (geometry.type) {
    case 'polygon':
    case 'rectangle':
    case 'ellipse':
      return 'area';
    case 'polyline':
      return 'path';
    case 'symbol_ref':
      return 'symbol';
  }
}
