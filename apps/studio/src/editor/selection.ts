/**
 * E6.1 — Selection model.
 *
 * Selection is UI-only state, never persisted.
 * Order is stable and deterministic: draw order, then by id.
 *
 * This module handles selection logic. The reducer is pure and
 * does not touch the undo stack (E5.2).
 */

import type { Point } from '@azimut/core-model';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A selectable object in the scene. */
export type SelectableItem = {
  readonly id: string;
  /** Draw order — lower values are drawn first (back). */
  readonly drawOrder: number;
};

/** Immutable selection state. */
export type SelectionState = {
  /** Selected ids, in deterministic order. */
  readonly selectedIds: readonly string[];
  /** Active (focused) id within the selection, for keyboard nav. */
  readonly activeId: string | null;
};

export const EMPTY_SELECTION: SelectionState = {
  selectedIds: [],
  activeId: null,
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type SelectionAction =
  | { readonly type: 'select'; readonly id: string }
  | { readonly type: 'toggle'; readonly id: string }
  | { readonly type: 'add'; readonly id: string }
  | { readonly type: 'select_rect'; readonly ids: readonly string[] }
  | { readonly type: 'select_all'; readonly ids: readonly string[] }
  | { readonly type: 'clear' }
  | { readonly type: 'navigate'; readonly direction: 'next' | 'prev'; readonly items: readonly SelectableItem[] };

// ---------------------------------------------------------------------------
// Deterministic ordering (E6.1)
// ---------------------------------------------------------------------------

/**
 * Sort ids by draw order then by id, using the item list as reference.
 * Items not found in the list are sorted to the end by id.
 */
function sortIds(
  ids: readonly string[],
  items: readonly SelectableItem[],
): readonly string[] {
  const map = new Map(items.map((item) => [item.id, item]));
  return [...ids].sort((a, b) => {
    const ia = map.get(a);
    const ib = map.get(b);
    if (ia && ib) {
      const orderCmp = ia.drawOrder - ib.drawOrder;
      if (orderCmp !== 0) return orderCmp;
    }
    return a.localeCompare(b);
  });
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function selectionReducer(
  state: SelectionState,
  action: SelectionAction,
): SelectionState {
  switch (action.type) {
    case 'select': {
      return {
        selectedIds: [action.id],
        activeId: action.id,
      };
    }

    case 'toggle': {
      const isSelected = state.selectedIds.includes(action.id);
      if (isSelected) {
        const filtered = state.selectedIds.filter((id) => id !== action.id);
        return {
          selectedIds: filtered,
          activeId: state.activeId === action.id
            ? (filtered[filtered.length - 1] ?? null)
            : state.activeId,
        };
      }
      return {
        selectedIds: [...state.selectedIds, action.id],
        activeId: action.id,
      };
    }

    case 'add': {
      if (state.selectedIds.includes(action.id)) {
        return { ...state, activeId: action.id };
      }
      return {
        selectedIds: [...state.selectedIds, action.id],
        activeId: action.id,
      };
    }

    case 'select_rect': {
      if (action.ids.length === 0) return EMPTY_SELECTION;
      return {
        selectedIds: action.ids,
        activeId: action.ids[0] ?? null,
      };
    }

    case 'select_all': {
      if (action.ids.length === 0) return EMPTY_SELECTION;
      return {
        selectedIds: action.ids,
        activeId: action.ids[0] ?? null,
      };
    }

    case 'clear': {
      return EMPTY_SELECTION;
    }

    case 'navigate': {
      const sorted = sortIds(
        action.items.map((i) => i.id),
        action.items,
      );
      if (sorted.length === 0) return state;

      const currentIdx = state.activeId
        ? sorted.indexOf(state.activeId)
        : -1;

      let nextIdx: number;
      if (action.direction === 'next') {
        nextIdx = currentIdx < sorted.length - 1 ? currentIdx + 1 : 0;
      } else {
        nextIdx = currentIdx > 0 ? currentIdx - 1 : sorted.length - 1;
      }

      const nextId = sorted[nextIdx];
      if (nextId === undefined) return state;

      return {
        selectedIds: [nextId],
        activeId: nextId,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Hit-test helpers (E3.4 — native SVG hit-testing)
// ---------------------------------------------------------------------------

/**
 * Check if a point is inside a rectangle (for marquee selection).
 * Both point and rect are in the same coordinate space.
 */
export function pointInRect(
  point: Point,
  rect: { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number },
): boolean {
  return (
    point.x_m >= rect.minX &&
    point.x_m <= rect.maxX &&
    point.y_m >= rect.minY &&
    point.y_m <= rect.maxY
  );
}
