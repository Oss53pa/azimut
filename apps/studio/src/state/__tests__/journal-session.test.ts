import { describe, it, expect } from 'vitest';
import { buildCommand } from '@azimut/core-model';
import type { EntityCommand } from '@azimut/core-model';
import { applyReceived, canReceive } from '../journal-session.js';
import { EMPTY_SESSION, applyToSession, rowsOf } from '../session-store.js';
import type { JournalEntry } from '../journal-follower.js';

const ORG = 'aaaaaaaa-0000-4000-8000-000000000001';
const AUTHOR = 'aaaaaaaa-0000-4000-8000-0000000000d1';
const T = '2026-11-22T10:00:00.000Z';

function cmd(draft: Partial<Parameters<typeof buildCommand>[0]>): EntityCommand {
  const out = buildCommand({
    operation: 'create', module: '01-socle', table: 'building', id: 'b1', org_id: ORG,
    after: { id: 'b1', name: 'A' }, timestamp: T, ...draft,
  });
  if (!out.ok) throw new Error(out.findings.map(f => f.code).join(','));
  return out.value;
}

const entry = (seq: number, command: EntityCommand): JournalEntry => ({ seq, authorId: AUTHOR, command });

describe('S6.6b — le journal rejoué sur la session', () => {
  it('rejoue les commandes dans l’ordre du journal', () => {
    const state = applyReceived(EMPTY_SESSION, [
      entry(1, cmd({})),
      entry(2, cmd({ operation: 'update', before: { name: 'A' }, after: { name: 'B' } })),
    ]);
    expect(rowsOf(state, 'building').map(r => r.values['name'])).toEqual(['B']);
  });

  it('rejouer une commande déjà présente ne change rien', () => {
    const create = cmd({});
    const once = applyToSession(EMPTY_SESSION, create);
    expect(applyReceived(once, [entry(1, create)])).toEqual(once);
  });

  it('ne reçoit rien tant qu’un travail local attend', () => {
    expect(canReceive(EMPTY_SESSION, false)).toBe(true);
    expect(canReceive(EMPTY_SESSION, true)).toBe(false);
    expect(canReceive({ ...EMPTY_SESSION, queued: [cmd({})] }, false)).toBe(false);
    expect(canReceive({ ...EMPTY_SESSION, online: false }, false)).toBe(false);
  });
});
