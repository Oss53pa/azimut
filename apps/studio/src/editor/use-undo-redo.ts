/**
 * E5 — Undo/redo actions.
 *
 * Provides undo/redo callbacks and state queries.
 * Keyboard shortcuts are handled by useShortcuts (E16) — this hook
 * only exposes the action functions.
 *
 * Separated from EditorCanvas to keep file sizes under 400 lines (A2.4).
 */

import { useCallback } from 'react';
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
 * Hook that provides undo/redo actions.
 *
 * Keyboard binding is handled centrally by useShortcuts (E16).
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

  return {
    undo,
    redo,
    canUndo: canUndo(history),
    canRedo: canRedo(history),
  };
}
