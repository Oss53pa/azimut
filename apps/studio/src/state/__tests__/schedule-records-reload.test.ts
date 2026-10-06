import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit';
import { computeGraphHash } from '@azimut/engine-graph';
import type { ScheduleRecords } from '../../data/site-repository.js';
import { sessionFromSite } from '../session-from-site.js';
import { graphScopeFromSession } from '../session-scope.js';
import { readSchedule } from '../message-schedule-read.js';
import { graphValidatedForSite } from '../schedule-submission.js';
import type { SessionState } from '../session-store.js';

/**
 * R12 — un tableau relu de la base se lit comme un tableau écrit dans la
 * session. La base rend ses colonnes `jsonb` en objets et ses instants avec
 * `+00:00` ; le chemin d'écriture les avait posés en texte et avec `Z`.
 */
const site = refMultilevel;
const SITE = site.site.id;
const node = site.graph.nodes[0]?.id ?? '';

function hashOf(session: SessionState): string {
  const hash = computeGraphHash(graphScopeFromSession(session).scope.graph);
  if (!hash.ok) throw new Error('empreinte attendue');
  return hash.value;
}

const hash = hashOf(sessionFromSite(site));

const records: ScheduleRecords = {
  schedules: [{
    id: 'm1', org_id: 'o', site_id: SITE, version: 2, state: 'in_review',
    generated_at: '2026-10-05T08:00:00+00:00', inputs_hash: 'sha256:entrees',
  }],
  lines: [{
    id: 'l1', org_id: 'o', schedule_id: 'm1', support_id: 's1', face_index: 0, block_index: 0,
    content: { block_kind: 'destination_list', entries: [{ destination_id: 'd1', text: { fr: 'Accueil', en: 'Reception' }, direction: 'left', distance_m: 20 }] },
    pictogram_id: null, direction: 'left', information_level: 2, decision_point_id: node,
    stale: false, excluded: true,
    exclusion_reason: { cap: 6, rule_ref: 'H2.6', excluded_priority: 9, last_kept_priority: 4 },
  }],
  approvals: [{
    id: 'd1', org_id: 'o', schedule_id: 'm1', decision: 'rejected', comment: 'Flèche fausse',
    decided_at: '2026-10-05T09:00:00+00:00', inputs_hash: 'sha256:entrees', user_id: 'u1',
  }],
  validations: [{
    id: 'g1', org_id: 'o', site_id: SITE, graph_hash: hash, passed: true,
    ran_at: '2026-10-05T07:00:00+00:00', blocking_count: 0, warning_count: 0,
  }],
};

describe('R12 — le circuit du tableau, relu de la base', () => {
  const session = sessionFromSite(site, undefined, records);

  it('le tableau relu se lit, avec ses lignes et leur écartement', () => {
    const read = readSchedule(session, SITE);
    expect(read?.scheduleId).toBe('m1');
    expect(read?.schedule.state).toBe('in_review');
    expect(read?.unreadable).toEqual([]);
    expect(read?.schedule.lines.map(l => l.entries[0]?.text['fr'])).toEqual(['Accueil']);
    expect(read?.exclusions.get(read.schedule.lines[0]?.id ?? '')?.cap).toBe(6);
  });

  it('les décisions entrent dans la session', () => {
    expect(session.rows.filter(r => r.table === 'message_schedule_approval').map(r => r.id)).toEqual(['d1']);
  });

  it('le passage de validation relu vaut pour le graphe actuel', () => {
    expect(graphValidatedForSite(session, SITE)).toBe(true);
  });

  it('un passage écrit dans la session après le passage relu l’emporte, malgré les deux écritures de l’instant', () => {
    const later: SessionState = {
      ...session,
      rows: [...session.rows, {
        table: 'graph_validation', id: 'g0',
        values: { id: 'g0', site_id: SITE, graph_hash: hash, passed: false, ran_at: '2026-10-05T07:00:01.000Z' },
      }],
    };
    expect(graphValidatedForSite(later, SITE)).toBe(false);
  });
});
