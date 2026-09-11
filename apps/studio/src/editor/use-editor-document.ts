/**
 * E5 — Document and history, bound together.
 *
 * The history reducer records commands; this hook is what makes them
 * take effect. Executing a command applies its `after` patch, undoing
 * applies the `before` patch of the entry leaving the undo stack, and
 * redoing applies the `after` patch of the entry leaving the redo
 * stack. The two reducers therefore never drift apart.
 *
 * View state — pan, zoom, selection, active level — never reaches this
 * hook, so it never enters the undo stack (E5.2).
 */

import { useCallback, useMemo, useReducer } from 'react';
import type { Command, HistoryState } from './command.js';
import { canRedo, canUndo, historyReducer, EMPTY_HISTORY } from './command.js';
import type { DocumentPatch, EditorDocument } from './editor-document.js';
import { documentReducer, emptyDocument, isDocumentPatch } from './editor-document.js';

// ---------------------------------------------------------------------------
// Hook result
// ---------------------------------------------------------------------------

export type EditorDocumentApi = {
  readonly document: EditorDocument;
  readonly history: HistoryState;
  /** Apply a command and push it on the undo stack. */
  readonly execute: (command: Command<DocumentPatch>) => void;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEditorDocument(siteId: string): EditorDocumentApi {
  const initial = useMemo(() => emptyDocument(siteId), [siteId]);
  const [document, dispatchDocument] = useReducer(documentReducer, initial);
  const [history, dispatchHistory] = useReducer(historyReducer, EMPTY_HISTORY);

  const execute = useCallback((command: Command<DocumentPatch>) => {
    dispatchDocument({ type: 'apply', patch: command.after });
    dispatchHistory({ type: 'execute', command });
  }, []);

  const undo = useCallback(() => {
    const entry = history.undoStack[history.undoStack.length - 1];
    if (entry === undefined) return;
    if (!isDocumentPatch(entry.before)) return;
    dispatchDocument({ type: 'apply', patch: entry.before });
    dispatchHistory({ type: 'undo' });
  }, [history.undoStack]);

  const redo = useCallback(() => {
    const entry = history.redoStack[history.redoStack.length - 1];
    if (entry === undefined) return;
    if (!isDocumentPatch(entry.after)) return;
    dispatchDocument({ type: 'apply', patch: entry.after });
    dispatchHistory({ type: 'redo' });
  }, [history.redoStack]);

  return {
    document,
    history,
    execute,
    undo,
    redo,
    canUndo: canUndo(history),
    canRedo: canRedo(history),
  };
}
