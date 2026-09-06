/**
 * E7.3 — Clipboard actions hook.
 *
 * Provides copy, cut, and paste callbacks bridging
 * the internal ClipboardState to clipboard pure functions.
 *
 * Keyboard shortcuts are handled by useShortcuts (E16) — this hook
 * only exposes the action functions.
 *
 * The hook does NOT access the browser clipboard API — it operates
 * on the internal ClipboardState. Browser clipboard integration
 * would require async permissions and is a separate concern.
 *
 * Separated from EditorView to keep file sizes under 400 lines (A2.4).
 */

import { useCallback } from 'react';
import type { SelectionState } from './selection.js';
import type {
  ClipboardState,
  ClipboardPayload,
  PasteContext,
  PasteResult,
} from './clipboard.js';
import {
  copyToClipboard,
  preparePaste,
  hasClipboard,
} from './clipboard.js';
import type { Point } from '@azimut/core-model';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UseClipboardOptions = {
  readonly clipboard: ClipboardState;
  readonly setClipboard: (state: ClipboardState) => void;
  readonly selection: SelectionState;
  /** Build a payload from the current selection. Returns null if nothing to copy. */
  readonly buildPayload: (selectedIds: readonly string[]) => ClipboardPayload | null;
  /** Target context for paste operations. */
  readonly pasteContext: PasteContext;
  /** Current viewport center in meters. */
  readonly viewportCenter: Point;
  /** Called when paste succeeds. */
  readonly onPaste: (result: PasteResult & { ok: true }) => void;
  /** Called when cut succeeds (to delete source objects). */
  readonly onCut: (selectedIds: readonly string[]) => void;
};

export type ClipboardActions = {
  readonly copy: () => void;
  readonly cut: () => void;
  readonly paste: () => PasteResult | null;
  readonly canPaste: boolean;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook that provides clipboard actions.
 *
 * Keyboard binding is handled centrally by useShortcuts (E16).
 */
export function useClipboard(options: UseClipboardOptions): ClipboardActions {
  const {
    clipboard,
    setClipboard,
    selection,
    buildPayload,
    pasteContext,
    viewportCenter,
    onPaste,
    onCut,
  } = options;

  const copy = useCallback(() => {
    if (selection.selectedIds.length === 0) return;
    const payload = buildPayload(selection.selectedIds);
    if (payload === null) return;
    setClipboard(copyToClipboard(clipboard, payload));
  }, [clipboard, selection.selectedIds, buildPayload, setClipboard]);

  const cut = useCallback(() => {
    if (selection.selectedIds.length === 0) return;
    const payload = buildPayload(selection.selectedIds);
    if (payload === null) return;
    setClipboard(copyToClipboard(clipboard, payload));
    onCut(selection.selectedIds);
  }, [clipboard, selection.selectedIds, buildPayload, setClipboard, onCut]);

  const paste = useCallback((): PasteResult | null => {
    if (!hasClipboard(clipboard)) return null;
    const result = preparePaste(clipboard, pasteContext, viewportCenter);
    if (result.ok) {
      onPaste(result);
    }
    return result;
  }, [clipboard, pasteContext, viewportCenter, onPaste]);

  return {
    copy,
    cut,
    paste,
    canPaste: hasClipboard(clipboard),
  };
}
