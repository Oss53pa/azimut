/**
 * Tests for the tool gesture integration.
 *
 * Since useToolGesture is a React hook, we test the underlying
 * pure-function integration path: the combination of pixelToMeter,
 * runSnapPipeline, and tool dispatch.
 *
 * The hook itself is thin wiring — the logic lives in the pure modules.
 */

import { describe, it, expect } from 'vitest';
import type { Point, ViewState, ViewportSize } from '@azimut/core-model';
import { pixelToMeter, meterToPixel } from '@azimut/core-model';
import { runSnapPipeline, DEFAULT_SNAP_CONFIG } from '../snap-integration.js';
import type { SceneObject, SnapConfig } from '../snap-integration.js';
import { createToolReducer, DEFAULT_TOOL_STATE } from '../tool-state.js';
import type { ToolState, ToolAction, PointerData } from '../tool-state.js';

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

// Simulate the hook's pipeline: screen → meter → snap → tool dispatch
function simulateGesture(
  screenX: number,
  screenY: number,
  view: ViewState,
  viewport: ViewportSize,
  objects: readonly SceneObject[],
  snapConfig: SnapConfig,
): { snapped: Point; rawMeter: Point } {
  const rawMeter = pixelToMeter({ x: screenX, y: screenY }, view, viewport);
  const result = runSnapPipeline(
    { x: screenX, y: screenY },
    rawMeter,
    objects,
    view,
    viewport,
    snapConfig,
  );
  return { snapped: result.point, rawMeter };
}

// ---------------------------------------------------------------------------
// Integration: screen → meter → snap
// ---------------------------------------------------------------------------

describe('tool gesture integration: screen→meter→snap pipeline', () => {
  it('converts screen center to meter origin', () => {
    const { rawMeter } = simulateGesture(
      400, 300, VIEW, VIEWPORT, [], DEFAULT_SNAP_CONFIG,
    );
    expect(rawMeter.x_m).toBeCloseTo(0, 1);
    expect(rawMeter.y_m).toBeCloseTo(0, 1);
  });

  it('snaps to nearby vertex when present', () => {
    const vertex: Point = { x_m: 1, y_m: 0 };
    const objects: SceneObject[] = [{ id: 'obj', vertices: [vertex] }];
    const vScreen = meterToPixel(vertex, VIEW, VIEWPORT);

    // Cursor 3px to the right of vertex
    const { snapped } = simulateGesture(
      vScreen.x + 3, vScreen.y,
      VIEW, VIEWPORT, objects, DEFAULT_SNAP_CONFIG,
    );
    expect(snapped.x_m).toBeCloseTo(1, 2);
    expect(snapped.y_m).toBeCloseTo(0, 2);
  });

  it('returns raw meter position when snap disabled', () => {
    const vertex: Point = { x_m: 1, y_m: 0 };
    const objects: SceneObject[] = [{ id: 'obj', vertices: [vertex] }];
    const vScreen = meterToPixel(vertex, VIEW, VIEWPORT);
    const noSnap: SnapConfig = { ...DEFAULT_SNAP_CONFIG, enabled: false };

    const { snapped, rawMeter } = simulateGesture(
      vScreen.x + 3, vScreen.y,
      VIEW, VIEWPORT, objects, noSnap,
    );
    expect(snapped).toStrictEqual(rawMeter);
  });

  it('round-trips: meter→screen→meter preserves position', () => {
    const original: Point = { x_m: 2.5, y_m: -1.3 };
    const screen = meterToPixel(original, VIEW, VIEWPORT);
    const back = pixelToMeter({ x: screen.x, y: screen.y }, VIEW, VIEWPORT);
    // Small rounding tolerance due to roundSvg
    expect(back.x_m).toBeCloseTo(original.x_m, 1);
    expect(back.y_m).toBeCloseTo(original.y_m, 1);
  });
});

// ---------------------------------------------------------------------------
// Integration: snapped position → tool state machine
// ---------------------------------------------------------------------------

