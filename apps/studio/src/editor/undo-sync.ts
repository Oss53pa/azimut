import type { Finding, Outcome } from '@azimut/core-model';

/**
 * E5.3 — Reconciling the local undo stack with offline object-level merge. The
 * undo stack is cleared at synchronisation: what is synced is no longer undoable
 * locally. Reverting a synced modification is done by a new, traced inverse
 * command, not by an undo. This guard refuses an undo whose target has already
 * been synchronised, raising a warning EDIT.UNDO_AFTER_SYNC that points to the
 * inverse-command path. Application-layer guard.
 */
export type UndoEntry = {
  readonly command_id: string;
  /** Whether the command it would revert has already been synchronised. */
  readonly synced: boolean;
};

/**
 * Guard an undo request. ok when the target is still local (unsynced); a
 * warning EDIT.UNDO_AFTER_SYNC (ok:false) when it has been synchronised — the
 * caller must issue an inverse command instead.
 */
export function guardUndoTarget(entry: UndoEntry): Outcome<null> {
  if (!entry.synced) {
    return { ok: true, value: null, warnings: [] };
  }
  const finding: Finding = {
    code: 'EDIT.UNDO_AFTER_SYNC',
    severity: 'warning',
    entity: { kind: 'command', id: entry.command_id },
    params: { remedy: 'inverse_command' },
    ruleRef: 'E5.3',
  };
  return { ok: false, findings: [finding] };
}
