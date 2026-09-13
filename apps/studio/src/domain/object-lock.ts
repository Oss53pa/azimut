import type { Finding, Outcome } from '@azimut/core-model';

/**
 * G4.2 — Consultative object locking. Real-time co-editing is excluded (G4.1);
 * instead, editing an object places a consultative lock carrying its holder and
 * a 15-minute expiry, renewed while editing continues. Another user sees the
 * object marked, may consult it, and cannot modify it without an explicit
 * override. No hard lock: an expired lock falls by itself, so a disconnect can
 * never leave a site inaccessible.
 *
 *  - EDIT.OBJECT_LOCKED (warning): an edit is refused because another user holds
 *    a live lock, unless overridden.
 *  - EDIT.LOCK_OVERRIDDEN (info): the edit forces past a live lock; journalled.
 *
 * Application-layer guard. Instants are ISO-8601 timestamps, compared lexically.
 */
export type ObjectLock = {
  readonly object_id: string;
  readonly holder: string;
  /** ISO-8601 instant at which the lock expires (15 min, renewed on edit). */
  readonly expires_at: string;
};

export type EditRequest = {
  readonly object_id: string;
  readonly editor: string;
  /** Explicit force-past a live foreign lock (G4.2), journalled. */
  readonly override: boolean;
};

/**
 * Guard an object edit against consultative locks.
 *  - No live foreign lock (none, expired, or held by the editor): ok, silent.
 *  - Live foreign lock, no override: refused with a warning EDIT.OBJECT_LOCKED.
 *  - Live foreign lock, override: allowed with an info EDIT.LOCK_OVERRIDDEN so
 *    the forced access is journalled.
 */
export function guardObjectEdit(
  request: EditRequest,
  locks: readonly ObjectLock[],
  now: string,
): Outcome<null> {
  const live = locks.find(
    (lock) =>
      lock.object_id === request.object_id &&
      lock.holder !== request.editor &&
      lock.expires_at > now, // an expired lock falls by itself.
  );

  if (live === undefined) {
    return { ok: true, value: null, warnings: [] };
  }

  if (request.override) {
    const overridden: Finding = {
      code: 'EDIT.LOCK_OVERRIDDEN',
      severity: 'info',
      entity: { kind: 'object', id: request.object_id },
      params: { holder: live.holder, by: request.editor },
      ruleRef: 'G4.2',
    };
    return { ok: true, value: null, warnings: [overridden] };
  }

  const locked: Finding = {
    code: 'EDIT.OBJECT_LOCKED',
    severity: 'warning',
    entity: { kind: 'object', id: request.object_id },
    params: { holder: live.holder, expires_at: live.expires_at },
    ruleRef: 'G4.2',
  };
  return { ok: false, findings: [locked] };
}
