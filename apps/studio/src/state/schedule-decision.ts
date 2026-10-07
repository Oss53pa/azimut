/**
 * R16 (partie R) — « Version approuvée | Bandeau d'état indiquant
 * l'approbateur et la date. »
 *
 * La décision se lit dans `message_schedule_approval` (0074) : la dernière
 * décision `approved` portée sur ce tableau. L'approbateur n'est connu que par
 * son identifiant : le modèle ne porte aucun nom d'utilisateur (A5.1), et
 * l'écran ne lui en invente pas. La question est posée à l'éditeur.
 */
import { codePointCompare } from '@azimut/core-model';
import type { SessionState } from './session-store.js';
import { rowsOf } from './session-store.js';
import { text } from './row-values.js';

export type ScheduleApproval = {
  readonly approverId: string;
  readonly decidedAt: string;
};

/** L'instant d'une décision : la base écrit `+00:00`, la session `Z`. */
function instant(at: string): number {
  const parsed = Date.parse(at);
  return Number.isNaN(parsed) ? -Infinity : parsed;
}

/** La décision qui approuve ce tableau, ou `null` si aucune n'est lue. */
export function approvalOf(session: SessionState, scheduleId: string): ScheduleApproval | null {
  const decisions = rowsOf(session, 'message_schedule_approval')
    .filter(row => text(row.values, 'schedule_id') === scheduleId
      && text(row.values, 'decision') === 'approved')
    .map(row => ({
      id: row.id,
      approverId: text(row.values, 'user_id') ?? '',
      decidedAt: text(row.values, 'decided_at') ?? '',
    }))
    .filter(d => d.approverId !== '' && d.decidedAt !== '')
    .sort((a, b) => instant(b.decidedAt) - instant(a.decidedAt) || codePointCompare(b.id, a.id));
  const last = decisions[0];
  return last === undefined ? null : { approverId: last.approverId, decidedAt: last.decidedAt };
}
