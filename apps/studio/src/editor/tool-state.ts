/**
 * E7.1 — Tool state machine.
 *
 * Every editing gesture flows through a tool. A tool has three phases:
 *   idle → drawing/dragging → committed/cancelled
 *
 * The tool state machine:
 *   - Tracks the current tool.
 *   - Tracks the current tool phase (idle, active, done).
 *   - Dispatches pointer/keyboard events to the active tool handler.
 *   - Ensures only one tool is active at a time.
 *
 * No library: the state machine is a pure reducer (A3.3).
 */

import type { Point } from '@azimut/core-model';

// ---------------------------------------------------------------------------
// Tool identifiers (E7.1)
// ---------------------------------------------------------------------------

export type ToolId =
  | 'select'
  | 'direct_select'
  | 'hand'
  | 'zoom_tool'
  | 'rectangle'
  | 'ellipse'
  | 'regular_polygon'
  | 'polyline'
  | 'bezier'
  | 'text'
  | 'dimension'
  | 'measure';

// ---------------------------------------------------------------------------
// Tool phase
// ---------------------------------------------------------------------------

export type ToolPhase = 'idle' | 'active' | 'done';

// ---------------------------------------------------------------------------
// Pointer data — passed to tool handlers
// ---------------------------------------------------------------------------

export type PointerData = {
  /** Position in meter-space. */
  readonly position_m: Point;
  /** Position in screen pixels. */
  readonly screenX: number;
  readonly screenY: number;
  /** Modifier keys held during the event. */
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
};

// ---------------------------------------------------------------------------
// Gesture events
// ---------------------------------------------------------------------------

export type GestureEvent =
  | { readonly type: 'pointer_down'; readonly data: PointerData }
  | { readonly type: 'pointer_move'; readonly data: PointerData }
  | { readonly type: 'pointer_up'; readonly data: PointerData }
  | { readonly type: 'cancel' }
  | { readonly type: 'commit' };

// ---------------------------------------------------------------------------
// Tool geometry — what a tool is building
// ---------------------------------------------------------------------------

/**
 * Intermediate geometry while tool is active.
 * Each tool type produces a different preview shape.
 */
export type ToolPreview =
  | { readonly kind: 'none' }
  | { readonly kind: 'rect'; readonly origin: Point; readonly corner: Point }
  | { readonly kind: 'ellipse'; readonly center: Point; readonly rx_m: number; readonly ry_m: number }
  | { readonly kind: 'polygon'; readonly center: Point; readonly radius_m: number; readonly sides: number; readonly rotation_deg: number }
  | { readonly kind: 'polyline'; readonly points: readonly Point[] }
  | { readonly kind: 'bezier'; readonly points: readonly Point[]; readonly controlPoints: readonly Point[] }
  | { readonly kind: 'measure'; readonly from: Point; readonly to: Point }
  | { readonly kind: 'dimension'; readonly from: Point; readonly to: Point; readonly offset_m: number };

// ---------------------------------------------------------------------------
// Tool state
// ---------------------------------------------------------------------------

export type ToolState = {
  readonly currentTool: ToolId;
  readonly phase: ToolPhase;
  readonly preview: ToolPreview;
  /** For regular polygon: number of sides. */
  readonly polygonSides: number;
  /** Polyline/Bézier accumulated points. */
  readonly accumulatedPoints: readonly Point[];
};

export const DEFAULT_TOOL_STATE: ToolState = {
  currentTool: 'select',
  phase: 'idle',
  preview: { kind: 'none' },
  polygonSides: 6,
  accumulatedPoints: [],
};

// ---------------------------------------------------------------------------
// Tool actions
// ---------------------------------------------------------------------------

export type ToolAction =
  | { readonly type: 'set_tool'; readonly tool: ToolId }
  | { readonly type: 'set_polygon_sides'; readonly sides: number }
  | { readonly type: 'gesture'; readonly event: GestureEvent };

// ---------------------------------------------------------------------------
// Shape-building helpers
// ---------------------------------------------------------------------------

