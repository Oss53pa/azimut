/**
 * T-1.2d — Snap integration with tools and scene.
 *
 * Bridges the snap system (E8) with the tool state machine (E7.1)
 * and the scene objects. Generates snap targets from actual scene
 * geometry and applies snapping to tool gestures.
 *
 * The snap pipeline:
 *   1. Collect snap targets from scene objects (vertices, midpoints, etc.)
 *   2. Add grid targets for the current viewport
 *   3. Run findSnapTarget with cursor position
 *   4. Return snapped position to the tool
 */

import type { Point, ViewState, ViewportSize } from '@azimut/core-model';
import { meterToPixel } from '@azimut/core-model';
import type { SnapTarget, SnapResult } from './snap.js';
import {
  findSnapTarget,
  generateGridTargets,
  generateMidpointTargets,
  DEFAULT_SNAP_TOLERANCE_PX,
} from './snap.js';

// ---------------------------------------------------------------------------
// Scene vertex extraction
// ---------------------------------------------------------------------------

export type SceneObject = {
  readonly id: string;
  readonly vertices: readonly Point[];
};

/**
 * Convert a meter-space point to screen pixels using the view transform.
 */
function toScreenPx(
  p: Point,
  view: ViewState,
  viewport: ViewportSize,
): { x: number; y: number } {
  const s = meterToPixel(p, view, viewport);
  return { x: s.x, y: s.y };
}

/**
 * Extract vertex snap targets from scene objects.
 */
export function extractVertexTargets(
  objects: readonly SceneObject[],
  view: ViewState,
  viewport: ViewportSize,
): readonly SnapTarget[] {
  const targets: SnapTarget[] = [];

  for (const obj of objects) {
    for (const v of obj.vertices) {
      const screen = toScreenPx(v, view, viewport);
      targets.push({
        kind: 'vertex',
        point: v,
        screenX: screen.x,
        screenY: screen.y,
        sourceId: `${obj.id}-v`,
      });
    }
  }

  return targets;
}

/**
 * Extract segment data from scene objects for midpoint generation.
 */
export function extractSegments(
  objects: readonly SceneObject[],
): readonly { from: Point; to: Point; id: string }[] {
  const segments: { from: Point; to: Point; id: string }[] = [];

  for (const obj of objects) {
    const verts = obj.vertices;
    for (let i = 0; i < verts.length; i++) {
      const from = verts[i];
      const to = verts[(i + 1) % verts.length];
      if (from === undefined || to === undefined) continue;
      segments.push({ from, to, id: `${obj.id}-s${i}` });
    }
  }

  return segments;
}

// ---------------------------------------------------------------------------
// Full snap pipeline
// ---------------------------------------------------------------------------

export type SnapConfig = {
  readonly enabled: boolean;
  readonly tolerancePx: number;
  readonly snapToVertices: boolean;
  readonly snapToMidpoints: boolean;
  readonly snapToGrid: boolean;
  readonly gridSpacing_m: number;
};

export const DEFAULT_SNAP_CONFIG: SnapConfig = {
  enabled: true,
  tolerancePx: DEFAULT_SNAP_TOLERANCE_PX,
  snapToVertices: true,
  snapToMidpoints: true,
  snapToGrid: true,
  gridSpacing_m: 1,
};

/**
 * Run the full snap pipeline for a cursor position.
 *
 * @param cursorScreen - Cursor position in screen pixels.
 * @param cursorMeter - Cursor position in meters (unsnapped).
 * @param objects - Scene objects to snap to.
 * @param view - Current viewport state.
 * @param viewport - Viewport dimensions.
 * @param config - Snap configuration.
 * @returns Snap result with snapped position and target info.
 */
export function runSnapPipeline(
  cursorScreen: { x: number; y: number },
  cursorMeter: Point,
  objects: readonly SceneObject[],
  view: ViewState,
  viewport: ViewportSize,
  config: SnapConfig = DEFAULT_SNAP_CONFIG,
): SnapResult {
  if (!config.enabled) {
    return { point: cursorMeter, target: null };
  }

  const targets: SnapTarget[] = [];

  // 1. Vertex targets
  if (config.snapToVertices) {
    targets.push(
      ...extractVertexTargets(objects, view, viewport),
    );
  }

  // 2. Midpoint targets
  if (config.snapToMidpoints) {
    const segments = extractSegments(objects);
    const toScreen = (p: Point) => toScreenPx(p, view, viewport);
    targets.push(...generateMidpointTargets(segments, toScreen));
  }

  // 3. Grid targets
  if (config.snapToGrid && config.gridSpacing_m > 0) {
    const halfW = viewport.width_px / (2 * view.scale_px_per_m);
    const halfH = viewport.height_px / (2 * view.scale_px_per_m);
    const toScreen = (p: Point) => toScreenPx(p, view, viewport);
    targets.push(
      ...generateGridTargets(
        config.gridSpacing_m,
        view.centerX_m - halfW, view.centerY_m - halfH,
        view.centerX_m + halfW, view.centerY_m + halfH,
        toScreen,
      ),
    );
  }

  // 4. Find best target
  return findSnapTarget(
    cursorScreen.x, cursorScreen.y,
    cursorMeter,
    targets,
    config.tolerancePx,
  );
}
