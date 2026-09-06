import { describe, it, expect } from 'vitest';
import {
  selectionReducer,
  EMPTY_SELECTION,
  pointInRect,
} from '../selection.js';
import type { SelectableItem, SelectionState } from '../selection.js';

const items: SelectableItem[] = [
  { id: 'a', drawOrder: 0 },
  { id: 'b', drawOrder: 1 },
  { id: 'c', drawOrder: 2 },
  { id: 'd', drawOrder: 3 },
];

describe('E6 — selection model', () => {
  describe('select (single click)', () => {
    it('selects one item and sets it active', () => {
      const s = selectionReducer(EMPTY_SELECTION, { type: 'select', id: 'b' });
      expect(s.selectedIds).toStrictEqual(['b']);
      expect(s.activeId).toBe('b');
    });

    it('replaces previous selection', () => {
      const prev: SelectionState = { selectedIds: ['a', 'c'], activeId: 'a' };
      const s = selectionReducer(prev, { type: 'select', id: 'b' });
      expect(s.selectedIds).toStrictEqual(['b']);
    });
  });

  describe('toggle (ctrl+click)', () => {
    it('adds item to selection', () => {
      const prev: SelectionState = { selectedIds: ['a'], activeId: 'a' };
      const s = selectionReducer(prev, { type: 'toggle', id: 'b' });
      expect(s.selectedIds).toContain('a');
      expect(s.selectedIds).toContain('b');
      expect(s.activeId).toBe('b');
    });

    it('removes item from selection', () => {
      const prev: SelectionState = { selectedIds: ['a', 'b'], activeId: 'b' };
      const s = selectionReducer(prev, { type: 'toggle', id: 'b' });
      expect(s.selectedIds).toStrictEqual(['a']);
    });

    it('updates activeId when toggled-off item was active', () => {
      const prev: SelectionState = { selectedIds: ['a', 'b'], activeId: 'b' };
      const s = selectionReducer(prev, { type: 'toggle', id: 'b' });
      expect(s.activeId).toBe('a');
    });

    it('toggling off last item clears activeId', () => {
      const prev: SelectionState = { selectedIds: ['a'], activeId: 'a' };
      const s = selectionReducer(prev, { type: 'toggle', id: 'a' });
      expect(s.selectedIds).toStrictEqual([]);
      expect(s.activeId).toBeNull();
    });
  });

  describe('add (shift+click)', () => {
    it('adds to selection', () => {
      const prev: SelectionState = { selectedIds: ['a'], activeId: 'a' };
      const s = selectionReducer(prev, { type: 'add', id: 'c' });
      expect(s.selectedIds).toStrictEqual(['a', 'c']);
      expect(s.activeId).toBe('c');
    });

    it('does not duplicate already-selected item', () => {
      const prev: SelectionState = { selectedIds: ['a', 'b'], activeId: 'a' };
      const s = selectionReducer(prev, { type: 'add', id: 'b' });
      expect(s.selectedIds).toStrictEqual(['a', 'b']);
      expect(s.activeId).toBe('b');
    });
  });

  describe('select_rect (marquee)', () => {
    it('selects multiple items', () => {
      const s = selectionReducer(EMPTY_SELECTION, {
        type: 'select_rect', ids: ['b', 'c'],
      });
      expect(s.selectedIds).toStrictEqual(['b', 'c']);
      expect(s.activeId).toBe('b');
    });

    it('empty marquee clears selection', () => {
      const prev: SelectionState = { selectedIds: ['a'], activeId: 'a' };
      const s = selectionReducer(prev, { type: 'select_rect', ids: [] });
      expect(s).toStrictEqual(EMPTY_SELECTION);
    });
  });

  describe('select_all', () => {
    it('selects all provided ids', () => {
      const s = selectionReducer(EMPTY_SELECTION, {
        type: 'select_all', ids: ['a', 'b', 'c', 'd'],
      });
      expect(s.selectedIds).toStrictEqual(['a', 'b', 'c', 'd']);
      expect(s.activeId).toBe('a');
    });
  });

  describe('clear', () => {
    it('empties selection', () => {
      const prev: SelectionState = { selectedIds: ['a', 'b'], activeId: 'b' };
      const s = selectionReducer(prev, { type: 'clear' });
      expect(s).toStrictEqual(EMPTY_SELECTION);
    });
  });

  describe('navigate (E6.2 — keyboard tab)', () => {
    it('next from no selection selects first item', () => {
      const s = selectionReducer(EMPTY_SELECTION, {
        type: 'navigate', direction: 'next', items,
      });
      expect(s.selectedIds).toStrictEqual(['a']);
      expect(s.activeId).toBe('a');
    });

    it('next moves to next item in draw order', () => {
      const prev: SelectionState = { selectedIds: ['b'], activeId: 'b' };
      const s = selectionReducer(prev, {
        type: 'navigate', direction: 'next', items,
      });
      expect(s.activeId).toBe('c');
    });

    it('next wraps around from last to first', () => {
      const prev: SelectionState = { selectedIds: ['d'], activeId: 'd' };
      const s = selectionReducer(prev, {
        type: 'navigate', direction: 'next', items,
      });
      expect(s.activeId).toBe('a');
    });

    it('prev moves to previous item', () => {
      const prev: SelectionState = { selectedIds: ['c'], activeId: 'c' };
      const s = selectionReducer(prev, {
        type: 'navigate', direction: 'prev', items,
      });
      expect(s.activeId).toBe('b');
    });

    it('prev wraps around from first to last', () => {
      const prev: SelectionState = { selectedIds: ['a'], activeId: 'a' };
      const s = selectionReducer(prev, {
        type: 'navigate', direction: 'prev', items,
      });
      expect(s.activeId).toBe('d');
    });

    it('order is deterministic: same drawOrder sorted by id', () => {
      const sameOrder: SelectableItem[] = [
        { id: 'beta', drawOrder: 0 },
        { id: 'alpha', drawOrder: 0 },
        { id: 'gamma', drawOrder: 0 },
      ];
      const s = selectionReducer(EMPTY_SELECTION, {
        type: 'navigate', direction: 'next', items: sameOrder,
      });
      // First in deterministic order: alpha (by id)
      expect(s.activeId).toBe('alpha');
    });

    it('empty items list returns unchanged state', () => {
      const s = selectionReducer(EMPTY_SELECTION, {
        type: 'navigate', direction: 'next', items: [],
      });
      expect(s).toStrictEqual(EMPTY_SELECTION);
    });
  });

  describe('selection is never persisted (E6.1)', () => {
    it('EMPTY_SELECTION is the canonical empty state', () => {
      expect(EMPTY_SELECTION.selectedIds).toStrictEqual([]);
      expect(EMPTY_SELECTION.activeId).toBeNull();
    });
  });

  describe('INV-4 determinism', () => {
    it('same actions produce same selection', () => {
      const run = (): SelectionState => {
        let s = EMPTY_SELECTION;
        s = selectionReducer(s, { type: 'select', id: 'b' });
        s = selectionReducer(s, { type: 'toggle', id: 'c' });
        s = selectionReducer(s, { type: 'add', id: 'a' });
        s = selectionReducer(s, { type: 'navigate', direction: 'next', items });
        return s;
      };
      expect(run()).toStrictEqual(run());
    });
  });

  describe('pointInRect', () => {
    const rect = { minX: 0, minY: 0, maxX: 10, maxY: 10 };

    it('inside', () => {
      expect(pointInRect({ x_m: 5, y_m: 5 }, rect)).toBe(true);
    });

    it('outside', () => {
      expect(pointInRect({ x_m: 15, y_m: 5 }, rect)).toBe(false);
    });

    it('on edge is inside', () => {
      expect(pointInRect({ x_m: 0, y_m: 0 }, rect)).toBe(true);
      expect(pointInRect({ x_m: 10, y_m: 10 }, rect)).toBe(true);
    });
  });
});
