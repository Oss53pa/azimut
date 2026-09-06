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
  borderRadius: 3,
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

function toolLabel(toolId: ToolId): string {
  const meta = TOOL_REGISTRY.find(t => t.id === toolId);
  return meta?.label ?? toolId;
}

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
}: StatusBarProps): JSX.Element {
  return (
    <div style={BAR_STYLE} role="status" aria-label="Barre de statut">
      {/* Tool name */}
      <span style={{ fontWeight: 500 }}>
        {toolLabel(currentTool)}
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

      {/* Undo/Redo */}
      <button
        type="button"
        style={canUndo ? BUTTON_STYLE : DISABLED_BUTTON}
        disabled={!canUndo}
        onClick={onUndo}
        title="Annuler (Ctrl+Z)"
        aria-label="Annuler"
      >
        ↩ Annuler
      </button>
      <button
        type="button"
        style={canRedo ? BUTTON_STYLE : DISABLED_BUTTON}
        disabled={!canRedo}
        onClick={onRedo}
        title="Rétablir (Ctrl+Maj+Z)"
        aria-label="Rétablir"
      >
        ↪ Rétablir
      </button>
    </div>
  );
}
