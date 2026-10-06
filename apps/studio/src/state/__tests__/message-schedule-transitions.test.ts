import { describe, it, expect } from 'vitest';
import type { MessageSchedule, ScheduleState } from '@azimut/engine-graph';
import { transitionCommands } from '../message-schedule-transitions.js';
import type { StoredSchedule, TransitionConditions } from '../message-schedule-transitions.js';

/**
 * R12 (partie R) — les transitions traduites en écritures : un seul geste par
 * transition, les refus de la machine rendus tels quels, la décision écrite
 * dans `message_schedule_approval` et jamais dans `approval`.
 */
function stored(id: string, version: number, state: ScheduleState, stale = false): StoredSchedule {
  const schedule: MessageSchedule = {
    site_id: 'site', version, state, generated_at: '2026-10-06T08:00:00.000Z',
    inputs_hash: `sha256:v${String(version)}`,
    lines: stale ? [{
      id: 'l1', support_id: 's1', face_index: 0, block_index: 0, block_kind: 'directional',
      entries: [], pictogram_id: null, direction: null, information_level: 1,
      decision_point_id: 'n1', stale: true,
    } as unknown as MessageSchedule['lines'][number]] : [],
  };
  return { id, schedule };
}

const ready: TransitionConditions = {
  findings: [], graphValidated: true, rulesPackBound: true,
  openAnnotationIds: [], rejectionReason: null,
};
const write = { orgId: 'org', timestamp: '2026-10-06T09:00:00.000Z', decisionId: 'd1' };

describe('R12 — les transitions du tableau, en écritures', () => {
  it('émettre pour revue : l’état seul change, aucune décision n’est écrite', () => {
    const out = transitionCommands('submit_for_review', stored('t7', 7, 'draft'), ready, null, write);
    if (!out.ok) throw new Error(JSON.stringify(out.findings));
    expect(out.value.map(c => [c.table, c.operation, c.after?.['state'] ?? null])).toEqual([
      ['message_schedule', 'update', 'in_review'],
    ]);
  });

  it('les refus de la machine sont rendus tels quels, sans écriture', () => {
    const out = transitionCommands('submit_for_review', stored('t7', 7, 'draft'),
      { ...ready, graphValidated: false, rulesPackBound: false }, null, write);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.findings.map(f => f.code).sort()).toEqual(['GRAPH.NOT_VALIDATED', 'RULES.PACK_NOT_BOUND']);
  });

  it('rejeter : retour au brouillon, et la décision porte le motif et l’empreinte', () => {
    const out = transitionCommands('reject', stored('t7', 7, 'in_review'),
      { ...ready, rejectionReason: '  Le pictogramme de la ligne 4 est faux. ' }, null, write);
    if (!out.ok) throw new Error(JSON.stringify(out.findings));
    expect(out.value.map(c => c.table)).toEqual(['message_schedule', 'message_schedule_approval']);
    expect(out.value[0]?.after?.['state']).toBe('draft');
    expect(out.value[1]?.after).toMatchObject({
      schedule_id: 't7', decision: 'rejected',
      comment: 'Le pictogramme de la ligne 4 est faux.', inputs_hash: 'sha256:v7',
    });
    // L'approbateur et la date sont posés par la base, jamais par l'appelant.
    expect(out.value[1]?.after).not.toHaveProperty('user_id');
    expect(out.value[1]?.after).not.toHaveProperty('decided_at');
  });

  it('un rejet sans motif est refusé', () => {
    const out = transitionCommands('reject', stored('t7', 7, 'in_review'),
      { ...ready, rejectionReason: '  ' }, null, write);
    expect(out.ok).toBe(false);
  });

  it('approuver : la version précédente approuvée est remplacée, dans le même geste', () => {
    const out = transitionCommands('approve', stored('t7', 7, 'in_review'), ready,
      stored('t6', 6, 'approved'), write);
    if (!out.ok) throw new Error(JSON.stringify(out.findings));
    expect(out.value.map(c => [c.table, c.id, c.after?.['state'] ?? c.after?.['decision']])).toEqual([
      ['message_schedule', 't7', 'approved'],
      ['message_schedule_approval', 'd1', 'approved'],
      ['message_schedule', 't6', 'superseded'],
    ]);
    expect(new Set(out.value.map(c => c.groupKey)).size).toBe(1);
    expect(out.value.some(c => c.table === 'approval')).toBe(false);
  });

  it('une annotation ouverte ou une ligne périmée bloque l’approbation', () => {
    const open = transitionCommands('approve', stored('t7', 7, 'in_review'),
      { ...ready, openAnnotationIds: ['a1'] }, null, write);
    const stale = transitionCommands('approve', stored('t7', 7, 'in_review', true), ready, null, write);
    expect(open.ok ? [] : open.findings.map(f => f.code)).toEqual(['REVIEW.ANNOTATION_OPEN']);
    expect(stale.ok ? [] : stale.findings.map(f => f.code)).toEqual(['WAYFIND.SCHEDULE_STALE']);
  });

  it('une version en revue ne s’émet pas une seconde fois', () => {
    const out = transitionCommands('submit_for_review', stored('t7', 7, 'in_review'), ready, null, write);
    expect(out.ok ? [] : out.findings.map(f => f.code)).toEqual(['EDIT.CONTEXT_VIOLATION']);
  });
});
