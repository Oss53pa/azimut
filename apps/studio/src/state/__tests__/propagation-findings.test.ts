import { describe, it, expect } from 'vitest';
import type { EntityCommand, Finding } from '@azimut/core-model';
import { introducedBy } from '../propagation-findings.js';

const NODE = 'aaaaaaaa-0000-4000-8000-0000000000e1';
const OTHER = 'aaaaaaaa-0000-4000-8000-0000000000e2';
const EDGE = 'aaaaaaaa-0000-4000-8000-0000000000f1';

const orphan = (id: string): Finding => ({
  code: 'GRAPH.NODE_ORPHAN', severity: 'blocking', entity: { kind: 'node', id }, params: {}, ruleRef: 'A7',
});
const warning: Finding = { code: 'GEOM.FOOTPRINTS_OVERLAP', severity: 'warning', entity: null, params: {}, ruleRef: null };

function command(id: string, table: string, before: Record<string, unknown> | null): EntityCommand {
  return {
    operation: before === null ? 'create' : 'delete', module: '01-socle', table, id,
    org_id: NODE, before: before as EntityCommand['before'], after: null,
    timestamp: '2026-11-24T10:00:00.000Z', groupKey: null,
  } as EntityCommand;
}

describe('S6.5 — les anomalies qu’une propagation introduit, et leurs commandes', () => {
  it('une arête retirée rend un nœud orphelin : la commande qui citait le nœud est nommée', () => {
    const received = [
      { seq: 41, command: command(OTHER, 'node', null) },
      { seq: 42, command: command(EDGE, 'edge', { from_node_id: NODE, to_node_id: OTHER }) },
    ];
    expect(introducedBy([], [orphan(NODE)], received)).toEqual([
      { ...orphan(NODE), params: { commands: '42' } },
    ]);
  });

  it('une anomalie déjà là avant la propagation n’est pas imputée', () => {
    const received = [{ seq: 7, command: command(NODE, 'node', null) }];
    expect(introducedBy([orphan(NODE)], [orphan(NODE)], received)).toEqual([]);
  });

  it('aucune commande ne touche l’objet : le lot entier est nommé, dans l’ordre du journal', () => {
    const received = [
      { seq: 9, command: command(OTHER, 'node', null) },
      { seq: 8, command: command(EDGE, 'edge', null) },
    ];
    expect(introducedBy([], [orphan(NODE)], received)[0]?.params['commands']).toBe('8,9');
  });

  it('les avertissements ne bloquent rien et ne sont pas rendus ; sans réception, rien', () => {
    const received = [{ seq: 1, command: command(NODE, 'node', null) }];
    expect(introducedBy([], [warning], received)).toEqual([]);
    expect(introducedBy([], [orphan(NODE)], [])).toEqual([]);
  });
});
