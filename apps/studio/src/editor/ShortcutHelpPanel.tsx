/**
 * E16 — Shortcut help panel.
 *
 * Renders the full shortcut table grouped by category.
 * Triggered by pressing '?' or via a toolbar help button.
 *
 * Uses design-token CSS variables exclusively (A2.4).
 * This is a view component — it displays data, never mutates (INV-2).
 */

import { type JSX, useMemo } from 'react';
import { DEFAULT_SHORTCUTS } from './shortcuts.js';
import type { ShortcutDef } from './shortcuts.js';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type ShortcutHelpPanelProps = {
  /** Whether the panel is visible. */
  readonly visible: boolean;
  /** Called when the user dismisses the panel. */
  readonly onClose: () => void;
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const OVERLAY_STYLE: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const PANEL_STYLE: React.CSSProperties = {
  background: 'var(--surface-panel)',
  border: '1px solid var(--border-hairline)',
  borderRadius: 10,
  padding: '20px 24px',
  maxWidth: 520,
  maxHeight: '80vh',
  overflowY: 'auto',
  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
};

const HEADER_STYLE: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 16,
};

const TITLE_STYLE: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: 'var(--text-primary)',
  margin: 0,
};

const CLOSE_BUTTON_STYLE: React.CSSProperties = {
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  fontSize: 18,
  color: 'var(--text-secondary)',
  padding: '2px 6px',
  borderRadius: 4,
};

const CATEGORY_STYLE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-secondary)',
  marginTop: 14,
  marginBottom: 6,
};

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '4px 0',
  fontSize: 13,
};

const LABEL_STYLE: React.CSSProperties = {
  color: 'var(--text-primary)',
};

const KEY_STYLE: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 6px',
  borderRadius: 4,
  border: '1px solid var(--border-hairline)',
  background: 'var(--surface-sunken)',
  fontFamily: 'system-ui, monospace',
  fontSize: 11,
  color: 'var(--text-secondary)',
  minWidth: 20,
  textAlign: 'center',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  edit: 'Édition',
  view: 'Vue',
  tool: 'Outils',
  selection: 'Sélection',
  file: 'Fichier',
};

const CATEGORY_ORDER: readonly string[] = ['edit', 'selection', 'view', 'tool', 'file'];

function formatKey(def: ShortcutDef): string {
  const parts: string[] = [];
  if (def.modifiers.ctrl) parts.push('Ctrl');
  if (def.modifiers.shift) parts.push('Maj');
  if (def.modifiers.alt) parts.push('Alt');
  if (def.modifiers.meta) parts.push('⌘');
  parts.push(formatKeyName(def.key));
  return parts.join('+');
}

function formatKeyName(key: string): string {
  switch (key) {
    case 'Escape': return 'Échap';
    case 'Delete': return 'Suppr';
    case 'Tab': return 'Tab';
    case '=': return '+';
    case '-': return '−';
    default: return key.toUpperCase();
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShortcutHelpPanel({
  visible,
  onClose,
}: ShortcutHelpPanelProps): JSX.Element | null {
  const grouped = useMemo(() => {
    const groups = new Map<string, ShortcutDef[]>();
    for (const def of DEFAULT_SHORTCUTS) {
      const list = groups.get(def.category) ?? [];
      list.push(def);
      groups.set(def.category, list);
    }
    return groups;
  }, []);

  if (!visible) return null;

  return (
    <div
      style={OVERLAY_STYLE}
      onClick={onClose}
      role="dialog"
      aria-label="Raccourcis clavier"
      aria-modal="true"
    >
      {/* Stop click propagation on the panel itself */}
      <div style={PANEL_STYLE} onClick={e => e.stopPropagation()}>
        <div style={HEADER_STYLE}>
          <h2 style={TITLE_STYLE}>Raccourcis clavier</h2>
          <button
            type="button"
            style={CLOSE_BUTTON_STYLE}
            onClick={onClose}
            aria-label="Fermer"
            title="Fermer (Échap)"
          >
            ✕
          </button>
        </div>

        {CATEGORY_ORDER.map(cat => {
          const defs = grouped.get(cat);
          if (defs === undefined || defs.length === 0) return null;
          return (
            <div key={cat}>
              <div style={CATEGORY_STYLE}>
                {CATEGORY_LABELS[cat] ?? cat}
              </div>
              {defs.map(def => (
                <div key={def.action} style={ROW_STYLE}>
                  <span style={LABEL_STYLE}>{def.label}</span>
                  <kbd style={KEY_STYLE}>{formatKey(def)}</kbd>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
