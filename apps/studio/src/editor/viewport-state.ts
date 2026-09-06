/**
 * E3.2 — Viewport state management.
 *
 * View state is UI-only — it never enters the undo stack (E5.2),
 * never persists in the business model, and is memorized per level
 * and per user session.
 */

import type { ViewState, ViewportSize } from '@azimut/core-model';
import {
  clampScale,
  applyZoomStep,
  pixelToMeter,
} from '@azimut/core-model';

// ---------------------------------------------------------------------------
// Actions — all view manipulations expressed as plain data
// ---------------------------------------------------------------------------

export type ViewAction =
  | { readonly type: 'pan'; readonly dx_px: number; readonly dy_px: number }
  | { readonly type: 'zoom'; readonly steps: number; readonly pivot: { readonly x: number; readonly y: number }; readonly viewport: ViewportSize }
  | { readonly type: 'zoom_to_scale'; readonly scale: number }
  | { readonly type: 'center_on'; readonly x_m: number; readonly y_m: number }
  | { readonly type: 'set_rotation'; readonly deg: number }
  | { readonly type: 'fit'; readonly bounds: { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number }; readonly viewport: ViewportSize; readonly padding_px: number };

// ---------------------------------------------------------------------------
// Reducer — pure, deterministic, no side effects
// ---------------------------------------------------------------------------

export function viewReducer(state: ViewState, action: ViewAction): ViewState {
  switch (action.type) {
    case 'pan': {
      return {
        ...state,
        centerX_m: state.centerX_m - action.dx_px / state.scale_px_per_m,
        centerY_m: state.centerY_m + action.dy_px / state.scale_px_per_m,
      };
    }

    case 'zoom': {
      // Zoom towards the pointer position (pivot).
      // The meter-space point under the pointer should stay under it.
      const viewport = action.viewport;
      const mBefore = pixelToMeter(action.pivot, state, viewport);
      const newScale = applyZoomStep(state.scale_px_per_m, action.steps);

      if (newScale === state.scale_px_per_m) return state;

      const afterState: ViewState = { ...state, scale_px_per_m: newScale };
      const mAfter = pixelToMeter(action.pivot, afterState, viewport);

      return {
        ...afterState,
        centerX_m: afterState.centerX_m + (mBefore.x_m - mAfter.x_m),
        centerY_m: afterState.centerY_m + (mBefore.y_m - mAfter.y_m),
      };
    }

    case 'zoom_to_scale': {
      return {
        ...state,
        scale_px_per_m: clampScale(action.scale),
      };
    }

    case 'center_on': {
      return {
        ...state,
        centerX_m: action.x_m,
        centerY_m: action.y_m,
      };
    }

    case 'set_rotation': {
      return {
        ...state,
        rotationDeg: action.deg,
      };
    }

    case 'fit': {
      const { bounds, viewport, padding_px } = action;
      const spanX = bounds.maxX - bounds.minX;
      const spanY = bounds.maxY - bounds.minY;
      if (spanX <= 0 || spanY <= 0) return state;

      const availW = Math.max(1, viewport.width_px - 2 * padding_px);
      const availH = Math.max(1, viewport.height_px - 2 * padding_px);
      const scale = clampScale(Math.min(availW / spanX, availH / spanY));

      return {
        centerX_m: (bounds.minX + bounds.maxX) / 2,
        centerY_m: (bounds.minY + bounds.maxY) / 2,
        scale_px_per_m: scale,
        rotationDeg: state.rotationDeg,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Default view — used when no saved view exists for a level
// ---------------------------------------------------------------------------

export const DEFAULT_VIEW: ViewState = {
  centerX_m: 0,
  centerY_m: 0,
  scale_px_per_m: 50,
  rotationDeg: 0,
};
