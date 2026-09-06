/**
 * E3.1 — Two coordinate systems, one transformation.
 *
 * Business coordinate system (meter-space):
 *   origin: arbitrary, X east, Y north (D1.1).
 *
 * View coordinate system (pixel-space):
 *   origin: top-left of viewport, X right, Y down.
 *
 * A single module exports the conversion in both directions.
 * **No UI component computes its own conversion.**
 */

import type { Point } from './geometry.js';
import { normalizeAzimuth } from './angle.js';
import { roundSvg } from './round.js';

// ---------------------------------------------------------------------------
// E3.2 — View state
// ---------------------------------------------------------------------------

/** Immutable view state. Never stored in business data. */
export type ViewState = {
  /** Center of the viewport in meters. */
  readonly centerX_m: number;
  readonly centerY_m: number;
  /** Zoom level: how many pixels represent one meter. */
  readonly scale_px_per_m: number;
  /** Rotation for oriented-plan preview only. Compass convention (D1.3). */
  readonly rotationDeg: number;
};

// ---------------------------------------------------------------------------
// E3.3 — Scale bounds
// ---------------------------------------------------------------------------

/** Minimum scale (fully zoomed out). */
export const MIN_SCALE_PX_PER_M = 0.05;
/** Maximum scale (fully zoomed in). */
export const MAX_SCALE_PX_PER_M = 500;
/** Zoom factor per discrete step (wheel tick, shortcut press). */
export const ZOOM_STEP_FACTOR = 1.15;

// ---------------------------------------------------------------------------
// E4.2 — Quantization step for editing operations
// ---------------------------------------------------------------------------

/**
 * Position quantization step: 1 mm.
 * Applied at operation validation, never during a gesture, never at render.
 */
export const POSITION_STEP_M = 0.001;

/**
 * Angle quantization step: 0.01 degree.
 * Applied at operation validation with normalizeAzimuth.
 */
export const ANGLE_STEP_DEG = 0.01;

// ---------------------------------------------------------------------------
// Viewport dimensions (provided by the hosting component)
// ---------------------------------------------------------------------------

export type ViewportSize = {
  readonly width_px: number;
  readonly height_px: number;
};

// ---------------------------------------------------------------------------
// Core transformation functions
// ---------------------------------------------------------------------------

/**
 * Convert a point from meter-space to pixel-space.
 *
 * When rotationDeg is 0 (the common case):
 *   px_x = (m_x - centerX_m) * scale + viewport.width / 2
 *   px_y = (centerY_m - m_y) * scale + viewport.height / 2
 *
 * The Y-axis is flipped: north (positive Y in meters) is up on screen.
 *
 * When rotationDeg ≠ 0, meter-space is rotated around the viewport center
 * before scaling — used for oriented plan preview (E3.2).
 */
export function meterToPixel(
  point: Point,
  view: ViewState,
  viewport: ViewportSize,
): { readonly x: number; readonly y: number } {
  const dx = point.x_m - view.centerX_m;
  const dy = point.y_m - view.centerY_m;

  let rx: number;
  let ry: number;

  if (view.rotationDeg === 0) {
    rx = dx;
    ry = dy;
  } else {
    const rad = (view.rotationDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    rx = dx * cos - dy * sin;
    ry = dx * sin + dy * cos;
  }

  return {
    x: roundSvg(rx * view.scale_px_per_m + viewport.width_px / 2),
    y: roundSvg(-ry * view.scale_px_per_m + viewport.height_px / 2),
  };
}

/**
 * Convert a point from pixel-space to meter-space.
 * Inverse of `meterToPixel`.
 */
export function pixelToMeter(
  px: { readonly x: number; readonly y: number },
  view: ViewState,
  viewport: ViewportSize,
): Point {
  const rx = (px.x - viewport.width_px / 2) / view.scale_px_per_m;
  const ry = -(px.y - viewport.height_px / 2) / view.scale_px_per_m;

  let dx: number;
  let dy: number;

  if (view.rotationDeg === 0) {
    dx = rx;
    dy = ry;
  } else {
    const rad = (-view.rotationDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    dx = rx * cos - ry * sin;
    dy = rx * sin + ry * cos;
  }

  return {
    x_m: dx + view.centerX_m,
    y_m: dy + view.centerY_m,
  };
}

// ---------------------------------------------------------------------------
// Scale helpers
// ---------------------------------------------------------------------------

/**
 * Clamp a scale value to the allowed range (E3.3).
 * Returns the clamped value — never throws.
 */
export function clampScale(scale: number): number {
  if (scale < MIN_SCALE_PX_PER_M) return MIN_SCALE_PX_PER_M;
  if (scale > MAX_SCALE_PX_PER_M) return MAX_SCALE_PX_PER_M;
  return scale;
}

/**
 * Apply a discrete zoom step (positive = zoom in, negative = zoom out).
 * The result is clamped to [MIN_SCALE, MAX_SCALE].
 */
export function applyZoomStep(
  currentScale: number,
  steps: number,
): number {
  return clampScale(currentScale * ZOOM_STEP_FACTOR ** steps);
}

// ---------------------------------------------------------------------------
// Quantization helpers (E4)
// ---------------------------------------------------------------------------

/**
 * Quantize a meter value to the nearest millimeter (E4.2).
 * Called at operation validation, never during a gesture.
 */
export function quantizePosition(value_m: number): number {
  return Math.round(value_m / POSITION_STEP_M) * POSITION_STEP_M;
}

/**
 * Quantize a point to millimeter precision.
 */
export function quantizePoint(p: Point): Point {
  return {
    x_m: quantizePosition(p.x_m),
    y_m: quantizePosition(p.y_m),
  };
}

/**
 * Quantize and normalize an angle to 0.01° precision in [0, 360) (E4.3).
 */
export function quantizeAngle(deg: number): number {
  const rounded = Math.round(deg / ANGLE_STEP_DEG) * ANGLE_STEP_DEG;
  return normalizeAzimuth(rounded);
}

// ---------------------------------------------------------------------------
// SVG transform string
// ---------------------------------------------------------------------------

/**
 * Produce the SVG `transform` attribute for the view layer.
 * Applied to a single `<g>` that wraps all scene content.
 */
export function viewTransformSvg(
  view: ViewState,
  viewport: ViewportSize,
): string {
  const tx = roundSvg(viewport.width_px / 2 - view.centerX_m * view.scale_px_per_m);
  const ty = roundSvg(viewport.height_px / 2 + view.centerY_m * view.scale_px_per_m);
  const s = roundSvg(view.scale_px_per_m);
  const parts: string[] = [
    `translate(${tx},${ty})`,
    `scale(${s},${-s})`,
  ];
  if (view.rotationDeg !== 0) {
    parts.push(`rotate(${roundSvg(-view.rotationDeg)})`);
  }
  return parts.join(' ');
}
