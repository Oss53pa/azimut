import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit';
import { computeGraphHash } from '@azimut/engine-graph';
import type { MessageSchedule } from '@azimut/engine-graph';
import type { SessionState, StoredRow } from '../session-store.js';
import { sessionFromSite } from '../session-from-site.js';
import { graphScopeFromSession } from '../session-scope.js';
import {
  graphValidatedForSite, rulesPackBoundIn, submissionConditions, submissionFindings,
} from '../schedule-submission.js';

/**
 * R12 (partie R) — les conditions de l'émission pour revue, lues dans la
 * session. Aucune n'est supposée remplie : le site de référence part sans
 * passage de validation, et l'émission y est refusée tant qu'il n'y en a pas.
 */
const site = refMultilevel;
const SITE = site.site.id;
const base = sessionFromSite(site);

function withRows(session: SessionState, rows: readonly StoredRow[]): SessionState {
  return { ...session, rows: [...session.rows, ...rows] };
}

function currentHash(session: SessionState): string {
  const hash = computeGraphHash(graphScopeFromSession(session).scope.graph);
  if (!hash.ok) throw new Error('empreinte attendue');
  return hash.value;
}

function run(id: string, ranAt: string, passed: boolean, graphHash: string): StoredRow {
  return {
    table: 'graph_validation', id,
    values: { id, site_id: SITE, ran_at: ranAt, passed, graph_hash: graphHash, blocking_count: passed ? 0 : 1 },
  };
}

const schedule: MessageSchedule = {
  site_id: SITE, version: 1, state: 'draft', generated_at: '2026-10-06T08:00:00.000Z',
  inputs_hash: 'sha256:entrees', lines: [],
};

describe('R12 — la validation de complétude, lue dans la session (M02.W11)', () => {
  it('sans passage enregistré, la validation n’est pas passée', () => {
    expect(graphValidatedForSite(base, SITE)).toBe(false);
  });

  it('le dernier passage réussi, pour le graphe actuel, la rend passée', () => {
    const hash = currentHash(base);
    expect(graphValidatedForSite(withRows(base, [run('v1', '2026-10-06T09:00:00.000Z', true, hash)]), SITE))
      .toBe(true);
  });

  it('un passage portant l’empreinte d’un autre graphe ne vaut pas pour celui-ci', () => {
    expect(graphValidatedForSite(withRows(base, [run('v1', '2026-10-06T09:00:00.000Z', true, 'sha256:ancien')]), SITE))
      .toBe(false);
  });

  it('c’est le dernier passage qui compte : un échec après une réussite l’emporte', () => {
    const hash = currentHash(base);
    const session = withRows(base, [
      run('v1', '2026-10-06T09:00:00.000Z', true, hash),
      run('v2', '2026-10-06T10:00:00.000Z', false, hash),
    ]);
    expect(graphValidatedForSite(session, SITE)).toBe(false);
  });
});

describe('R12 — les anomalies qui bloquent l’émission (R14)', () => {
  it('l’annuaire du site entre dans la session, pour les garde-fous de nommage et de continuité', () => {
    expect(base.rows.filter(r => r.table === 'destination').length).toBe(site.destinations.length);
    expect(base.rows.filter(r => r.table === 'destination_name').length).toBe(site.destination_names.length);
  });

  it('deux destinations d’un même bâtiment portant le même nom sont une collision de nommage', () => {
    const buildingOf = (nodeId: string): string | undefined => {
      const levelId = site.graph.nodes.find(n => n.id === nodeId)?.level_id;
      return site.levels.find(l => l.id === levelId)?.building_id;
    };
    const pair = site.destinations.flatMap((a, i) => site.destinations.slice(i + 1)
      .filter(b => buildingOf(a.node_id) === buildingOf(b.node_id))
      .map(b => [a.id, b.id] as const))[0];
    if (pair === undefined) throw new Error('deux destinations d’un même bâtiment attendues');
    expect(submissionFindings(base, schedule, ['fr']).map(f => f.code)).not.toContain('WAYFIND.NAMING_COLLISION');
    const renamed: SessionState = {
      ...base,
      rows: base.rows.map(row => row.table === 'destination_name' && row.values['lang'] === 'fr'
        && pair.includes(String(row.values['destination_id']))
        ? { ...row, values: { ...row.values, value: 'Accueil' } }
        : row),
    };
    const collisions = submissionFindings(renamed, schedule, ['fr'])
      .filter(f => f.code === 'WAYFIND.NAMING_COLLISION')
      .map(f => f.entity?.id);
    expect(collisions).toEqual([...pair].sort());
  });

  it('un support sans niveau d’information bloque', () => {
    const line = {
      id: 'l1', support_id: 's1', face_index: 0, block_index: 0, block_kind: 'directional',
      entries: [], pictogram_id: null, direction: null, information_level: null,
      decision_point_id: site.graph.nodes[0]?.id ?? '', stale: false,
    } as unknown as MessageSchedule['lines'][number];
    const codes = submissionFindings(base, { ...schedule, lines: [line] }, ['fr', 'en']).map(f => f.code);
    expect(codes).toContain('WAYFIND.NO_INFORMATION_LEVEL');
  });

  it('les conditions rassemblent anomalies, validation, paquet et annotations', () => {
    const conditions = submissionConditions(base, SITE, schedule, ['a1'], ['fr', 'en']);
    expect(conditions.graphValidated).toBe(false);
    expect(conditions.rulesPackBound).toBe(rulesPackBoundIn(base, SITE));
    expect(conditions.openAnnotationIds).toEqual(['a1']);
    expect(conditions.rejectionReason).toBeNull();
  });
});
