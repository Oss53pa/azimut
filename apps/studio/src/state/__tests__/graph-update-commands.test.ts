import { describe, it, expect } from 'vitest';
import type { Edge, GraphNode } from '@azimut/core-model';
import { inverseCommand } from '@azimut/core-model';
import { updateNodeCommands, updateEdgeCommands } from '../graph-update-commands.js';

/**
 * M4 (partie M) — « La longueur est recalculée à toute modification de
 * position. Un champ de longueur saisissable serait une source permanente
 * d'incohérence. »
 *
 * L'incohérence ne se voit pas à l'écran : une arête dont la longueur ne
 * correspond plus à ses extrémités a la même allure qu'une arête juste. Elle
 * se voit au premier calcul d'itinéraire, longtemps après.
 */
const CONTEXT = { orgId: 'org-1', timestamp: '2026-09-23T10:00:00.000Z' };

function node(id: string, x: number, y: number): GraphNode {
  return {
    id, org_id: 'org-1', level_id: 'lvl-1', kind: 'junction',
    position: { x_m: x, y_m: y }, label: '',
  };
}

function edge(id: string, from: string, to: string, length: number): Edge {
  return {
    id, org_id: 'org-1', from_node_id: from, to_node_id: to,
    width_m: 1.4, slope_pct: 0, accessible: true, direction: 'both',
    evacuation_route: false, length_m: length,
  };
}

const A = node('n-a', 0, 0);
const B = node('n-b', 10, 0);
const C = node('n-c', 10, 10);
const AB = edge('e-ab', 'n-a', 'n-b', 10);
const BC = edge('e-bc', 'n-b', 'n-c', 10);

describe('M4 (partie M) — modification d’un nœud', () => {
  it('rend une commande pour le nœud', () => {
    const outcome = updateNodeCommands(
      A, { kind: 'entrance', label: 'Entrée nord', position: { x_m: 0, y_m: 0 } },
      [], [A], CONTEXT, 'geste',
    );
    if (!outcome.ok) throw new Error('la modification doit être acceptée');
    expect(outcome.value).toHaveLength(1);
    expect(outcome.value[0]?.after?.['kind']).toBe('entrance');
    expect(outcome.value[0]?.after?.['label']).toBe('Entrée nord');
  });

  it('recalcule la longueur des arêtes que le déplacement touche', () => {
    const outcome = updateNodeCommands(
      B, { kind: 'junction', label: '', position: { x_m: 20, y_m: 0 } },
      [AB, BC], [A, B, C], CONTEXT, 'geste',
    );
    if (!outcome.ok) throw new Error('la modification doit être acceptée');
    const lengths = new Map(outcome.value
      .filter(c => c.table === 'edge')
      .map(c => [c.id, c.after?.['length_m']]));
    // A(0,0) à B(20,0) : vingt mètres. B(20,0) à C(10,10) : racine de 200.
    expect(lengths.get('e-ab')).toBe('20');
    expect(lengths.get('e-bc')).toBe('14.142');
  });

  /** Le contre-exemple : une arête que le nœud ne touche pas ne bouge pas. */
  it('ne touche pas une arête étrangère au nœud déplacé', () => {
    const CD = edge('e-cd', 'n-c', 'n-a', 10);
    const outcome = updateNodeCommands(
      B, { kind: 'junction', label: '', position: { x_m: 20, y_m: 0 } },
      [AB, CD], [A, B, C], CONTEXT, 'geste',
    );
    if (!outcome.ok) throw new Error('la modification doit être acceptée');
    expect(outcome.value.map(c => c.id)).not.toContain('e-cd');
  });

  it('n’écrit aucune arête quand la position ne change pas', () => {
    const outcome = updateNodeCommands(
      B, { kind: 'landing', label: '', position: B.position },
      [AB, BC], [A, B, C], CONTEXT, 'geste',
    );
    if (!outcome.ok) throw new Error('la modification doit être acceptée');
    expect(outcome.value).toHaveLength(1);
  });

  /**
   * Une arête dont l'autre extrémité est inconnue n'entre pas : sa longueur
   * n'est pas calculable, et en inventer une masquerait le nœud manquant que
   * `validateGraph` signale.
   */
  it('laisse une arête dont l’autre extrémité manque', () => {
    const orphan = edge('e-orphan', 'n-b', 'n-absent', 5);
    const outcome = updateNodeCommands(
      B, { kind: 'junction', label: '', position: { x_m: 20, y_m: 0 } },
      [orphan], [A, B], CONTEXT, 'geste',
    );
    if (!outcome.ok) throw new Error('la modification doit être acceptée');
    expect(outcome.value).toHaveLength(1);
  });

  /** E5.1 : une commande est réversible. L'inverse rend l'état de départ. */
  it('s’annule en rendant l’état de départ', () => {
    const outcome = updateNodeCommands(
      A, { kind: 'entrance', label: 'Entrée', position: { x_m: 5, y_m: 5 } },
      [], [A], CONTEXT, 'geste',
    );
    if (!outcome.ok) throw new Error('la modification doit être acceptée');
    const first = outcome.value[0];
    if (first === undefined) throw new Error('une commande est attendue');
    const undone = inverseCommand(first, CONTEXT.timestamp);
    expect(undone.after?.['kind']).toBe('junction');
    expect(undone.after?.['position']).toBe(JSON.stringify(A.position));
  });
});

describe('M4 (partie M) — modification d’une arête', () => {
  it('écrit les cinq champs du panneau, et pas la longueur', () => {
    const outcome = updateEdgeCommands(AB, {
      widthM: 2.2, slopePct: -3, accessible: false,
      direction: 'forward', evacuationRoute: true,
    }, CONTEXT, 'geste');
    if (!outcome.ok) throw new Error('la modification doit être acceptée');
    const after = outcome.value[0]?.after ?? {};
    expect(after['width_m']).toBe('2.2');
    expect(after['accessible']).toBe('false');
    expect(after['evacuation_route']).toBe('true');
    expect(after['direction']).toBe('forward');
    expect(Object.keys(after)).not.toContain('length_m');
  });
});
