/**
 * E3.4 — Interactive SVG viewport.
 *
 * Renders children inside a transformed `<g>` using the view transform
 * from core-model. Handles pan (middle-click drag, space+drag) and
 * zoom (wheel). All coordinate conversions go through view-transform —
 * this component never computes its own.
 *
 * Pointer events on SVG elements are native — E3.4 requires SVG DOM
 * rendering for free hit-testing and accessibility.
 */

import {
  type JSX,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useReducer,
} from 'react';
import type { ViewState, ViewportSize } from '@azimut/core-model';
import { viewTransformSvg } from '@azimut/core-model';
import { viewReducer, DEFAULT_VIEW } from './viewport-state.js';

type ViewportProps = {
  readonly children: ReactNode;
  readonly initialView?: ViewState;
  readonly onViewChange?: (view: ViewState) => void;
  readonly width?: string;
  readonly height?: string;
  readonly ariaLabel: string;
};

export function Viewport({
  children,
  initialView,
  onViewChange,
  width = '100%',
  height = '100%',
  ariaLabel,
}: ViewportProps): JSX.Element {
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, dispatch] = useReducer(viewReducer, initialView ?? DEFAULT_VIEW);
  const viewRef = useRef(view);
  viewRef.current = view;

  // Track whether space is held for pan mode
  const spaceHeld = useRef(false);
  // Track active pan gesture
  const panOrigin = useRef<{ x: number; y: number } | null>(null);

  // Notify parent of view changes
  useEffect(() => {
    onViewChange?.(view);
  }, [view, onViewChange]);

  // Measure viewport size from the SVG element
  const getViewport = useCallback((): ViewportSize => {
    const el = svgRef.current;
    if (!el) return { width_px: 800, height_px: 600 };
    return { width_px: el.clientWidth, height_px: el.clientHeight };
  }, []);

  // --- Wheel zoom (E3.3) ---
  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const steps = e.deltaY < 0 ? 1 : -1;
    dispatch({
      type: 'zoom',
      steps,
      pivot: { x: e.clientX - rect.left, y: e.clientY - rect.top },
      viewport: getViewport(),
    });
  }, [getViewport]);

  // --- Pointer pan ---
  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    // Middle button or space+left = pan
    const isPan = e.button === 1 || (e.button === 0 && spaceHeld.current);
    if (!isPan) return;

    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    panOrigin.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!panOrigin.current) return;
    e.preventDefault();

    const dx = e.clientX - panOrigin.current.x;
    const dy = e.clientY - panOrigin.current.y;
    panOrigin.current = { x: e.clientX, y: e.clientY };

    dispatch({ type: 'pan', dx_px: dx, dy_px: dy });
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!panOrigin.current) return;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    panOrigin.current = null;
  }, []);

  // --- Keyboard: space for pan mode, +/- for zoom ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === ' ') {
        e.preventDefault();
        spaceHeld.current = true;
      }
      if (e.key === '+' || e.key === '=') {
        dispatch({
          type: 'zoom',
          steps: 1,
          pivot: {
            x: getViewport().width_px / 2,
            y: getViewport().height_px / 2,
          },
          viewport: getViewport(),
        });
      }
      if (e.key === '-') {
        dispatch({
          type: 'zoom',
          steps: -1,
          pivot: {
            x: getViewport().width_px / 2,
            y: getViewport().height_px / 2,
          },
          viewport: getViewport(),
        });
      }
    };

    const handleKeyUp = (e: KeyboardEvent): void => {
      if (e.key === ' ') {
        spaceHeld.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [getViewport]);

  const vp = getViewport();
  const transform = viewTransformSvg(view, vp);

  return (
    <svg
      ref={svgRef}
      style={{
        width,
        height,
        display: 'block',
        cursor: spaceHeld.current ? 'grab' : 'default',
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
      <g transform={transform}>
        {children}
      </g>
    </svg>
  );
}
