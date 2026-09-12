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
import { useI18n } from '../i18n/useI18n.js';
import type { Translate } from '../i18n/i18n-context.js';
import type { UiMessageKey } from '../i18n/messages.js';

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
  borderRadius: 6,
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
  fontSize: 15,
  fontWeight: 500,
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
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-secondary)',
  marginTop: 16,
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

const CATEGORY_KEYS: Record<string, UiMessageKey> = {
  edit: 'editor.shortcuts.cat.edit',
  view: 'editor.shortcuts.cat.view',
  tool: 'editor.shortcuts.cat.tool',
  selection: 'editor.shortcuts.cat.selection',
  file: 'editor.shortcuts.cat.file',
};

const CATEGORY_ORDER: readonly string[] = ['edit', 'selection', 'view', 'tool', 'file'];

function formatKey(def: ShortcutDef, t: Translate): string {
  // ? is typed as Shift+/ but displayed as just "?"
  if (def.key === '?') return '?';

  const parts: string[] = [];
  if (def.modifiers.ctrl) parts.push(t('editor.key.ctrl'));
  if (def.modifiers.shift) parts.push(t('editor.key.shift'));
  if (def.modifiers.alt) parts.push(t('editor.key.alt'));
  if (def.modifiers.meta) parts.push(t('editor.key.meta'));
  parts.push(formatKeyName(def.key, t));
  return parts.join('+');
}

function formatKeyName(key: string, t: Translate): string {
  switch (key) {
    case 'Escape': return t('editor.key.escape');
    case 'Delete': return t('editor.key.delete');
    case 'Tab': return t('editor.key.tab');
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
  const { t } = useI18n();
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
      aria-label={t('editor.shortcuts.title')}
      aria-modal="true"
    >
      {/* Stop click propagation on the panel itself */}
      <div style={PANEL_STYLE} onClick={e => e.stopPropagation()}>
        <div style={HEADER_STYLE}>
          <h2 style={TITLE_STYLE}>{t('editor.shortcuts.title')}</h2>
          <button
            type="button"
            style={CLOSE_BUTTON_STYLE}
            onClick={onClose}
            aria-label={t('editor.shortcuts.close')}
            title={t('editor.shortcuts.close.title')}
          >
            ✕
          </button>
        </div>

        {CATEGORY_ORDER.map(cat => {
          const defs = grouped.get(cat);
          if (defs === undefined || defs.length === 0) return null;
          const catKey = CATEGORY_KEYS[cat];
          return (
            <div key={cat}>
              <div style={CATEGORY_STYLE}>
                {catKey ? t(catKey) : cat}
              </div>
              {defs.map(def => (
                <div key={def.action} style={ROW_STYLE}>
                  <span style={LABEL_STYLE}>{t(def.labelKey)}</span>
                  <kbd style={KEY_STYLE}>{formatKey(def, t)}</kbd>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
