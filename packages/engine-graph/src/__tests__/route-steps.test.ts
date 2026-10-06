import { describe, it, expect } from 'vitest';
import type { Edge, GraphNode } from '@azimut/core-model';
import { routeSteps } from '../route-steps.js';

function node(id: string, level: string, kind: GraphNode['kind']): GraphNode {
  return { id, org_id: 'o', level_id: level, kind, position: { x_m: 0, y_m: 0 }, label: id.toUpperCase() };
}

function edge(id: string, from: string, to: string, length_m: number): Edge {
  return {
    id, org_id: 'o', from_node_id: from, to_node_id: to, width_m: 2, slope_pct: 0,
    accessible: true, direction: 'both', evacuation_route: false, length_m,
  };
}

const graph = {
  nodes: [
    node('entree', 'n0', 'entrance'), node('c1', 'n0', 'junction'), node('c2', 'n0', 'junction'),
    node('c3', 'n0', 'landing'), node('asc0', 'n0', 'elevator'), node('asc1', 'n1', 'elevator'),
    node('boutique', 'n1', 'destination_access'),
  ],
  edges: [
    edge('e1', 'entree', 'c1', 5), edge('e2', 'c1', 'c2', 7), edge('e3', 'c2', 'c3', 3),
    edge('e4', 'c3', 'asc0', 4), edge('e5', 'asc0', 'asc1', 4), edge('e6', 'asc1', 'boutique', 6),
  ],
};

const route = {
  from_node_id: 'entree', to_node_id: 'boutique', cost: 29,
  path: ['entree', 'c1', 'c2', 'c3', 'asc0', 'asc1', 'boutique'],
  edges: ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'],
};

describe('Partie P, écran Itinéraire — les étapes écrites, sous forme neutre', () => {
  it('chaque étape porte un code et ses paramètres, jamais une phrase (A7)', () => {
    const out = routeSteps(graph, route);
    expect(out.steps.map(s => s.instruction.key)).toEqual([
      'from', 'continue_for', 'take_elevator', 'pass_by', 'arrival',
    ]);
    expect(out.steps[0]?.instruction).toEqual({ key: 'from', label: 'ENTREE' });
  });

  it('les carrefours et paliers d’un même niveau se réunissent, avec la distance parcourue', () => {
    const out = routeSteps(graph, route);
    expect(out.steps[1]).toMatchObject({ node_id: 'c3', instruction: { key: 'continue_for', distance_m: 10 } });
  });

  it('le changement de niveau est compté et dit avec son moyen ; la distance totale est celle du chemin', () => {
    const out = routeSteps(graph, route);
    expect(out.level_changes).toBe(1);
    expect(out.total_distance_m).toBe(29);
    expect(out.steps[2]).toMatchObject({ node_id: 'asc0', instruction: { key: 'take_elevator' } });
  });
});
