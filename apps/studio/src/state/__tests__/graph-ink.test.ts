import { describe, it, expect } from 'vitest';
import { strokeToGraph } from '../graph-ink.js';
import type { GraphStrokeContext } from '../graph-ink.js';
import { stroke } from '../../editor/ink/__tests__/ink-fixtures.js';

const nodes = [{ id: 'n-1', at: { x_m: 0, y_m: 0 } }, { id: 'n-2', at: { x_m: 10, y_m: 0 } }];

const context = (overrides: Partial<GraphStrokeContext> = {}): GraphStrokeContext => ({
  tool: 'node', pointer: 'pen', pxPerMeter: 20, strictness: 'normal', nodes, ...overrides,
});

const tapAt = (x_m: number, y_m: number) => [{ x_m, y_m }, { x_m: x_m + 0.01, y_m }];

describe('J1.2 — le réseau de circulation au stylet', () => {
  it('outil Nœud : un point appuyé pose un nœud, au millimètre', () => {
    expect(strokeToGraph(tapAt(5.00031, 3.99968), context())).toEqual({ kind: 'place_node', at: { x_m: 5.005, y_m: 4 } });
  });

  it('outil Nœud : un point appuyé sur un nœud posé n’en pose pas un second', () => {
    expect(strokeToGraph(tapAt(10.05, 0), context())).toEqual({ kind: 'on_existing_node', nodeId: 'n-2' });
  });

  it('outil Arête : un trait d’un nœud à l’autre les relie, même tremblant', () => {
    const drawn = stroke({ x_m: 0.2, y_m: 0.1 }, { x_m: 9.8, y_m: -0.2 }, 30, 0.4);
    expect(strokeToGraph(drawn, context({ tool: 'edge' }))).toEqual({ kind: 'draw_edge', fromNodeId: 'n-1', toNodeId: 'n-2' });
  });

  it('outil Arête : un trait qui ne part pas d’un nœud ne relie rien', () => {
    const drawn = stroke({ x_m: 3, y_m: 3 }, { x_m: 9.8, y_m: 0 });
    expect(strokeToGraph(drawn, context({ tool: 'edge' }))).toEqual({ kind: 'unrecognized' });
  });

  it('outil Nœud : un trait n’est pas un point appuyé', () => {
    expect(strokeToGraph(stroke({ x_m: 2, y_m: 2 }, { x_m: 6, y_m: 2 }), context())).toEqual({ kind: 'unrecognized' });
  });

  it('les outils Axe et Liaison verticale ne lisent pas le trait', () => {
    expect(strokeToGraph(tapAt(1, 1), context({ tool: 'axis' }))).toEqual({ kind: 'not_graph_tool' });
    expect(strokeToGraph(tapAt(1, 1), context({ tool: 'vertical_link' }))).toEqual({ kind: 'not_graph_tool' });
  });
});
