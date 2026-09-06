/**
 * E5 — Undo/redo keyboard hook.
 *
 * Listens for Ctrl+Z (undo) and Ctrl+Shift+Z / Ctrl+Y (redo).
 * Dispatches to the history reducer.
 *
 * Separated from EditorCanvas to keep file sizes under 400 lines (A2.4).
 */

import { useCallback, useEffect } from 'react';
import type { HistoryAction, HistoryState } from './command.js';
import { canUndo, canRedo } from './command.js';

type UseUndoRedoOptions = {
  readonly history: HistoryState;
  readonly dispatchHistory: (action: HistoryAction) => void;
};

type UndoRedoActions = {
  readonly undo: () => void;
  readonly redo: () => void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
};

/**
 * Hook that provides undo/redo actions and listens for keyboard shortcuts.
 */
export function useUndoRedo(options: UseUndoRedoOptions): UndoRedoActions {
  const { history, dispatchHistory } = options;

  const undo = useCallback(() => {
    if (canUndo(history)) {
      dispatchHistory({ type: 'undo' });
    }
  }, [history, dispatchHistory]);

  const redo = useCallback(() => {
    if (canRedo(history)) {
      dispatchHistory({ type: 'redo' });
    }
  }, [history, dispatchHistory]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (!isCtrl) return;

      // Skip if in text input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo(history)) {
          dispatchHistory({ type: 'undo' });
        }
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        if (canRedo(history)) {
          dispatchHistory({ type: 'redo' });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, dispatchHistory]);

  return {
    undo,
    redo,
    canUndo: canUndo(history),
    canRedo: canRedo(history),
  };
}