function buildRectPreview(origin: Point, corner: Point, shift: boolean): ToolPreview {
  if (shift) {
    // Square constraint: use the larger dimension
    const dx = corner.x_m - origin.x_m;
    const dy = corner.y_m - origin.y_m;
    const size = Math.max(Math.abs(dx), Math.abs(dy));
    return {
      kind: 'rect',
      origin,
      corner: {
        x_m: origin.x_m + Math.sign(dx) * size,
        y_m: origin.y_m + Math.sign(dy) * size,
      },
    };
  }
  return { kind: 'rect', origin, corner };
}

function buildEllipsePreview(origin: Point, cursor: Point, shift: boolean): ToolPreview {
  const dx = cursor.x_m - origin.x_m;
  const dy = cursor.y_m - origin.y_m;
  if (shift) {
    const r = Math.max(Math.abs(dx), Math.abs(dy));
    return { kind: 'ellipse', center: origin, rx_m: r, ry_m: r };
  }
  return { kind: 'ellipse', center: origin, rx_m: Math.abs(dx), ry_m: Math.abs(dy) };
}

function buildPolygonPreview(
  center: Point, cursor: Point, sides: number,
): ToolPreview {
  const dx = cursor.x_m - center.x_m;
  const dy = cursor.y_m - center.y_m;
  const radius = Math.sqrt(dx * dx + dy * dy);
  const rotation = (Math.atan2(dy, dx) * 180) / Math.PI;
  return { kind: 'polygon', center, radius_m: radius, sides, rotation_deg: rotation };
}

// ---------------------------------------------------------------------------
// Reducer — shape drawing tools
// ---------------------------------------------------------------------------

function handleShapeGesture(
  state: ToolState,
  event: GestureEvent,
  originRef: { origin: Point | null },
): ToolState {
  switch (event.type) {
    case 'pointer_down': {
      originRef.origin = event.data.position_m;
      return { ...state, phase: 'active', preview: { kind: 'none' } };
    }
    case 'pointer_move': {
      if (state.phase !== 'active' || originRef.origin === null) return state;
      const origin = originRef.origin;
      const cursor = event.data.position_m;

      let preview: ToolPreview;
      switch (state.currentTool) {
        case 'rectangle':
          preview = buildRectPreview(origin, cursor, event.data.shiftKey);
          break;
        case 'ellipse':
          preview = buildEllipsePreview(origin, cursor, event.data.shiftKey);
          break;
        case 'regular_polygon':
          preview = buildPolygonPreview(origin, cursor, state.polygonSides);
          break;
        default:
          preview = { kind: 'none' };
      }
      return { ...state, preview };
    }
    case 'pointer_up': {
      if (state.phase !== 'active') return state;
      originRef.origin = null;
      return { ...state, phase: 'done' };
    }
    case 'cancel': {
      originRef.origin = null;
      return { ...state, phase: 'idle', preview: { kind: 'none' } };
    }
    case 'commit': {
      originRef.origin = null;
      return { ...state, phase: 'idle', preview: { kind: 'none' } };
    }
  }
}

// ---------------------------------------------------------------------------
// Reducer — polyline/Bézier
// ---------------------------------------------------------------------------

function handlePolylineGesture(
  state: ToolState,
  event: GestureEvent,
): ToolState {
  switch (event.type) {
    case 'pointer_down': {
      const pts = [...state.accumulatedPoints, event.data.position_m];
      return {
        ...state,
        phase: 'active',
        accumulatedPoints: pts,
        preview: { kind: 'polyline', points: pts },
      };
    }
    case 'pointer_move': {
      if (state.accumulatedPoints.length === 0) return state;
      // Show rubber-band from last point to cursor
      const allPts = [...state.accumulatedPoints, event.data.position_m];
      return { ...state, preview: { kind: 'polyline', points: allPts } };
    }
    case 'commit': {
      // Double-click or Enter: finish polyline
      return { ...state, phase: 'done' };
    }
    case 'cancel': {
      return { ...state, phase: 'idle', preview: { kind: 'none' }, accumulatedPoints: [] };
    }
    case 'pointer_up':
      return state;
  }
}

// ---------------------------------------------------------------------------
// Reducer — measure/dimension
// ---------------------------------------------------------------------------

