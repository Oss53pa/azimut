/**
 * E3 + E7 + E8 — Editor canvas.
 *
 * Assembles the full editor workspace:
 *   - Toolbar (left panel, tool selection)
 *   - Viewport (SVG canvas with pan/zoom)
 *   - FloorPlanScene (business objects)
 *   - ToolPreviewRenderer (active tool geometry)
 *   - SnapIndicator (visual snap feedback)
 *
 * State management:
 *   - Viewport state: useReducer (viewport-state.ts)
 *   - Tool state: useReducer via createToolReducer (tool-state.ts)
 *   - Snap integration: useToolGesture hook
 *
 * No external state management library (A3.3).
 * All coordinate conversions go through view-transform (E3.1).
 */

import {
  type JSX,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import type { ViewState, ViewportSize } from '@azimut/core-model';
import { viewTransformSvg } from '@azimut/core-model';
import { viewReducer, DEFAULT_VIEW } from './viewport-state.js';
import { createToolReducer, DEFAULT_TOOL_STATE } from './tool-state.js';
import type { ToolAction, ToolState } from './tool-state.js';
import { Toolbar } from './Toolbar.js';
import { ToolPreviewRenderer } from './scene/ToolPreviewRenderer.js';
import { SnapIndicator } from './scene/SnapIndicator.js';
import { useToolGesture } from './use-tool-gesture.js';
import type { SceneObject } from './snap-integration.js';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type EditorCanvasProps = {
  /** Scene content (FloorPlanScene, decoration layers, etc.). */
  readonly children: ReactNode;
  /** Scene objects for snap targets. */
  readonly sceneObjects?: readonly SceneObject[] | undefined;
  /** Initial view state. */
  readonly initialView?: ViewState | undefined;
  /** Callback when view changes. */
  readonly onViewChange?: ((view: ViewState) => void) | undefined;
  /** Callback when tool state changes. */
  readonly onToolChange?: ((state: ToolState) => void) | undefined;
  /** Accessibility label for the SVG viewport. */
  readonly ariaLabel?: string | undefined;
};

// ---------------------------------------------------------------------------
// Layout styles (inline, no hardcoded colors — A2.4)
// ---------------------------------------------------------------------------

const EDITOR_STYLE: React.CSSProperties = {
  display: 'flex',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
};

const CANVAS_STYLE: React.CSSProperties = {
  flex: 1,
  position: 'relative',
  overflow: 'hidden',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EditorCanvas({
  children,
  sceneObjects = [],
  initialView,
  onViewChange,
  onToolChange,
  ariaLabel = 'Éditeur de plan',
}: EditorCanvasProps): JSX.Element {
  // ---- View state ----
  const [view, dispatchView] = useReducer(viewReducer, initialView ?? DEFAULT_VIEW);
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => { onViewChange?.(view); }, [view, onViewChange]);

  // ---- Tool state ----
  const toolReducer = useMemo(() => createToolReducer(), []);
  const [toolState, dispatchToolRaw] = useReducer(toolReducer, DEFAULT_TOOL_STATE);

  const dispatchTool = useCallback((action: ToolAction) => {
    dispatchToolRaw(action);
  }, []);

  useEffect(() => { onToolChange?.(toolState); }, [toolState, onToolChange]);

  // ---- Viewport measurement ----
  const svgRef = useRef<SVGSVGElement>(null);
  const getViewport = useCallback((): ViewportSize => {
    const el = svgRef.current;
    if (el === null) return { width_px: 800, height_px: 600 };
    return { width_px: el.clientWidth, height_px: el.clientHeight };
  }, []);

  // ---- Pan state ----
  const spaceHeld = useRef(false);
  const panOrigin = useRef<{ x: number; y: number } | null>(null);
  const isPanMode = toolState.currentTool === 'hand' || spaceHeld.current;

  // ---- Tool gesture hook (snap integration) ----
  const viewport = getViewport();
  const { onPointerDown: toolPointerDown, onPointerMove: toolPointerMove,
    onPointerUp: toolPointerUp, snapResult } = useToolGesture({
    view,
    viewport,
    sceneObjects,
    toolState,
    dispatchTool,
    isPanMode,
  });

  // ---- Viewport pan/zoom handlers ----
  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect === undefined && rect !== null) return;
    if (rect === null) return;

    dispatchView({
      type: 'zoom',
      steps: e.deltaY < 0 ? 1 : -1,
      pivot: { x: e.clientX - rect.left, y: e.clientY - rect.top },
      viewport: getViewport(),
    });
  }, [getViewport]);

  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const wantPan = e.button === 1 || (e.button === 0 && isPanMode);
    if (wantPan) {
      e.preventDefault();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      panOrigin.current = { x: e.clientX, y: e.clientY };
      return;
    }
    // Forward to tool gesture
    toolPointerDown(e);
  }, [isPanMode, toolPointerDown]);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (panOrigin.current !== null) {
      e.preventDefault();
      const dx = e.clientX - panOrigin.current.x;
      const dy = e.clientY - panOrigin.current.y;
      panOrigin.current = { x: e.clientX, y: e.clientY };
      dispatchView({ type: 'pan', dx_px: dx, dy_px: dy });
      return;
    }
    toolPointerMove(e);
  }, [toolPointerMove]);

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (panOrigin.current !== null) {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
      panOrigin.current = null;
      return;
    }
    toolPointerUp(e);
  }, [toolPointerUp]);

  // ---- Keyboard: space for pan, +/- for zoom, tool shortcuts in Toolbar ----
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === ' ') {
        e.preventDefault();
        spaceHeld.current = true;
      }
      if (e.key === '+' || e.key === '=') {
        const vp = getViewport();
        dispatchView({
          type: 'zoom', steps: 1,
          pivot: { x: vp.width_px / 2, y: vp.height_px / 2 },
          viewport: vp,
        });
      }
      if (e.key === '-') {
        const vp = getViewport();
        dispatchView({
          type: 'zoom', steps: -1,
          pivot: { x: vp.width_px / 2, y: vp.height_px / 2 },
          viewport: vp,
        });
      }
    };

    const handleKeyUp = (e: KeyboardEvent): void => {
      if (e.key === ' ') spaceHeld.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [getViewport]);

  // ---- Render ----
  const transform = viewTransformSvg(view, viewport);

  const cursor = isPanMode
    ? (panOrigin.current !== null ? 'grabbing' : 'grab')
    : 'crosshair';

  return (
    <div style={EDITOR_STYLE}>
      <Toolbar
        currentTool={toolState.currentTool}
        dispatchTool={dispatchTool}
      />
      <div style={CANVAS_STYLE}>
        <svg
          ref={svgRef}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            cursor,
            background: 'var(--az-main-bg)',
          }}
          aria-label={ariaLabel}
          role="img"
          tabIndex={0}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* Scene layer (meter-space) */}
          <g transform={transform}>
            {children}
            <ToolPreviewRenderer preview={toolState.preview} />
          </g>
          {/* Overlay layer (pixel-space) */}
          <g data-layer="overlay">
            <SnapIndicator snapResult={snapResult} />
          </g>
        </svg>
      </div>
    </div>
  );
}

// Re-export for convenience
export { type SceneObject } from './snap-integration.js';
