import { describe, it, expect } from 'vitest';
import { guardUndoTarget, type UndoEntry } from '../undo-sync.js';

const entry = (command_id: string, synced: boolean): UndoEntry => ({
  command_id,
  synced,
});

describe('E5.3 — guardUndoTarget (EDIT.UNDO_AFTER_SYNC)', () => {
  it('allows undo of a local, unsynced command', () => {
    const r = guardUndoTarget(entry('c-1', false));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([]);
  });

  it('refuses undo of a synced command, pointing to the inverse-command path', () => {
    const r = guardUndoTarget(entry('c-1', true));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings[0]?.code).toBe('EDIT.UNDO_AFTER_SYNC');
    expect(r.findings[0]?.severity).toBe('warning');
    expect(r.findings[0]?.ruleRef).toBe('E5.3');
    expect(r.findings[0]?.entity).toEqual({ kind: 'command', id: 'c-1' });
    expect(r.findings[0]?.params['remedy']).toBe('inverse_command');
  });
});