function handleMeasureGesture(
  state: ToolState,
  event: GestureEvent,
  originRef: { origin: Point | null },
): ToolState {
  const previewKind = state.currentTool === 'measure' ? 'measure' : 'dimension';

  switch (event.type) {
    case 'pointer_down': {
      originRef.origin = event.data.position_m;
      return { ...state, phase: 'active', preview: { kind: 'none' } };
    }
    case 'pointer_move': {
      if (state.phase !== 'active' || originRef.origin === null) return state;
      const from = originRef.origin;
      const to = event.data.position_m;
      const preview: ToolPreview = previewKind === 'measure'
        ? { kind: 'measure', from, to }
        : { kind: 'dimension', from, to, offset_m: 0 };
      return { ...state, preview };
    }
    case 'pointer_up': {
      if (state.phase !== 'active') return state;
      originRef.origin = null;
      return { ...state, phase: 'done' };
    }
    case 'cancel': {
      originRef.origin = null;
      return { ...state, phase: 'idle', preview: { kind: 'none' } };
    }
    case 'commit': {
      originRef.origin = null;
      return { ...state, phase: 'idle', preview: { kind: 'none' } };
    }
  }
}

// ---------------------------------------------------------------------------
// Public: createToolReducer
// ---------------------------------------------------------------------------

/**
 * Create a tool reducer with closure-captured origin.
 *
 * Returns a pure-ish reducer: the origin is mutable but internal.
 * This is needed because pointer_down sets the origin before
 * pointer_move uses it, across separate dispatch calls.
 */
export function createToolReducer(): (
  state: ToolState,
  action: ToolAction,
) => ToolState {
  const originRef = { origin: null as Point | null };

  return function toolReducer(state: ToolState, action: ToolAction): ToolState {
    switch (action.type) {
      case 'set_tool': {
        // Cancel any in-progress gesture
        originRef.origin = null;
        return {
          ...state,
          currentTool: action.tool,
          phase: 'idle',
          preview: { kind: 'none' },
          accumulatedPoints: [],
        };
      }
      case 'set_polygon_sides': {
        const sides = Math.max(3, Math.min(64, Math.round(action.sides)));
        return { ...state, polygonSides: sides };
      }
      case 'gesture': {
        switch (state.currentTool) {
          case 'rectangle':
          case 'ellipse':
          case 'regular_polygon':
            return handleShapeGesture(state, action.event, originRef);
          case 'polyline':
          case 'bezier':
            return handlePolylineGesture(state, action.event);
          case 'measure':
          case 'dimension':
            return handleMeasureGesture(state, action.event, originRef);
          case 'select':
          case 'direct_select':
          case 'hand':
          case 'zoom_tool':
          case 'text':
            // These tools are handled elsewhere (viewport, selection)
            return state;
        }
      }
    }
  };
}

/**
 * Tool metadata for UI display.
 */
export type ToolMeta = {
  readonly id: ToolId;
  readonly label: string;
  readonly shortcutKey: string | null;
  readonly group: 'navigation' | 'selection' | 'shape' | 'path' | 'annotation';
};

export const TOOL_REGISTRY: readonly ToolMeta[] = [
  { id: 'select',          label: 'Sélection',           shortcutKey: 'v', group: 'selection' },
  { id: 'direct_select',   label: 'Sélection directe',   shortcutKey: 'a', group: 'selection' },
  { id: 'hand',            label: 'Main',                 shortcutKey: 'h', group: 'navigation' },
  { id: 'zoom_tool',       label: 'Zoom',                 shortcutKey: 'z', group: 'navigation' },
  { id: 'rectangle',       label: 'Rectangle',            shortcutKey: 'r', group: 'shape' },
  { id: 'ellipse',         label: 'Ellipse',              shortcutKey: 'e', group: 'shape' },
  { id: 'regular_polygon', label: 'Polygone régulier',    shortcutKey: null, group: 'shape' },
  { id: 'polyline',        label: 'Polyligne',            shortcutKey: 'p', group: 'path' },
  { id: 'bezier',          label: 'Courbe de Bézier',     shortcutKey: null, group: 'path' },
  { id: 'text',            label: 'Texte',                shortcutKey: 't', group: 'annotation' },
  { id: 'dimension',       label: 'Cotation',             shortcutKey: null, group: 'annotation' },
  { id: 'measure',         label: 'Mesure',               shortcutKey: null, group: 'annotation' },
];
