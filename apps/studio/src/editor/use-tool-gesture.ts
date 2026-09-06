/**
 * E7.1 + E8 — Tool gesture hook.
 *
 * Wires pointer events from the Viewport to the tool state machine,
 * passing through the snap pipeline for position resolution.
 *
 * Responsibilities:
 *   1. Convert pointer screen coords → meter-space via pixelToMeter.
 *   2. Run the snap pipeline to get snapped position.
 *   3. Dispatch gesture events to the tool reducer.
 *   4. Expose the active snap target for visual feedback (snap indicator).
 *
 * This module is a React hook — the only stateful integration point.
 * All heavy logic is delegated to pure functions (snap-integration,
 * tool-state, view-transform).
 */

import { useCallback, useRef, useState } from 'react';
import type { Point, ViewState, ViewportSize } from '@azimut/core-model';
import { pixelToMeter } from '@azimut/core-model';
import type { SnapResult } from './snap.js';
import type { SceneObject, SnapConfig } from './snap-integration.js';
import { runSnapPipeline, DEFAULT_SNAP_CONFIG } from './snap-integration.js';
import type {
  ToolState,
  ToolAction,
  PointerData,
} from './tool-state.js';

// ---------------------------------------------------------------------------
// Hook options
// ---------------------------------------------------------------------------

export type UseToolGestureOptions = {
  /** Current view state (from viewport reducer). */
  readonly view: ViewState;
  /** Viewport dimensions in pixels. */
  readonly viewport: ViewportSize;
  /** Scene objects available for snapping. */
  readonly sceneObjects: readonly SceneObject[];
  /** Tool state from the tool reducer. */
  readonly toolState: ToolState;
  /** Dispatch function for the tool reducer. */
  readonly dispatchTool: (action: ToolAction) => void;
  /** Snap configuration. */
  readonly snapConfig?: SnapConfig | undefined;
  /** Whether the viewport is in pan mode (space held or hand tool). */
  readonly isPanMode: boolean;
};

// ---------------------------------------------------------------------------
// Hook return
// ---------------------------------------------------------------------------

export type ToolGestureHandlers = {
  /** Attach to SVG onPointerDown. */
  readonly onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => void;
  /** Attach to SVG onPointerMove. */
  readonly onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => void;
  /** Attach to SVG onPointerUp. */
  readonly onPointerUp: (e: React.PointerEvent<SVGSVGElement>) => void;
  /** Current snap result (for rendering snap indicator). */
  readonly snapResult: SnapResult;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NO_SNAP: SnapResult = {
  point: { x_m: 0, y_m: 0 },
  target: null,
};

function screenToMeter(
  clientX: number,
  clientY: number,
  svgRect: DOMRect,
  view: ViewState,
  viewport: ViewportSize,
): Point {
  const sx = clientX - svgRect.left;
  const sy = clientY - svgRect.top;
  return pixelToMeter({ x: sx, y: sy }, view, viewport);
}

function buildPointerData(
  position_m: Point,
  screenX: number,
  screenY: number,
  e: React.PointerEvent,
): PointerData {
  return {
    position_m,
    screenX,
    screenY,
    shiftKey: e.shiftKey,
    ctrlKey: e.ctrlKey,
    altKey: e.altKey,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook that connects pointer events → snap pipeline → tool reducer.
 *
 * Usage in Viewport:
 *   const { onPointerDown, onPointerMove, onPointerUp, snapResult }
 *     = useToolGesture({ view, viewport, sceneObjects, ... });
 *
 * The handlers should be attached to the SVG element. They will not
 * interfere with pan (middle-button / space+left) — those are filtered
 * by `isPanMode` and button check.
 */
export function useToolGesture(
  options: UseToolGestureOptions,
): ToolGestureHandlers {
  const {
    view,
    viewport,
    sceneObjects,
    dispatchTool,
    snapConfig = DEFAULT_SNAP_CONFIG,
    isPanMode,
  } = options;

  const [snapResult, setSnapResult] = useState<SnapResult>(NO_SNAP);
  const svgRectRef = useRef<DOMRect | null>(null);

  // Cache SVG bounding rect from the event target's ownerSVGElement
  const getSvgRect = useCallback((e: React.PointerEvent<SVGSVGElement>): DOMRect => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    svgRectRef.current = rect;
    return rect;
  }, []);

  const resolveSnappedPosition = useCallback((
    clientX: number,
    clientY: number,
    rect: DOMRect,
  ): { snapped: Point; screenX: number; screenY: number; result: SnapResult } => {
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    const rawMeter = screenToMeter(clientX, clientY, rect, view, viewport);

    const result = runSnapPipeline(
      { x: screenX, y: screenY },
      rawMeter,
      sceneObjects,
      view,
      viewport,
      snapConfig,
    );

    setSnapResult(result);
    return { snapped: result.point, screenX, screenY, result };
  }, [view, viewport, sceneObjects, snapConfig]);

  const onPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    // Only left-click, and not in pan mode
    if (e.button !== 0 || isPanMode) return;

    const rect = getSvgRect(e);
    const { snapped, screenX, screenY } = resolveSnappedPosition(
      e.clientX, e.clientY, rect,
    );

    dispatchTool({
      type: 'gesture',
      event: {
        type: 'pointer_down',
        data: buildPointerData(snapped, screenX, screenY, e),
      },
    });
  }, [isPanMode, getSvgRect, resolveSnappedPosition, dispatchTool]);

  const onPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (isPanMode) return;

    const rect = svgRectRef.current ?? getSvgRect(e);
    const { snapped, screenX, screenY } = resolveSnappedPosition(
      e.clientX, e.clientY, rect,
    );

    dispatchTool({
      type: 'gesture',
      event: {
        type: 'pointer_move',
        data: buildPointerData(snapped, screenX, screenY, e),
      },
    });
  }, [isPanMode, getSvgRect, resolveSnappedPosition, dispatchTool]);

  const onPointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 || isPanMode) return;

    const rect = svgRectRef.current ?? getSvgRect(e);
    const { snapped, screenX, screenY } = resolveSnappedPosition(
      e.clientX, e.clientY, rect,
    );

    dispatchTool({
      type: 'gesture',
      event: {
        type: 'pointer_up',
        data: buildPointerData(snapped, screenX, screenY, e),
      },
    });
  }, [isPanMode, getSvgRect, resolveSnappedPosition, dispatchTool]);

  return { onPointerDown, onPointerMove, onPointerUp, snapResult };
}
