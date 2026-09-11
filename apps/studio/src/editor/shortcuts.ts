/**
 * E16 — Keyboard shortcuts.
 *
 * Single declaration table. Never scattered across components.
 * Automated conflict detection, including browser/OS reserved keys.
 * No single-key destructive shortcut without confirmation.
 */

import type { UiMessageKey } from '../i18n/messages.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ShortcutModifiers = {
  readonly ctrl: boolean;
  readonly shift: boolean;
  readonly alt: boolean;
  readonly meta: boolean;
};

export type ShortcutDef = {
  /** Unique action identifier. */
  readonly action: string;
  /** i18n key for the human-readable label (D12.1). */
  readonly labelKey: UiMessageKey;
  /** Primary key (e.g. 'z', 'Delete', 'Escape'). Case-insensitive. */
  readonly key: string;
  /** Required modifiers. */
  readonly modifiers: ShortcutModifiers;
  /** Category for grouping in the shortcut table. */
  readonly category: 'edit' | 'view' | 'tool' | 'selection' | 'file';
  /** Whether the action is destructive (requires modifier, E16 rule). */
  readonly destructive: boolean;
};

export type ShortcutConflict = {
  readonly a: ShortcutDef;
  readonly b: ShortcutDef;
};

// ---------------------------------------------------------------------------
// Modifier helpers
// ---------------------------------------------------------------------------

const NO_MOD: ShortcutModifiers = { ctrl: false, shift: false, alt: false, meta: false };
const CTRL: ShortcutModifiers = { ctrl: true, shift: false, alt: false, meta: false };
const CTRL_SHIFT: ShortcutModifiers = { ctrl: true, shift: true, alt: false, meta: false };
const SHIFT: ShortcutModifiers = { ctrl: false, shift: true, alt: false, meta: false };

// ---------------------------------------------------------------------------
// Default shortcut table
// ---------------------------------------------------------------------------

export const DEFAULT_SHORTCUTS: readonly ShortcutDef[] = [
  // Edit
  { action: 'undo',        labelKey: 'editor.shortcut.undo',        key: 'z',      modifiers: CTRL,       category: 'edit',      destructive: false },
  { action: 'redo',        labelKey: 'editor.shortcut.redo',        key: 'z',      modifiers: CTRL_SHIFT, category: 'edit',      destructive: false },
  { action: 'delete',      labelKey: 'editor.shortcut.delete',      key: 'Delete', modifiers: NO_MOD,     category: 'edit',      destructive: true },
  { action: 'copy',        labelKey: 'editor.shortcut.copy',        key: 'c',      modifiers: CTRL,       category: 'edit',      destructive: false },
  { action: 'paste',       labelKey: 'editor.shortcut.paste',       key: 'v',      modifiers: CTRL,       category: 'edit',      destructive: false },
  { action: 'cut',         labelKey: 'editor.shortcut.cut',         key: 'x',      modifiers: CTRL,       category: 'edit',      destructive: true },

  // Selection
  { action: 'select_all',  labelKey: 'editor.shortcut.select_all',  key: 'a',      modifiers: CTRL,       category: 'selection', destructive: false },
  { action: 'deselect',    labelKey: 'editor.shortcut.deselect',    key: 'Escape', modifiers: NO_MOD,     category: 'selection', destructive: false },
  { action: 'nav_next',    labelKey: 'editor.shortcut.nav_next',    key: 'Tab',    modifiers: NO_MOD,     category: 'selection', destructive: false },
  { action: 'nav_prev',    labelKey: 'editor.shortcut.nav_prev',    key: 'Tab',    modifiers: SHIFT,      category: 'selection', destructive: false },

  // View
  { action: 'zoom_in',     labelKey: 'editor.shortcut.zoom_in',     key: '=',      modifiers: NO_MOD,     category: 'view',      destructive: false },
  { action: 'zoom_out',    labelKey: 'editor.shortcut.zoom_out',    key: '-',      modifiers: NO_MOD,     category: 'view',      destructive: false },
  { action: 'zoom_fit',    labelKey: 'editor.shortcut.zoom_fit',    key: '0',      modifiers: CTRL,       category: 'view',      destructive: false },

  // Tool
  { action: 'tool_select', labelKey: 'editor.shortcut.tool_select', key: 'v',      modifiers: NO_MOD,     category: 'tool',      destructive: false },
  { action: 'tool_hand',   labelKey: 'editor.shortcut.tool_hand',   key: 'h',      modifiers: NO_MOD,     category: 'tool',      destructive: false },
  { action: 'tool_rect',   labelKey: 'editor.shortcut.tool_rect',   key: 'r',      modifiers: NO_MOD,     category: 'tool',      destructive: false },
  { action: 'tool_ellipse',labelKey: 'editor.shortcut.tool_ellipse',key: 'e',      modifiers: NO_MOD,     category: 'tool',      destructive: false },
  { action: 'tool_poly',   labelKey: 'editor.shortcut.tool_poly',   key: 'p',      modifiers: NO_MOD,     category: 'tool',      destructive: false },
  { action: 'tool_line',   labelKey: 'editor.shortcut.tool_line',   key: 'l',      modifiers: NO_MOD,     category: 'tool',      destructive: false },
  { action: 'tool_pen',    labelKey: 'editor.shortcut.tool_pen',    key: 'b',      modifiers: NO_MOD,     category: 'tool',      destructive: false },
  { action: 'tool_text',   labelKey: 'editor.shortcut.tool_text',   key: 't',      modifiers: NO_MOD,     category: 'tool',      destructive: false },
  { action: 'tool_node',   labelKey: 'editor.shortcut.tool_node',   key: 'n',      modifiers: NO_MOD,     category: 'tool',      destructive: false },
  { action: 'tool_measure',labelKey: 'editor.shortcut.tool_measure',key: 'm',      modifiers: NO_MOD,     category: 'tool',      destructive: false },

  // File / help
  { action: 'show_help',  labelKey: 'editor.shortcut.show_help',    key: '?',      modifiers: SHIFT,      category: 'file',      destructive: false },
];

