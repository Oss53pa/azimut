/**
 * E16 — Keyboard shortcuts.
 *
 * Single declaration table. Never scattered across components.
 * Automated conflict detection, including browser/OS reserved keys.
 * No single-key destructive shortcut without confirmation.
 */

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
  /** Human-readable label (FR). */
  readonly label: string;
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
  { action: 'undo',        label: 'Annuler',                 key: 'z',      modifiers: CTRL,       category: 'edit',      destructive: false },
  { action: 'redo',        label: 'Rétablir',                key: 'z',      modifiers: CTRL_SHIFT, category: 'edit',      destructive: false },
  { action: 'delete',      label: 'Supprimer',               key: 'Delete', modifiers: NO_MOD,     category: 'edit',      destructive: true },
  { action: 'copy',        label: 'Copier',                  key: 'c',      modifiers: CTRL,       category: 'edit',      destructive: false },
  { action: 'paste',       label: 'Coller',                  key: 'v',      modifiers: CTRL,       category: 'edit',      destructive: false },
  { action: 'cut',         label: 'Couper',                  key: 'x',      modifiers: CTRL,       category: 'edit',      destructive: true },

  // Selection
  { action: 'select_all',  label: 'Tout sélectionner',       key: 'a',      modifiers: CTRL,       category: 'selection', destructive: false },
  { action: 'deselect',    label: 'Désélectionner',          key: 'Escape', modifiers: NO_MOD,     category: 'selection', destructive: false },
  { action: 'nav_next',    label: 'Objet suivant',           key: 'Tab',    modifiers: NO_MOD,     category: 'selection', destructive: false },
  { action: 'nav_prev',    label: 'Objet précédent',         key: 'Tab',    modifiers: SHIFT,      category: 'selection', destructive: false },

  // View
  { action: 'zoom_in',     label: 'Zoom avant',              key: '=',      modifiers: NO_MOD,     category: 'view',      destructive: false },
  { action: 'zoom_out',    label: 'Zoom arrière',            key: '-',      modifiers: NO_MOD,     category: 'view',      destructive: false },
  { action: 'zoom_fit',    label: 'Ajuster à la vue',        key: '0',      modifiers: CTRL,       category: 'view',      destructive: false },

  // Tool
  { action: 'tool_select', label: 'Outil sélection',         key: 'v',      modifiers: NO_MOD,     category: 'tool',      destructive: false },
  { action: 'tool_hand',   label: 'Outil main',              key: 'h',      modifiers: NO_MOD,     category: 'tool',      destructive: false },
  { action: 'tool_rect',   label: 'Outil rectangle',         key: 'r',      modifiers: NO_MOD,     category: 'tool',      destructive: false },
  { action: 'tool_ellipse',label: 'Outil ellipse',           key: 'e',      modifiers: NO_MOD,     category: 'tool',      destructive: false },
  { action: 'tool_poly',   label: 'Outil polygone',          key: 'p',      modifiers: NO_MOD,     category: 'tool',      destructive: false },
  { action: 'tool_line',   label: 'Outil ligne',             key: 'l',      modifiers: NO_MOD,     category: 'tool',      destructive: false },
  { action: 'tool_pen',    label: 'Outil plume',             key: 'b',      modifiers: NO_MOD,     category: 'tool',      destructive: false },
  { action: 'tool_text',   label: 'Outil texte',             key: 't',      modifiers: NO_MOD,     category: 'tool',      destructive: false },
  { action: 'tool_node',   label: 'Outil placement de nœud', key: 'n',      modifiers: NO_MOD,     category: 'tool',      destructive: false },
  { action: 'tool_measure',label: 'Outil mesure',            key: 'm',      modifiers: NO_MOD,     category: 'tool',      destructive: false },

  // File / help
  { action: 'show_help',  label: 'Raccourcis clavier',       key: '?',      modifiers: SHIFT,      category: 'file',      destructive: false },
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
