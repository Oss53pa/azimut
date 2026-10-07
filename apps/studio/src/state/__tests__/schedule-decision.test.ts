import { describe, it, expect } from 'vitest';
import { EMPTY_SESSION } from '../session-store.js';
import type { SessionState, StoredRow } from '../session-store.js';
import { approvalOf } from '../schedule-decision.js';

/** R16 — la décision qui approuve une version, lue dans la session. */
function decision(id: string, scheduleId: string, kind: string, userId: string, at: string): StoredRow {
  return {
    table: 'message_schedule_approval', id,
    values: { id, schedule_id: scheduleId, decision: kind, user_id: userId, decided_at: at, inputs_hash: 'h' },
  };
}

function session(rows: readonly StoredRow[]): SessionState {
  return { ...EMPTY_SESSION, rows };
}

describe('R16 — l’approbateur et la date d’une version approuvée', () => {
  it('sans décision, rien n’est inventé', () => {
    expect(approvalOf(session([]), 'm1')).toBeNull();
  });

  it('un rejet n’est pas une approbation, et une autre version ne compte pas', () => {
    expect(approvalOf(session([
      decision('d1', 'm1', 'rejected', 'u1', '2026-10-05T09:00:00+00:00'),
      decision('d2', 'm2', 'approved', 'u2', '2026-10-05T10:00:00+00:00'),
    ]), 'm1')).toBeNull();
  });

  it('c’est la dernière approbation qui compte, à l’instant et non au texte', () => {
    const found = approvalOf(session([
      decision('d1', 'm1', 'approved', 'u-avant', '2026-10-05T10:00:00+00:00'),
      decision('d2', 'm1', 'approved', 'u-apres', '2026-10-05T10:00:00.500Z'),
    ]), 'm1');
    expect(found).toEqual({ approverId: 'u-apres', decidedAt: '2026-10-05T10:00:00.500Z' });
  });
});
