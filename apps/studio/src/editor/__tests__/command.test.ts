import { describe, it, expect } from 'vitest';
import {
  historyReducer,
  EMPTY_HISTORY,
  UNDO_STACK_DEPTH,
  createCommand,
  canUndo,
  canRedo,
} from '../command.js';
import type { Command, HistoryState } from '../command.js';

function cmd(id: string, before: number, after: number, group?: string): Command<number> {
  return createCommand('move', id, before, after, '2024-01-01T00:00:00Z', group);
}

describe('E5 — command pattern', () => {
  describe('execute', () => {
    it('adds command to undo stack', () => {
      const s = historyReducer(EMPTY_HISTORY, {
        type: 'execute', command: cmd('a', 0, 1),
      });
      expect(s.undoStack).toHaveLength(1);
      expect(s.undoStack[0]?.targetId).toBe('a');
    });

    it('clears redo stack on new command', () => {
      const withRedo: HistoryState = {
        undoStack: [cmd('a', 0, 1)],
        redoStack: [cmd('b', 0, 1)],
      };
      const s = historyReducer(withRedo, {
        type: 'execute', command: cmd('c', 0, 1),
      });
      expect(s.redoStack).toHaveLength(0);
    });

    it('coalesces commands with same groupKey', () => {
      let s = EMPTY_HISTORY;
      s = historyReducer(s, {
        type: 'execute', command: cmd('a', 0, 5, 'drag-1'),
      });
      s = historyReducer(s, {
        type: 'execute', command: cmd('a', 5, 10, 'drag-1'),
      });
      expect(s.undoStack).toHaveLength(1);
      // Merged: before from first, after from last
      const merged = s.undoStack[0] as Command<number>;
      expect(merged.before).toBe(0);
      expect(merged.after).toBe(10);
    });

    it('does not coalesce different targetIds', () => {
      let s = EMPTY_HISTORY;
      s = historyReducer(s, {
        type: 'execute', command: cmd('a', 0, 5, 'drag-1'),
      });
      s = historyReducer(s, {
        type: 'execute', command: cmd('b', 0, 5, 'drag-1'),
      });
      expect(s.undoStack).toHaveLength(2);
    });

    it('does not coalesce null groupKeys', () => {
      let s = EMPTY_HISTORY;
      s = historyReducer(s, {
        type: 'execute', command: cmd('a', 0, 5),
      });
      s = historyReducer(s, {
        type: 'execute', command: cmd('a', 5, 10),
      });
      expect(s.undoStack).toHaveLength(2);
    });
  });

  describe('undo', () => {
    it('pops from undo and pushes to redo', () => {
      const s0 = historyReducer(EMPTY_HISTORY, {
        type: 'execute', command: cmd('a', 0, 1),
      });
      const s1 = historyReducer(s0, { type: 'undo' });
      expect(s1.undoStack).toHaveLength(0);
      expect(s1.redoStack).toHaveLength(1);
    });

    it('undo on empty stack is identity', () => {
      const s = historyReducer(EMPTY_HISTORY, { type: 'undo' });
      expect(s).toBe(EMPTY_HISTORY);
    });
  });

  describe('redo', () => {
    it('pops from redo and pushes to undo', () => {
      let s = EMPTY_HISTORY;
      s = historyReducer(s, { type: 'execute', command: cmd('a', 0, 1) });
      s = historyReducer(s, { type: 'undo' });
      s = historyReducer(s, { type: 'redo' });
      expect(s.undoStack).toHaveLength(1);
      expect(s.redoStack).toHaveLength(0);
    });

    it('redo on empty stack is identity', () => {
      const s = historyReducer(EMPTY_HISTORY, { type: 'redo' });
      expect(s).toBe(EMPTY_HISTORY);
    });
  });

  describe('clear (E5.3)', () => {
    it('empties both stacks', () => {
      let s = EMPTY_HISTORY;
      s = historyReducer(s, { type: 'execute', command: cmd('a', 0, 1) });
      s = historyReducer(s, { type: 'execute', command: cmd('b', 0, 1) });
      s = historyReducer(s, { type: 'undo' });
      s = historyReducer(s, { type: 'clear' });
      expect(s).toStrictEqual(EMPTY_HISTORY);
    });
  });

  describe('stack depth (E5.2)', () => {
    it('constant is 200', () => {
      expect(UNDO_STACK_DEPTH).toBe(200);
    });

    it('trims oldest entries when exceeding depth', () => {
      let s = EMPTY_HISTORY;
      for (let i = 0; i < UNDO_STACK_DEPTH + 10; i++) {
        s = historyReducer(s, {
          type: 'execute', command: cmd(`item-${i}`, i, i + 1),
        });
      }
      expect(s.undoStack).toHaveLength(UNDO_STACK_DEPTH);
      // Oldest entries (0..9) should be trimmed
      expect(s.undoStack[0]?.targetId).toBe('item-10');
    });
  });

  describe('canUndo / canRedo', () => {
    it('empty history: neither', () => {
      expect(canUndo(EMPTY_HISTORY)).toBe(false);
      expect(canRedo(EMPTY_HISTORY)).toBe(false);
    });

    it('after execute: canUndo true, canRedo false', () => {
      const s = historyReducer(EMPTY_HISTORY, {
        type: 'execute', command: cmd('a', 0, 1),
      });
      expect(canUndo(s)).toBe(true);
      expect(canRedo(s)).toBe(false);
    });

    it('after undo: canRedo true', () => {
      let s = EMPTY_HISTORY;
      s = historyReducer(s, { type: 'execute', command: cmd('a', 0, 1) });
      s = historyReducer(s, { type: 'undo' });
      expect(canUndo(s)).toBe(false);
      expect(canRedo(s)).toBe(true);
    });
  });

  describe('INV-4 determinism', () => {
    it('same commands produce same history', () => {
      const run = (): HistoryState => {
        let s = EMPTY_HISTORY;
        s = historyReducer(s, { type: 'execute', command: cmd('a', 0, 1) });
        s = historyReducer(s, { type: 'execute', command: cmd('b', 0, 2) });
        s = historyReducer(s, { type: 'undo' });
        s = historyReducer(s, { type: 'execute', command: cmd('c', 0, 3) });
        return s;
      };
      expect(run()).toStrictEqual(run());
    });
  });

  describe('createCommand', () => {
    it('creates a well-formed command', () => {
      const c = createCommand('resize', 'fp-1', { w: 10 }, { w: 20 }, '2024-06-01T12:00:00Z', 'drag-1');
      expect(c.type).toBe('resize');
      expect(c.targetId).toBe('fp-1');
      expect(c.before).toStrictEqual({ w: 10 });
      expect(c.after).toStrictEqual({ w: 20 });
      expect(c.timestamp).toBe('2024-06-01T12:00:00Z');
      expect(c.groupKey).toBe('drag-1');
    });

    it('defaults groupKey to null', () => {
      const c = createCommand('delete', 'n-1', true, false, '2024-01-01T00:00:00Z');
      expect(c.groupKey).toBeNull();
    });
  });
});
