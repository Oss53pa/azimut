/**
 * E5 — Command pattern for editing operations.
 *
 * Every data mutation passes through a Command — a serializable object
 * with type, target, before, after, and a caller-provided timestamp.
 *
 * Commands are reversible. A non-reversible command is rejected.
 * View changes (pan, zoom, selection, active level) never enter this stack.
 */

// ---------------------------------------------------------------------------
// E5.2 — Undo stack depth
// ---------------------------------------------------------------------------

/** Maximum undo entries, named constant. */
export const UNDO_STACK_DEPTH = 200;

// ---------------------------------------------------------------------------
// Command type
// ---------------------------------------------------------------------------

/**
 * A serializable editing command.
 *
 * `T` is the shape of the target value (e.g., a Point, a polygon, a string).
 * The command stores the full before/after snapshot so it can be applied
 * in both directions without side effects.
 *
 * `timestamp` is provided by the caller, never read by the command itself
 * (conforming to the prohibition on reading the clock in an engine).
 */
export type Command<T = unknown> = {
  readonly type: string;
  readonly targetId: string;
  readonly before: T;
  readonly after: T;
  /** ISO-8601, provided by the caller. */
  readonly timestamp: string;
  /** Group key for coalescing continuous gestures (E5.2). */
  readonly groupKey: string | null;
};

// ---------------------------------------------------------------------------
// History state
// ---------------------------------------------------------------------------

export type HistoryState = {
  /** Undo stack — most recent at the end. */
  readonly undoStack: readonly Command[];
  /** Redo stack — most recent at the end. */
  readonly redoStack: readonly Command[];
};

export const EMPTY_HISTORY: HistoryState = {
  undoStack: [],
  redoStack: [],
};

// ---------------------------------------------------------------------------
// History actions
// ---------------------------------------------------------------------------

export type HistoryAction =
  | { readonly type: 'execute'; readonly command: Command }
  | { readonly type: 'undo' }
  | { readonly type: 'redo' }
  | { readonly type: 'clear' };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function historyReducer(
  state: HistoryState,
  action: HistoryAction,
): HistoryState {
  switch (action.type) {
    case 'execute': {
      const cmd = action.command;
      const prev = state.undoStack;

      // E5.2 — Coalesce commands with the same groupKey
      const lastEntry = prev[prev.length - 1];
      if (
        cmd.groupKey !== null &&
        lastEntry?.groupKey === cmd.groupKey &&
        lastEntry.targetId === cmd.targetId &&
        lastEntry.type === cmd.type
      ) {
        // Merge: keep the original `before`, take the new `after`
        const merged: Command = {
          ...cmd,
          before: lastEntry.before,
        };
        const newStack = [...prev.slice(0, -1), merged];
        return {
          undoStack: trimStack(newStack),
          redoStack: [], // new action clears redo
        };
      }

      return {
        undoStack: trimStack([...prev, cmd]),
        redoStack: [],
      };
    }

    case 'undo': {
      const entry = state.undoStack[state.undoStack.length - 1];
      if (!entry) return state;

      return {
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, entry],
      };
    }

    case 'redo': {
      const entry = state.redoStack[state.redoStack.length - 1];
      if (!entry) return state;

      return {
        undoStack: trimStack([...state.undoStack, entry]),
        redoStack: state.redoStack.slice(0, -1),
      };
    }

    case 'clear': {
      // E5.3 — Stack cleared on sync
      return EMPTY_HISTORY;
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function trimStack(stack: readonly Command[]): readonly Command[] {
  if (stack.length <= UNDO_STACK_DEPTH) return stack;
  return stack.slice(stack.length - UNDO_STACK_DEPTH);
}

/**
 * Create a command. Convenience factory.
 * `timestamp` must be provided by the caller.
 */
export function createCommand<T>(
  type: string,
  targetId: string,
  before: T,
  after: T,
  timestamp: string,
  groupKey?: string,
): Command<T> {
  return {
    type,
    targetId,
    before,
    after,
    timestamp,
    groupKey: groupKey ?? null,
  };
}

/**
 * Check if a command can be undone (has a previous value).
 * Always true by construction — commands store before/after.
 */
export function canUndo(state: HistoryState): boolean {
  return state.undoStack.length > 0;
}

/**
 * Check if there is a redo entry.
 */
export function canRedo(state: HistoryState): boolean {
  return state.redoStack.length > 0;
}
