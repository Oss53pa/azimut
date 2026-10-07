import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Finding, Outcome } from '@azimut/core-model';
import type { RouteAnimationOptions } from '@azimut/engine-graph';
import type { SessionState, StoredRow } from '../session-store.js';

/**
 * L3.1 — un refus ou un avertissement du calcul des points de décision n'est
 * jamais tu par l'aperçu. Le moteur n'en lève aucun aujourd'hui : l'essai le
 * simule, pour que le jour où il en lèvera, l'aperçu le dise déjà.
 */
const verdict: { value: Outcome<readonly { readonly node_id: string }[]> } = {
  value: { ok: true, value: [], warnings: [] },
};

vi.mock('@azimut/engine-graph', async (actual) => ({
  ...(await actual<typeof import('@azimut/engine-graph')>()),
  deriveDecisionPoints: () => verdict.value,
}));

const { planRoute, profilesOfSession } = await import('../route-preview.js');

const options: RouteAnimationOptions = {
  width_px: 300, height_px: 200, padding_px: 10, stroke_px: 3, marker_px: 10, duration_s: 4,
  theme: { background: 'var(--a)', footprint_fill: 'var(--b)', footprint_stroke: 'var(--c)', route: 'var(--d)', marker: 'var(--e)', marker_fill: 'var(--f)' },
};

function node(id: string, x: number): StoredRow {
  return { table: 'node', id, values: { level_id: 'n0', kind: 'junction', label: id, position: { x_m: x, y_m: 0 } } };
}

const state: SessionState = {
  rows: [
    { table: 'level', id: 'n0', values: { building_id: 'b', name: 'RDC', ordinal: 0, elevation_m: 0 } },
    node('a', 0), node('b', 10),
    {
      table: 'edge', id: 'e1',
      values: { from_node_id: 'a', to_node_id: 'b', width_m: 2, slope_pct: 0, length_m: 10, direction: 'both', accessible: true, evacuation_route: false },
    },
    { table: 'travel_profile', id: 'p', values: { key: 'general', name: 'Général', excluded_edge_kinds: [], require_accessible: false, honor_hours: false } },
  ],
  queued: [],
  online: true,
};

const finding = (severity: Finding['severity']): Finding => ({
  code: 'GRAPH.NOT_VALIDATED', severity, entity: null, params: {}, ruleRef: null,
});

describe('L3.1 — l’aperçu du parcours ne tait rien du calcul des points de décision', () => {
  beforeEach(() => { verdict.value = { ok: true, value: [], warnings: [] }; });

  it('un refus arrête le tracé et se rend tel quel', () => {
    verdict.value = { ok: false, findings: [finding('blocking')] };
    const [profile] = profilesOfSession(state);
    if (profile === undefined) throw new Error('profil attendu');
    const out = planRoute(state, profile, 'a', 'b', options);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.findings.map(f => f.code)).toEqual(['GRAPH.NOT_VALIDATED']);
  });

  it('un avertissement accompagne le tracé au lieu de disparaître', () => {
    verdict.value = { ok: true, value: [], warnings: [finding('warning')] };
    const [profile] = profilesOfSession(state);
    if (profile === undefined) throw new Error('profil attendu');
    const out = planRoute(state, profile, 'a', 'b', options);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.warnings.map(f => [f.code, f.severity])).toEqual([['GRAPH.NOT_VALIDATED', 'warning']]);
  });
});
