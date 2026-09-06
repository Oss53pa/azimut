/**
 * Tests for the central shortcut dispatcher.
 *
 * Tests matchShortcut (from shortcuts.ts) integration with the
 * TOOL_ACTION_MAP and handler dispatch logic.
 */

import { describe, it, expect } from 'vitest';
import { matchShortcut, DEFAULT_SHORTCUTS } from '../shortcuts.js';

// We test the pure-function matching from shortcuts.ts, which
// is what use-shortcuts.ts uses internally.

describe('E16 — shortcut matching', () => {
  function event(key: string, opts: {
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
    metaKey?: boolean;
  } = {}) {
    return {
      key,
      ctrlKey: opts.ctrlKey ?? false,
      shiftKey: opts.shiftKey ?? false,
      altKey: opts.altKey ?? false,
      metaKey: opts.metaKey ?? false,
    };
  }

  describe('edit shortcuts', () => {
    it('Ctrl+Z matches undo', () => {
      expect(matchShortcut(event('z', { ctrlKey: true }), DEFAULT_SHORTCUTS)).toBe('undo');
    });

    it('Ctrl+Shift+Z matches redo', () => {
      expect(matchShortcut(event('z', { ctrlKey: true, shiftKey: true }), DEFAULT_SHORTCUTS)).toBe('redo');
    });

    it('Ctrl+C matches copy', () => {
      expect(matchShortcut(event('c', { ctrlKey: true }), DEFAULT_SHORTCUTS)).toBe('copy');
    });

    it('Ctrl+V matches paste', () => {
      expect(matchShortcut(event('v', { ctrlKey: true }), DEFAULT_SHORTCUTS)).toBe('paste');
    });

    it('Ctrl+X matches cut', () => {
      expect(matchShortcut(event('x', { ctrlKey: true }), DEFAULT_SHORTCUTS)).toBe('cut');
    });

    it('Delete matches delete', () => {
      expect(matchShortcut(event('Delete'), DEFAULT_SHORTCUTS)).toBe('delete');
    });
  });

  describe('selection shortcuts', () => {
    it('Ctrl+A matches select_all', () => {
      expect(matchShortcut(event('a', { ctrlKey: true }), DEFAULT_SHORTCUTS)).toBe('select_all');
    });

    it('Escape matches deselect', () => {
      expect(matchShortcut(event('Escape'), DEFAULT_SHORTCUTS)).toBe('deselect');
    });

    it('Tab matches nav_next', () => {
      expect(matchShortcut(event('Tab'), DEFAULT_SHORTCUTS)).toBe('nav_next');
    });

    it('Shift+Tab matches nav_prev', () => {
      expect(matchShortcut(event('Tab', { shiftKey: true }), DEFAULT_SHORTCUTS)).toBe('nav_prev');
    });
  });

  describe('view shortcuts', () => {
    it('= matches zoom_in', () => {
      expect(matchShortcut(event('='), DEFAULT_SHORTCUTS)).toBe('zoom_in');
    });

    it('- matches zoom_out', () => {
      expect(matchShortcut(event('-'), DEFAULT_SHORTCUTS)).toBe('zoom_out');
    });

    it('Ctrl+0 matches zoom_fit', () => {
      expect(matchShortcut(event('0', { ctrlKey: true }), DEFAULT_SHORTCUTS)).toBe('zoom_fit');
    });
  });

  describe('tool shortcuts', () => {
    it('V (no mod) matches tool_select', () => {
      expect(matchShortcut(event('v'), DEFAULT_SHORTCUTS)).toBe('tool_select');
    });

    it('H matches tool_hand', () => {
      expect(matchShortcut(event('h'), DEFAULT_SHORTCUTS)).toBe('tool_hand');
    });

    it('R matches tool_rect', () => {
      expect(matchShortcut(event('r'), DEFAULT_SHORTCUTS)).toBe('tool_rect');
    });

    it('E matches tool_ellipse', () => {
      expect(matchShortcut(event('e'), DEFAULT_SHORTCUTS)).toBe('tool_ellipse');
    });

    it('P matches tool_poly', () => {
      expect(matchShortcut(event('p'), DEFAULT_SHORTCUTS)).toBe('tool_poly');
    });

    it('L matches tool_line', () => {
      expect(matchShortcut(event('l'), DEFAULT_SHORTCUTS)).toBe('tool_line');
    });

    it('B matches tool_pen', () => {
      expect(matchShortcut(event('b'), DEFAULT_SHORTCUTS)).toBe('tool_pen');
    });

    it('T matches tool_text', () => {
      expect(matchShortcut(event('t'), DEFAULT_SHORTCUTS)).toBe('tool_text');
    });

    it('N matches tool_node', () => {
      expect(matchShortcut(event('n'), DEFAULT_SHORTCUTS)).toBe('tool_node');
    });

    it('M matches tool_measure', () => {
      expect(matchShortcut(event('m'), DEFAULT_SHORTCUTS)).toBe('tool_measure');
    });
  });

  describe('help shortcuts', () => {
    it('Shift+? matches show_help', () => {
      expect(matchShortcut(event('?', { shiftKey: true }), DEFAULT_SHORTCUTS)).toBe('show_help');
    });
  });

  describe('no match', () => {
    it('unregistered key returns null', () => {
      expect(matchShortcut(event('q'), DEFAULT_SHORTCUTS)).toBeNull();
    });

    it('wrong modifier returns null', () => {
      // z without Ctrl should not match undo
      expect(matchShortcut(event('z'), DEFAULT_SHORTCUTS)).toBeNull();
    });
  });
});