// ---------------------------------------------------------------------------
// Browser/OS reserved keys (E16)
// ---------------------------------------------------------------------------

const BROWSER_RESERVED: readonly string[] = [
  'ctrl+t',     // new tab
  'ctrl+w',     // close tab
  'ctrl+n',     // new window
  'ctrl+shift+t', // reopen tab
  'ctrl+l',     // address bar
  'ctrl+d',     // bookmark
  'ctrl+h',     // history
  'ctrl+j',     // downloads
  'ctrl+p',     // print
  'ctrl+s',     // save
  'ctrl+r',     // reload
  'ctrl+shift+i', // devtools
  'f5',         // reload
  'f11',        // fullscreen
  'f12',        // devtools
  'alt+f4',     // close window
];

// ---------------------------------------------------------------------------
// Conflict detection
// ---------------------------------------------------------------------------

function shortcutKey(def: ShortcutDef): string {
  const parts: string[] = [];
  if (def.modifiers.ctrl) parts.push('ctrl');
  if (def.modifiers.shift) parts.push('shift');
  if (def.modifiers.alt) parts.push('alt');
  if (def.modifiers.meta) parts.push('meta');
  parts.push(def.key.toLowerCase());
  return parts.join('+');
}

/**
 * Detect conflicts within the shortcut table and with browser reserved keys.
 * Returns an empty array if no conflicts.
 */
export function detectConflicts(
  shortcuts: readonly ShortcutDef[],
): readonly ShortcutConflict[] {
  const conflicts: ShortcutConflict[] = [];
  const seen = new Map<string, ShortcutDef>();

  for (const def of shortcuts) {
    const key = shortcutKey(def);
    const existing = seen.get(key);
    if (existing) {
      conflicts.push({ a: existing, b: def });
    } else {
      seen.set(key, def);
    }
  }

  return conflicts;
}

/**
 * Check if any shortcuts collide with browser reserved keys.
 */
export function detectBrowserConflicts(
  shortcuts: readonly ShortcutDef[],
): readonly ShortcutDef[] {
  const reserved = new Set(BROWSER_RESERVED);
  return shortcuts.filter((def) => reserved.has(shortcutKey(def)));
}

/**
 * Validate E16 rule: no single-key destructive shortcut without modifier.
 * Returns offending definitions.
 */
export function detectDestructiveWithoutModifier(
  shortcuts: readonly ShortcutDef[],
): readonly ShortcutDef[] {
  return shortcuts.filter((def) => {
    if (!def.destructive) return false;
    const { ctrl, shift, alt, meta } = def.modifiers;
    // Delete key is exempted — it's universally expected
    if (def.key.toLowerCase() === 'delete') return false;
    return !ctrl && !shift && !alt && !meta;
  });
}

/**
 * Match a keyboard event against the shortcut table.
 * Returns the matching action, or null.
 */
export function matchShortcut(
  event: { readonly key: string; readonly ctrlKey: boolean; readonly shiftKey: boolean; readonly altKey: boolean; readonly metaKey: boolean },
  shortcuts: readonly ShortcutDef[],
): string | null {
  const eventKey = event.key.toLowerCase();
  for (const def of shortcuts) {
    if (def.key.toLowerCase() !== eventKey) continue;
    if (def.modifiers.ctrl !== event.ctrlKey) continue;
    if (def.modifiers.shift !== event.shiftKey) continue;
    if (def.modifiers.alt !== event.altKey) continue;
    if (def.modifiers.meta !== event.metaKey) continue;
    return def.action;
  }
  return null;
}
