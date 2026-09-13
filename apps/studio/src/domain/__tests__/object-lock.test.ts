import { describe, it, expect } from 'vitest';
import {
  guardObjectEdit,
  type ObjectLock,
  type EditRequest,
} from '../object-lock.js';

const NOW = '2026-09-13T04:00:00Z';
const LATER = '2026-09-13T04:10:00Z';
const EARLIER = '2026-09-13T03:50:00Z';

const lock = (holder: string, expires_at: string, object_id = 'o-1'): ObjectLock => ({
  object_id,
  holder,
  expires_at,
});

const req = (over: Partial<EditRequest> = {}): EditRequest => ({
  object_id: 'o-1',
  editor: 'alice',
  override: false,
  ...over,
});

describe('G4.2 — guardObjectEdit', () => {
  it('allows an edit when there is no lock', () => {
    expect(guardObjectEdit(req(), [], NOW).ok).toBe(true);
  });

  it('allows an edit on an object the editor holds themselves', () => {
    const r = guardObjectEdit(req(), [lock('alice', LATER)], NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([]);
  });

  it('allows an edit when the foreign lock has expired', () => {
    const r = guardObjectEdit(req(), [lock('bob', EARLIER)], NOW);
    expect(r.ok).toBe(true);
  });

  it('refuses an edit under a live foreign lock, with a warning', () => {
    const r = guardObjectEdit(req(), [lock('bob', LATER)], NOW);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings[0]?.code).toBe('EDIT.OBJECT_LOCKED');
    expect(r.findings[0]?.severity).toBe('warning');
    expect(r.findings[0]?.ruleRef).toBe('G4.2');
    expect(r.findings[0]?.params['holder']).toBe('bob');
    expect(r.findings[0]?.params['expires_at']).toBe(LATER);
  });

  it('allows an override past a live foreign lock, journalling it', () => {
    const r = guardObjectEdit(req({ override: true }), [lock('bob', LATER)], NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings[0]?.code).toBe('EDIT.LOCK_OVERRIDDEN');
    expect(r.warnings[0]?.severity).toBe('info');
    expect(r.warnings[0]?.params['holder']).toBe('bob');
    expect(r.warnings[0]?.params['by']).toBe('alice');
  });

  it('does not journal an override when no live lock exists', () => {
    const r = guardObjectEdit(req({ override: true }), [lock('bob', EARLIER)], NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([]);
  });
});
