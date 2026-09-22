import { describe, it, expect } from 'vitest';
import { graphCommands } from '../graph-commands.js';
import type { GraphWrite, NodeRow, EdgeRow, VerticalLinkRow } from '../graph-commands.js';
import { acceptNode, acceptEdge, unfoldAxis } from '../graph-input.js';
import type { EdgeEndpoint } from '../graph-input.js';
import { EMPTY_STORE, dispatch, undo } from '../command-store.js';
import type { CommandSink } from '../command-store.js';

const WRITE: GraphWrite = {
  orgId: 'aaaaaaaa-0000-0000-0000-000000000001',
  levelId: 'level-1',
  timestamp: '2026-09-22T10:00:00.000Z',
};

function endpoint(id: string, x: number, level = 'level-1', elevation = 0): EdgeEndpoint {
  return { nodeId: id, levelId: level, position: { x_m: x, y_m: 0 }, elevation_m: elevation };
}

function acceptedEdge(from: string, to: string, x: number): EdgeRow['edge'] {
  const r = acceptEdge({
    from: endpoint(from, 0), to: endpoint(to, x),
    widthM: 1.4, slopePct: 0, accessible: true, direction: 'both',
    evacuationRoute: false, hasVerticalLink: false,
  });
  if (!r.ok) throw new Error(r.findings.map(f => f.code).join(','));
  return r.value;
}

function nodeRows(count: number): readonly NodeRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `n-${String(i + 1)}`,
    node: acceptNode({ kind: 'junction', label: '', position: { x_m: i * 10, y_m: 0 } }),
  }));
}

function accepting(): { sink: CommandSink; seen: string[][] } {
  const seen: string[][] = [];
  const sink: CommandSink = async (commands) => {
    seen.push(commands.map(c => c.table));
    return { ok: true, value: null, warnings: [] };
  };
  return { sink, seen };
}

describe('M4 (partie M) — écriture du graphe', () => {
  const edges: readonly EdgeRow[] = [{ id: 'e-1', edge: acceptedEdge('n-1', 'n-2', 10) }];

  it('n’écrit que des tables du module 01', () => {
    const r = graphCommands(nodeRows(2), edges, [], WRITE, 'axe');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.every(c => c.module === '01-socle')).toBe(true);
  });

  /** Les nœuds avant les arêtes qui les citent : les clés étrangères l'exigent. */
  it('range les commandes dans l’ordre des dépendances', () => {
    const links: readonly VerticalLinkRow[] = [
      { id: 'vl-1', edgeId: 'e-1', kind: 'stair', accessible: false, capacity: null },
    ];
    const r = graphCommands(nodeRows(2), edges, links, WRITE, 'axe');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.map(c => c.table)).toEqual(['node', 'node', 'edge', 'vertical_link']);
  });

  it('écrit la longueur calculée, non une valeur saisie', () => {
    const r = graphCommands(nodeRows(2), edges, [], WRITE, 'axe');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value[2]?.after?.['length_m']).toBe('10');
  });

  /**
   * M4 (partie M) : « Tracé continu produisant nœuds et arêtes en une passe. »
   * Une passe, un geste, une annulation.
   */
  it('un axe s’écrit et s’annule d’un seul geste', async () => {
    const axis = unfoldAxis([
      { position: { x_m: 0, y_m: 0 }, existingNodeId: null },
      { position: { x_m: 10, y_m: 0 }, existingNodeId: null },
      { position: { x_m: 20, y_m: 0 }, existingNodeId: null },
    ]);
    expect(axis.segments.length).toBe(2);

    const nodes = nodeRows(3);
    const axisEdges: readonly EdgeRow[] = axis.segments.map((_, i) => ({
      id: `e-${String(i + 1)}`,
      edge: acceptedEdge(`n-${String(i + 1)}`, `n-${String(i + 2)}`, 10),
    }));

    const r = graphCommands(nodes, axisEdges, [], WRITE, 'axe');
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const { sink, seen } = accepting();
    const written = await dispatch(EMPTY_STORE, sink, r.value);
    expect(written.state.undoStack.length).toBe(1);
    expect(seen[0]).toEqual(['node', 'node', 'node', 'edge', 'edge']);

    const undone = await undo(written.state, sink, '2026-09-22T10:00:05.000Z');
    expect(undone.outcome.ok).toBe(true);
    // Les arêtes se défont avant les nœuds qu'elles citent.
    expect(seen[1]).toEqual(['edge', 'edge', 'node', 'node', 'node']);
  });

  it('groupe tout sous un même geste', () => {
    const r = graphCommands(nodeRows(3), edges, [], WRITE, 'axe');
    expect(r.ok).toBe(true);
    if (r.ok) expect(new Set(r.value.map(c => c.groupKey))).toEqual(new Set(['axe']));
  });
});