describe('tool gesture integration: snap → tool state machine', () => {
  it('rectangle tool uses snapped position for preview', () => {
    const reducer = createToolReducer();
    let state: ToolState = { ...DEFAULT_TOOL_STATE, currentTool: 'rectangle' };

    // Simulate pointer down at origin
    const downData: PointerData = {
      position_m: { x_m: 0, y_m: 0 },
      screenX: 400, screenY: 300,
      shiftKey: false, ctrlKey: false, altKey: false,
    };
    const downAction: ToolAction = {
      type: 'gesture',
      event: { type: 'pointer_down', data: downData },
    };
    state = reducer(state, downAction);
    expect(state.phase).toBe('active');

    // Simulate pointer move with snapped position at (2, 1)
    const moveData: PointerData = {
      position_m: { x_m: 2, y_m: 1 },
      screenX: 600, screenY: 200,
      shiftKey: false, ctrlKey: false, altKey: false,
    };
    const moveAction: ToolAction = {
      type: 'gesture',
      event: { type: 'pointer_move', data: moveData },
    };
    state = reducer(state, moveAction);
    expect(state.preview.kind).toBe('rect');
    if (state.preview.kind === 'rect') {
      expect(state.preview.corner.x_m).toBe(2);
      expect(state.preview.corner.y_m).toBe(1);
    }
  });

  it('polyline tool accumulates snapped positions', () => {
    const reducer = createToolReducer();
    let state: ToolState = { ...DEFAULT_TOOL_STATE, currentTool: 'polyline' };

    // First click at snapped (0, 0)
    state = reducer(state, {
      type: 'gesture',
      event: {
        type: 'pointer_down',
        data: {
          position_m: { x_m: 0, y_m: 0 },
          screenX: 400, screenY: 300,
          shiftKey: false, ctrlKey: false, altKey: false,
        },
      },
    });
    expect(state.accumulatedPoints).toHaveLength(1);

    // Second click at snapped (3, 0)
    state = reducer(state, {
      type: 'gesture',
      event: {
        type: 'pointer_down',
        data: {
          position_m: { x_m: 3, y_m: 0 },
          screenX: 700, screenY: 300,
          shiftKey: false, ctrlKey: false, altKey: false,
        },
      },
    });
    expect(state.accumulatedPoints).toHaveLength(2);
    expect(state.accumulatedPoints[1]).toStrictEqual({ x_m: 3, y_m: 0 });
  });

  it('measure tool uses snapped endpoints', () => {
    const reducer = createToolReducer();
    let state: ToolState = { ...DEFAULT_TOOL_STATE, currentTool: 'measure' };

    state = reducer(state, {
      type: 'gesture',
      event: {
        type: 'pointer_down',
        data: {
          position_m: { x_m: 0, y_m: 0 },
          screenX: 400, screenY: 300,
          shiftKey: false, ctrlKey: false, altKey: false,
        },
      },
    });
    expect(state.phase).toBe('active');

    state = reducer(state, {
      type: 'gesture',
      event: {
        type: 'pointer_move',
        data: {
          position_m: { x_m: 5, y_m: 0 },
          screenX: 900, screenY: 300,
          shiftKey: false, ctrlKey: false, altKey: false,
        },
      },
    });
    expect(state.preview.kind).toBe('measure');
    if (state.preview.kind === 'measure') {
      expect(state.preview.to.x_m).toBe(5);
    }
  });

  it('shift constrains rectangle to square with snapped origin', () => {
    const reducer = createToolReducer();
    let state: ToolState = { ...DEFAULT_TOOL_STATE, currentTool: 'rectangle' };

    state = reducer(state, {
      type: 'gesture',
      event: {
        type: 'pointer_down',
        data: {
          position_m: { x_m: 0, y_m: 0 },
          screenX: 400, screenY: 300,
          shiftKey: false, ctrlKey: false, altKey: false,
        },
      },
    });

    // Shift held → square constraint
    state = reducer(state, {
      type: 'gesture',
      event: {
        type: 'pointer_move',
        data: {
          position_m: { x_m: 3, y_m: 2 },
          screenX: 700, screenY: 100,
          shiftKey: true, ctrlKey: false, altKey: false,
        },
      },
    });
    expect(state.preview.kind).toBe('rect');
    if (state.preview.kind === 'rect') {
      const w = Math.abs(state.preview.corner.x_m - state.preview.origin.x_m);
      const h = Math.abs(state.preview.corner.y_m - state.preview.origin.y_m);
      expect(w).toBe(h); // square
    }
  });
});
