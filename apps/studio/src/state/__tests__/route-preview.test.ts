import { describe, it, expect } from 'vitest';
import type { RouteAnimationOptions } from '@azimut/engine-iso';
import { planRoute, profilesOfSession } from '../route-preview.js';
import type { SessionState, StoredRow } from '../session-store.js';

const options: RouteAnimationOptions = {
  width_px: 300, height_px: 200, padding_px: 10, stroke_px: 3, marker_px: 10, duration_s: 4,
  theme: { background: 'var(--a)', footprint_fill: 'var(--b)', footprint_stroke: 'var(--c)', route: 'var(--d)', marker: 'var(--e)', marker_fill: 'var(--f)' },
};

function node(id: string, level: string, x: number, y: number, kind = 'junction'): StoredRow {
  return { table: 'node', id, values: { level_id: level, kind, label: id, position: { x_m: x, y_m: y } } };
}

function edge(id: string, from: string, to: string, length: number): StoredRow {
  return {
    table: 'edge', id,
    values: { from_node_id: from, to_node_id: to, width_m: 2, slope_pct: 0, length_m: length, direction: 'both', accessible: true, evacuation_route: false },
  };
}

const rows: StoredRow[] = [
  { table: 'level', id: 'n0', values: { building_id: 'b', name: 'Rez-de-chaussée', ordinal: 0, elevation_m: 0 } },
  { table: 'level', id: 'n1', values: { building_id: 'b', name: 'Étage 1', ordinal: 1, elevation_m: 4 } },
  node('entree', 'n0', 0, 0, 'entrance'),
  node('carrefour', 'n0', 10, 0),
  node('cote', 'n0', 10, 5),
  node('asc0', 'n0', 20, 0, 'elevator'),
  node('asc1', 'n1', 20, 0, 'elevator'),
  node('boutique', 'n1', 20, 8, 'destination_access'),
  edge('e1', 'entree', 'carrefour', 10),
  edge('e2', 'carrefour', 'cote', 5),
  edge('e3', 'carrefour', 'asc0', 10),
  edge('e4', 'asc0', 'asc1', 4),
  edge('e5', 'asc1', 'boutique', 8),
  { table: 'vertical_link', id: 'v1', values: { edge_id: 'e4', kind: 'elevator', capacity: 8, accessible: true } },
  { table: 'travel_profile', id: 'p-general', values: { key: 'general', name: 'Général', excluded_edge_kinds: [], require_accessible: false, honor_hours: false } },
];

const state: SessionState = { rows, queued: [], online: true };

describe('L3.1 — le parcours d’un visiteur dans l’atelier', () => {
  it('les profils se lisent dans la session ; aucun n’est inventé', () => {
    expect(profilesOfSession(state).map(p => p.key)).toEqual(['general']);
    expect(profilesOfSession({ ...state, rows: rows.filter(r => r.table !== 'travel_profile') })).toEqual([]);
  });

  it('le parcours traverse deux niveaux : deux tronçons, l’ascenseur en transition', () => {
    const [profile] = profilesOfSession(state);
    if (profile === undefined) throw new Error('profil attendu');
    const out = planRoute(state, profile, 'entree', 'boutique', options);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const { frames, level_changes } = out.value.animation;
    expect(frames.map(f => f.level_id)).toEqual(['n0', 'n1']);
    expect(frames[0]?.decision_node_ids).toEqual(['carrefour']);
    expect(level_changes[0]).toMatchObject({ exit_node_id: 'asc0', entry_node_id: 'asc1' });
    expect(out.value.nodeKinds.get('asc0')).toBe('elevator');
  });

  it('un nœud que rien ne relie rend le refus du moteur, tel quel', () => {
    const [profile] = profilesOfSession(state);
    if (profile === undefined) throw new Error('profil attendu');
    const isolated: SessionState = { ...state, rows: [...rows, node('ile', 'n0', 50, 50)] };
    const out = planRoute(isolated, profile, 'entree', 'ile', options);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.findings[0]?.code).toBe('GRAPH.ROUTE_UNREACHABLE');
  });
});
