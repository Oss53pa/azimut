import { describe, it, expect } from 'vitest';
import { syncStatusOf } from '../sync-status.js';

const base = { remote: true, followed: true, queued: 0, readFailing: false };

describe('F5.2 — l’état de synchronisation', () => {
  it('sans base, local, quoi qu’il en soit du reste', () => {
    expect(syncStatusOf({ ...base, remote: false, queued: 3, readFailing: true })).toEqual({ kind: 'local' });
  });

  it('une file en attente passe avant tout autre état distant', () => {
    expect(syncStatusOf({ ...base, queued: 2, readFailing: true })).toEqual({ kind: 'pending', count: 2 });
  });

  it('une base sans session : sans suivi', () => {
    expect(syncStatusOf({ ...base, followed: false })).toEqual({ kind: 'direct' });
  });

  it('une lecture du journal en échec : injoignable ; sinon à jour', () => {
    expect(syncStatusOf({ ...base, readFailing: true })).toEqual({ kind: 'unreachable' });
    expect(syncStatusOf(base)).toEqual({ kind: 'synced' });
  });
});
