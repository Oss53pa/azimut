/**
 * E3 + E7 — Editor status bar.
 *
 * Displays contextual information at the bottom of the editor:
 *   - Current tool name
 *   - Cursor position in meters (when hovering)
 *   - Snap target info (when snapped)
 *   - Undo/redo button state
 *   - Editing context indicator
 *
 * Uses design-token CSS variables exclusively (A2.4).
 * This is a view component — it displays state, never mutates it (INV-2).
 */

import type { JSX } from 'react';
import type { Point } from '@azimut/core-model';
import type { ToolId } from './tool-state.js';
import { TOOL_REGISTRY } from './tool-state.js';
import type { SnapResult } from './snap.js';
import type { RenderMode } from './render-budget.js';
import { useI18n } from '../i18n/useI18n.js';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type StatusBarProps = {
  readonly currentTool: ToolId;
  readonly cursorPosition: Point | null;
  readonly snapResult: SnapResult;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  /** G2.2 — current adaptive render mode; shown here, never silent. */
  readonly renderMode: RenderMode;
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const BAR_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  padding: '4px 12px',
  background: 'var(--surface-panel)',
  borderTop: '1px solid var(--border-hairline)',
  fontSize: 11,
  color: 'var(--text-secondary)',
  flexShrink: 0,
  minHeight: 28,
};

const BUTTON_STYLE: React.CSSProperties = {
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  fontSize: 11,
  padding: '2px 6px',
  borderRadius: 4,
  color: 'var(--text-secondary)',
};

const DISABLED_BUTTON: React.CSSProperties = {
  ...BUTTON_STYLE,
  opacity: 0.4,
  cursor: 'default',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCoord(v: number): string {
  return v.toFixed(3);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StatusBar({
  currentTool,
  cursorPosition,
  snapResult,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  renderMode,
}: StatusBarProps): JSX.Element {
  const { t } = useI18n();
  const toolMeta = TOOL_REGISTRY.find((m) => m.id === currentTool);
  const toolName = toolMeta ? t(toolMeta.labelKey) : currentTool;
  const renderModeLabel = t(
    renderMode === 'lightweight' ? 'editor.render.lightweight' : 'editor.render.full',
  );
  return (
    <div style={BAR_STYLE} role="status" aria-label={t('editor.status.aria')}>
      {/* Tool name */}
      <span style={{ fontWeight: 500 }}>
        {toolName}
      </span>

      {/* Separator */}
      <span style={{ color: 'var(--border-hairline)' }}>|</span>

      {/* Cursor position */}
      {cursorPosition !== null ? (
        <span>
          X: {formatCoord(cursorPosition.x_m)} m &nbsp;
          Y: {formatCoord(cursorPosition.y_m)} m
        </span>
      ) : (
        <span>—</span>
      )}

      {/* Snap indicator */}
      {snapResult.target !== null && (
        <>
          <span style={{ color: 'var(--border-hairline)' }}>|</span>
          <span style={{ color: 'var(--accent)' }}>
            ◆ {snapResult.target.kind}
          </span>
        </>
      )}

      {/* Spacer */}
      <span style={{ flex: 1 }} />

      {/* Render mode (G2.2) — always shown, never silent */}
      <span
        aria-label={t('editor.render.aria')}
        style={{
          color: renderMode === 'lightweight' ? 'var(--accent)' : 'var(--text-secondary)',
        }}
      >
        {renderModeLabel}
      </span>
      <span style={{ color: 'var(--border-hairline)' }}>|</span>

      {/* Undo/Redo */}
      <button
        type="button"
        style={canUndo ? BUTTON_STYLE : DISABLED_BUTTON}
        disabled={!canUndo}
        onClick={onUndo}
        title={t('editor.status.undo.title')}
        aria-label={t('editor.shortcut.undo')}
      >
        {t('editor.shortcut.undo')}
      </button>
      <button
        type="button"
        style={canRedo ? BUTTON_STYLE : DISABLED_BUTTON}
        disabled={!canRedo}
        onClick={onRedo}
        title={t('editor.status.redo.title')}
        aria-label={t('editor.shortcut.redo')}
      >
        {t('editor.shortcut.redo')}
      </button>
    </div>
  );
}
