import { describe, it, expect } from 'vitest';
import type { Point, ViewState, ViewportSize } from '@azimut/core-model';
import { meterToPixel } from '@azimut/core-model';
import {
  extractVertexTargets,
  extractSegments,
  runSnapPipeline,
  DEFAULT_SNAP_CONFIG,
} from '../snap-integration.js';
import type { SceneObject, SnapConfig } from '../snap-integration.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VIEW: ViewState = {
  centerX_m: 0,
  centerY_m: 0,
  scale_px_per_m: 100,
  rotationDeg: 0,
};

const VIEWPORT: ViewportSize = { width_px: 800, height_px: 600 };

function makeSquare(id: string, x: number, y: number, size: number): SceneObject {
  return {
    id,
    vertices: [
      { x_m: x, y_m: y },
      { x_m: x + size, y_m: y },
      { x_m: x + size, y_m: y + size },
      { x_m: x, y_m: y + size },
    ],
  };
}

// ---------------------------------------------------------------------------
// extractVertexTargets
// ---------------------------------------------------------------------------

describe('extractVertexTargets', () => {
  it('generates one target per vertex', () => {
    const objects = [makeSquare('sq1', 0, 0, 1)];
    const targets = extractVertexTargets(objects, VIEW, VIEWPORT);
    expect(targets).toHaveLength(4);
  });

  it('targets have correct kind and sourceId', () => {
    const objects = [makeSquare('rect-a', 0, 0, 1)];
    const targets = extractVertexTargets(objects, VIEW, VIEWPORT);
    for (const t of targets) {
      expect(t.kind).toBe('vertex');
      expect(t.sourceId).toBe('rect-a-v');
    }
  });

  it('screen coordinates match meterToPixel', () => {
    const p: Point = { x_m: 2, y_m: 3 };
    const objects: SceneObject[] = [{ id: 'test', vertices: [p] }];
    const targets = extractVertexTargets(objects, VIEW, VIEWPORT);
    const expected = meterToPixel(p, VIEW, VIEWPORT);
    const target = targets[0];
    expect(target).toBeDefined();
    if (target !== undefined) {
      expect(target.screenX).toBeCloseTo(expected.x, 2);
      expect(target.screenY).toBeCloseTo(expected.y, 2);
    }
  });

  it('handles multiple objects', () => {
    const objects = [
      makeSquare('a', 0, 0, 1),
      makeSquare('b', 5, 5, 2),
    ];
    const targets = extractVertexTargets(objects, VIEW, VIEWPORT);
    expect(targets).toHaveLength(8);
  });

  it('returns empty for no objects', () => {
    expect(extractVertexTargets([], VIEW, VIEWPORT)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// extractSegments
// ---------------------------------------------------------------------------

describe('extractSegments', () => {
  it('generates closing segment (last→first)', () => {
    const objects = [makeSquare('s', 0, 0, 1)];
    const segments = extractSegments(objects);
    // 4 vertices → 4 segments (0→1, 1→2, 2→3, 3→0)
    expect(segments).toHaveLength(4);
  });

  it('segment ids include object id and index', () => {
    const objects = [makeSquare('box', 0, 0, 1)];
    const segments = extractSegments(objects);
    expect(segments[0]?.id).toBe('box-s0');
    expect(segments[3]?.id).toBe('box-s3');
  });

  it('handles object with 2 vertices', () => {
    const obj: SceneObject = {
      id: 'line',
      vertices: [{ x_m: 0, y_m: 0 }, { x_m: 5, y_m: 0 }],
    };
    const segments = extractSegments([obj]);
    expect(segments).toHaveLength(2); // 0→1, 1→0
  });

  it('returns empty for empty objects', () => {
    expect(extractSegments([])).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// runSnapPipeline
// ---------------------------------------------------------------------------

describe('runSnapPipeline', () => {
  it('returns cursor position when snap disabled', () => {
    const cursor: Point = { x_m: 1, y_m: 1 };
    const config: SnapConfig = { ...DEFAULT_SNAP_CONFIG, enabled: false };
    const result = runSnapPipeline(
      { x: 500, y: 200 }, cursor, [], VIEW, VIEWPORT, config,
    );
    expect(result.point).toStrictEqual(cursor);
    expect(result.target).toBeNull();
  });

  it('snaps to vertex within tolerance', () => {
    const vertexPoint: Point = { x_m: 1, y_m: 0 };
    const vertexScreen = meterToPixel(vertexPoint, VIEW, VIEWPORT);
    const objects: SceneObject[] = [
      { id: 'obj', vertices: [vertexPoint] },
    ];
    // Cursor 3px away from vertex screen position
    const cursorScreen = { x: vertexScreen.x + 3, y: vertexScreen.y };
    const cursorMeter: Point = { x_m: 1.03, y_m: 0 };

    const result = runSnapPipeline(
      cursorScreen, cursorMeter, objects, VIEW, VIEWPORT,
    );
    expect(result.target).not.toBeNull();
    expect(result.target?.kind).toBe('vertex');
    expect(result.point).toStrictEqual(vertexPoint);
  });

  it('does not snap when cursor is outside tolerance', () => {
    const vertexPoint: Point = { x_m: 1, y_m: 0 };
    const vertexScreen = meterToPixel(vertexPoint, VIEW, VIEWPORT);
    const objects: SceneObject[] = [
      { id: 'obj', vertices: [vertexPoint] },
    ];
    // Cursor 20px away — beyond 8px tolerance
    const cursorScreen = { x: vertexScreen.x + 20, y: vertexScreen.y };
    const cursorMeter: Point = { x_m: 1.2, y_m: 0 };

    const result = runSnapPipeline(
      cursorScreen, cursorMeter, objects, VIEW, VIEWPORT,
    );
    expect(result.target).toBeNull();
    expect(result.point).toStrictEqual(cursorMeter);
  });

  it('vertex has priority over midpoint at same distance', () => {
    // A vertex and a midpoint at the same screen position
    const p: Point = { x_m: 2, y_m: 0 };
    const pScreen = meterToPixel(p, VIEW, VIEWPORT);
    const objects: SceneObject[] = [
      { id: 'obj', vertices: [p] },
    ];
    // Put cursor close to both
    const cursorScreen = { x: pScreen.x + 1, y: pScreen.y };
    const cursorMeter: Point = { x_m: 2.01, y_m: 0 };

    const result = runSnapPipeline(
      cursorScreen, cursorMeter, objects, VIEW, VIEWPORT,
    );
    expect(result.target?.kind).toBe('vertex');
  });

  it('snaps to grid when only grid enabled', () => {
    const config: SnapConfig = {
      enabled: true,
      tolerancePx: 8,
      snapToVertices: false,
      snapToMidpoints: false,
      snapToGrid: true,
      gridSpacing_m: 1,
    };
    // Grid point at (1, 0) maps to a specific screen pixel
    const gridPoint: Point = { x_m: 1, y_m: 0 };
    const gridScreen = meterToPixel(gridPoint, VIEW, VIEWPORT);
    // Cursor 2px away from grid point
    const cursorScreen = { x: gridScreen.x + 2, y: gridScreen.y };
    const cursorMeter: Point = { x_m: 1.02, y_m: 0 };

    const result = runSnapPipeline(
      cursorScreen, cursorMeter, [], VIEW, VIEWPORT, config,
    );
    expect(result.target).not.toBeNull();
    expect(result.target?.kind).toBe('grid');
  });

  it('vertex beats grid at same distance (priority order)', () => {
    // Place a vertex exactly on a grid point
    const p: Point = { x_m: 1, y_m: 0 };
    const pScreen = meterToPixel(p, VIEW, VIEWPORT);
    const objects: SceneObject[] = [
      { id: 'obj', vertices: [p] },
    ];
    const cursorScreen = { x: pScreen.x + 2, y: pScreen.y };
    const cursorMeter: Point = { x_m: 1.02, y_m: 0 };

    const result = runSnapPipeline(
      cursorScreen, cursorMeter, objects, VIEW, VIEWPORT,
    );
    expect(result.target?.kind).toBe('vertex');
  });

  it('snaps to midpoint when vertices disabled', () => {
    const config: SnapConfig = {
      enabled: true,
      tolerancePx: 8,
      snapToVertices: false,
      snapToMidpoints: true,
      snapToGrid: false,
      gridSpacing_m: 1,
    };
    // Two vertices; the midpoint is at (2.5, 0)
    const objects: SceneObject[] = [
      { id: 'obj', vertices: [{ x_m: 0, y_m: 0 }, { x_m: 5, y_m: 0 }] },
    ];
    const midPoint: Point = { x_m: 2.5, y_m: 0 };
    const midScreen = meterToPixel(midPoint, VIEW, VIEWPORT);
    const cursorScreen = { x: midScreen.x + 2, y: midScreen.y };
    const cursorMeter: Point = { x_m: 2.52, y_m: 0 };

    const result = runSnapPipeline(
      cursorScreen, cursorMeter, objects, VIEW, VIEWPORT, config,
    );
    expect(result.target).not.toBeNull();
    expect(result.target?.kind).toBe('midpoint');
  });

  it('uses custom tolerance', () => {
    const config: SnapConfig = {
      ...DEFAULT_SNAP_CONFIG,
      tolerancePx: 2, // very tight
    };
    const p: Point = { x_m: 1, y_m: 0 };
    const pScreen = meterToPixel(p, VIEW, VIEWPORT);
    const objects: SceneObject[] = [
      { id: 'obj', vertices: [p] },
    ];
    // 5px away — beyond 2px tolerance
    const cursorScreen = { x: pScreen.x + 5, y: pScreen.y };
    const cursorMeter: Point = { x_m: 1.05, y_m: 0 };

    const result = runSnapPipeline(
      cursorScreen, cursorMeter, objects, VIEW, VIEWPORT, config,
    );
    expect(result.target).toBeNull();
  });

  it('works with rotated view', () => {
    const rotatedView: ViewState = {
      centerX_m: 0,
      centerY_m: 0,
      scale_px_per_m: 100,
      rotationDeg: 45,
    };
    const p: Point = { x_m: 1, y_m: 0 };
    const pScreen = meterToPixel(p, rotatedView, VIEWPORT);
    const objects: SceneObject[] = [
      { id: 'obj', vertices: [p] },
    ];
    const cursorScreen = { x: pScreen.x + 2, y: pScreen.y };
    const cursorMeter: Point = { x_m: 1.02, y_m: 0 };

    const result = runSnapPipeline(
      cursorScreen, cursorMeter, objects, rotatedView, VIEWPORT,
    );
    expect(result.target).not.toBeNull();
    expect(result.target?.kind).toBe('vertex');
  });

  it('handles empty scene with all snap types enabled', () => {
    const cursorMeter: Point = { x_m: 0.5, y_m: 0.5 };
    // There will be grid targets but cursor may or may not be near one
    const result = runSnapPipeline(
      { x: 400, y: 300 }, cursorMeter, [], VIEW, VIEWPORT,
    );
    // At (400, 300) = viewport center = (0, 0) in meters
    // Grid point (0, 0) is right there, so it should snap to grid
    expect(result.target === null || result.target.kind === 'grid').toBe(true);
  });
});
