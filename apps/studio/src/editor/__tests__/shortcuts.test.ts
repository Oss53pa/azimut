import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SHORTCUTS,
  detectConflicts,
  detectBrowserConflicts,
  detectDestructiveWithoutModifier,
  matchShortcut,
} from '../shortcuts.js';
import type { ShortcutDef } from '../shortcuts.js';

describe('E16 — keyboard shortcuts', () => {
  describe('default table', () => {
    it('has no internal conflicts', () => {
      const conflicts = detectConflicts(DEFAULT_SHORTCUTS);
      expect(conflicts).toStrictEqual([]);
    });

    it('has no browser-reserved conflicts', () => {
      const conflicts = detectBrowserConflicts(DEFAULT_SHORTCUTS);
      expect(conflicts).toStrictEqual([]);
    });

    it('has no single-key destructive shortcuts without modifier', () => {
      const bad = detectDestructiveWithoutModifier(DEFAULT_SHORTCUTS);
      expect(bad).toStrictEqual([]);
    });
  });

  describe('detectConflicts', () => {
    it('detects duplicate key bindings', () => {
      const mod = { ctrl: false, shift: false, alt: false, meta: false };
      const dups: ShortcutDef[] = [
        { action: 'foo', label: 'Foo', key: 'a', modifiers: mod, category: 'tool', destructive: false },
        { action: 'bar', label: 'Bar', key: 'a', modifiers: mod, category: 'tool', destructive: false },
      ];
      const conflicts = detectConflicts(dups);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]?.a.action).toBe('foo');
      expect(conflicts[0]?.b.action).toBe('bar');
    });

    it('same key with different modifiers is not a conflict', () => {
      const defs: ShortcutDef[] = [
        { action: 'foo', label: 'Foo', key: 'z', modifiers: { ctrl: true, shift: false, alt: false, meta: false }, category: 'edit', destructive: false },
        { action: 'bar', label: 'Bar', key: 'z', modifiers: { ctrl: true, shift: true, alt: false, meta: false }, category: 'edit', destructive: false },
      ];
      expect(detectConflicts(defs)).toStrictEqual([]);
    });
  });

  describe('detectBrowserConflicts', () => {
    it('flags ctrl+t as browser-reserved', () => {
      const mod = { ctrl: true, shift: false, alt: false, meta: false };
      const defs: ShortcutDef[] = [
        { action: 'test', label: 'Test', key: 't', modifiers: mod, category: 'tool', destructive: false },
      ];
      const conflicts = detectBrowserConflicts(defs);
      expect(conflicts).toHaveLength(1);
    });
  });

  describe('detectDestructiveWithoutModifier', () => {
    it('flags single-key destructive shortcuts', () => {
      const mod = { ctrl: false, shift: false, alt: false, meta: false };
      const defs: ShortcutDef[] = [
        { action: 'nuke', label: 'Nuke', key: 'x', modifiers: mod, category: 'edit', destructive: true },
      ];
      expect(detectDestructiveWithoutModifier(defs)).toHaveLength(1);
    });

    it('exempts Delete key (universally expected)', () => {
      const mod = { ctrl: false, shift: false, alt: false, meta: false };
      const defs: ShortcutDef[] = [
        { action: 'delete', label: 'Delete', key: 'Delete', modifiers: mod, category: 'edit', destructive: true },
      ];
      expect(detectDestructiveWithoutModifier(defs)).toStrictEqual([]);
    });

    it('accepts destructive with modifier', () => {
      const mod = { ctrl: true, shift: false, alt: false, meta: false };
      const defs: ShortcutDef[] = [
        { action: 'cut', label: 'Cut', key: 'x', modifiers: mod, category: 'edit', destructive: true },
      ];
      expect(detectDestructiveWithoutModifier(defs)).toStrictEqual([]);
    });
  });

  describe('matchShortcut', () => {
    it('matches a simple key', () => {
      const event = { key: 'v', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false };
      expect(matchShortcut(event, DEFAULT_SHORTCUTS)).toBe('tool_select');
    });

    it('matches ctrl+z', () => {
      const event = { key: 'z', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false };
      expect(matchShortcut(event, DEFAULT_SHORTCUTS)).toBe('undo');
    });

    it('matches ctrl+shift+z', () => {
      const event = { key: 'z', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false };
      expect(matchShortcut(event, DEFAULT_SHORTCUTS)).toBe('redo');
    });

    it('returns null for unmatched key', () => {
      const event = { key: 'q', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false };
      expect(matchShortcut(event, DEFAULT_SHORTCUTS)).toBeNull();
    });

    it('is case-insensitive', () => {
      const event = { key: 'V', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false };
      expect(matchShortcut(event, DEFAULT_SHORTCUTS)).toBe('tool_select');
    });

    it('wrong modifier returns null', () => {
      const event = { key: 'z', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false };
      expect(matchShortcut(event, DEFAULT_SHORTCUTS)).toBeNull();
    });
  });

  describe('shortcut table structure', () => {
    it('every shortcut has a non-empty action', () => {
      for (const def of DEFAULT_SHORTCUTS) {
        expect(def.action.length).toBeGreaterThan(0);
      }
    });

    it('every shortcut has a non-empty label', () => {
      for (const def of DEFAULT_SHORTCUTS) {
        expect(def.label.length).toBeGreaterThan(0);
      }
    });

    it('actions are unique', () => {
      const actions = DEFAULT_SHORTCUTS.map((d) => d.action);
      expect(new Set(actions).size).toBe(actions.length);
    });
  });
});
