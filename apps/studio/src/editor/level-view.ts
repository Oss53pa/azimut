/**
 * E3.2 — Initial view state for a level.
 *
 * Computes the view that frames the content of a level: business
 * footprints and nodes, plus the habillage shapes of E9. Pure, so the
 * same level always opens on the same view (invariant 4).
 */

import type { Point, SiteData, ViewState } from '@azimut/core-model';
import type { Bounds } from './shape-geometry.js';
import { geometryBounds } from './shape-geometry.js';
import type { DecorationShape } from './scene-objects.js';

// ---------------------------------------------------------------------------
// Framing constants
// ---------------------------------------------------------------------------

/** Reference viewport used to pick a scale before the SVG is measured. */
const REFERENCE_WIDTH_PX = 700;
const REFERENCE_HEIGHT_PX = 400;
/** Share of the viewport the content occupies, leaving a margin. */
const FILL_RATIO = 0.85;
/** Smallest span considered, so a single point does not divide by zero. */
const MIN_SPAN_M = 0.1;
const MIN_SCALE_PX_PER_M = 0.05;
const MAX_SCALE_PX_PER_M = 500;

// ---------------------------------------------------------------------------
// Bounds accumulation
// ---------------------------------------------------------------------------

class BoundsAccumulator {
  private minX = Infinity;
  private minY = Infinity;
  private maxX = -Infinity;
  private maxY = -Infinity;
  private found = false;

  addPoint(p: Point): void {
    if (p.x_m < this.minX) this.minX = p.x_m;
    if (p.y_m < this.minY) this.minY = p.y_m;
    if (p.x_m > this.maxX) this.maxX = p.x_m;
    if (p.y_m > this.maxY) this.maxY = p.y_m;
    this.found = true;
  }

  addBounds(b: Bounds): void {
    this.addPoint({ x_m: b.minX_m, y_m: b.minY_m });
    this.addPoint({ x_m: b.maxX_m, y_m: b.maxY_m });
  }

  result(): Bounds | null {
    if (!this.found) return null;
    return {
      minX_m: this.minX,
      minY_m: this.minY,
      maxX_m: this.maxX,
      maxY_m: this.maxY,
    };
  }
}

/** Combined bounds of everything drawn on a level. */
export function levelBounds(
  site: SiteData,
  levelId: string,
  decoration: readonly DecorationShape[],
): Bounds | null {
  const acc = new BoundsAccumulator();

  for (const fp of site.footprints) {
    if (fp.level_id !== levelId) continue;
    for (const v of fp.geometry.vertices) acc.addPoint(v);
  }
  for (const node of site.graph.nodes) {
    if (node.level_id !== levelId) continue;
    acc.addPoint(node.position);
  }
  for (const shape of decoration) {
    const b = geometryBounds(shape.geometry);
    if (b !== null) acc.addBounds(b);
  }

  return acc.result();
}

// ---------------------------------------------------------------------------
// View state
// ---------------------------------------------------------------------------

/**
 * View framing a level's content, or undefined when the level is empty
 * and there is nothing to frame.
 */
export function levelInitialView(
  site: SiteData,
  levelId: string,
  decoration: readonly DecorationShape[],
): ViewState | undefined {
  if (levelId === '') return undefined;

  const bounds = levelBounds(site, levelId, decoration);
  if (bounds === null) return undefined;

  const spanX = Math.max(bounds.maxX_m - bounds.minX_m, MIN_SPAN_M);
  const spanY = Math.max(bounds.maxY_m - bounds.minY_m, MIN_SPAN_M);
  const scale = Math.min(
    REFERENCE_WIDTH_PX / spanX,
    REFERENCE_HEIGHT_PX / spanY,
  ) * FILL_RATIO;

  return {
    centerX_m: (bounds.minX_m + bounds.maxX_m) / 2,
    centerY_m: (bounds.minY_m + bounds.maxY_m) / 2,
    scale_px_per_m: Math.max(
      MIN_SCALE_PX_PER_M,
      Math.min(MAX_SCALE_PX_PER_M, scale),
    ),
    rotationDeg: 0,
  };
}
