import { type JSX, useState } from 'react';
import type { Finding, Point } from '@azimut/core-model';
import type { TrancheSession } from './useTrancheSession.js';
import { ORG_OF_SESSION } from './session-identity.js';
import { acceptNode, acceptEdge } from '../state/graph-input.js';
import { graphCommands } from '../state/graph-commands.js';
import type { StoredRow } from '../state/session-store.js';
import { GraphScreen } from '../screens/GraphScreen.js';
import type { GraphTool, NodeSelection, EdgeSelection } from '../screens/GraphScreen.js';

/** F15 — l'adaptateur de l'écran de saisie du graphe (M4, partie M). */
export function GraphScreenAdapter({ session, levelId }: {
  readonly session: TrancheSession;
  readonly levelId: string;
}): JSX.Element {
  const [tool, setTool] = useState<GraphTool>('node');
  const [selection, setSelection] = useState<NodeSelection | EdgeSelection | null>(null);
  const [findings, setFindings] = useState<readonly Finding[]>([]);

  const nodes: readonly StoredRow[] = session.state.rows.filter(r => r.table === 'node');
  const edges: readonly StoredRow[] = session.state.rows.filter(r => r.table === 'edge');

  return (
    <GraphScreen
      state={nodes.length === 0 ? { kind: 'empty' } : { kind: 'ready' }}
      tool={tool}
      onTool={setTool}
      selection={selection}
      onNodeKind={nodeKind => { setSelection(s => (s?.kind === 'node' ? { ...s, nodeKind } : s)); }}
      onNodeLabel={label => { setSelection(s => (s?.kind === 'node' ? { ...s, label } : s)); }}
      onNodePosition={(axis, value) => {
        setSelection(s => (s?.kind === 'node'
          ? { ...s, position: { ...s.position, [axis]: value ?? 0 } }
          : s));
      }}
      onEdgeWidth={value => { setSelection(s => (s?.kind === 'edge' ? { ...s, widthM: value ?? 0 } : s)); }}
      onEdgeSlope={value => { setSelection(s => (s?.kind === 'edge' ? { ...s, slopePct: value ?? 0 } : s)); }}
      onEdgeAccessible={accessible => { setSelection(s => (s?.kind === 'edge' ? { ...s, accessible } : s)); }}
      onEdgeDirection={direction => { setSelection(s => (s?.kind === 'edge' ? { ...s, direction } : s)); }}
      onEdgeEvacuation={evacuationRoute => {
        setSelection(s => (s?.kind === 'edge' ? { ...s, evacuationRoute } : s));
      }}
      findings={findings}
      remedy={null}
      onApplyRemedy={() => { /* la liaison verticale entre avec le module 02 */ }}
      nodeCount={nodes.length}
      edgeCount={edges.length}
      onPlaceNode={() => {
        void (async () => {
          const index = nodes.length;
          const node = acceptNode({
            kind: 'junction',
            label: '',
            position: { x_m: index * 5, y_m: 0 },
          });
          const id = session.newId();
          const commands = graphCommands(
            [{ id, node }], [], [],
            { orgId: ORG_OF_SESSION, levelId, timestamp: session.now() },
            `node:${id}`,
          );
          if (!commands.ok) { setFindings(commands.findings); return; }
          await session.write(commands.value);
          setFindings([]);
        })();
      }}
      onDrawEdges={() => {
        void (async () => {
          const rows: readonly StoredRow[] = session.state.rows.filter(r => r.table === 'node');
          const drawn: { id: string; edge: ReturnType<typeof acceptEdge> }[] = [];
          for (let i = 1; i < rows.length; i += 1) {
            const from = rows[i - 1];
            const to = rows[i];
            if (from === undefined || to === undefined) continue;
            drawn.push({
              id: session.newId(),
              edge: acceptEdge({
                from: { nodeId: from.id, levelId, position: positionOf(from), elevation_m: 0 },
                to: { nodeId: to.id, levelId, position: positionOf(to), elevation_m: 0 },
                widthM: 1.4, slopePct: 0, accessible: true, direction: 'both',
                evacuationRoute: false, hasVerticalLink: false,
              }),
            });
          }
          const refused = drawn.find(d => !d.edge.ok);
          if (refused !== undefined && !refused.edge.ok) {
            setFindings(refused.edge.findings);
            return;
          }
          const commands = graphCommands(
            [],
            drawn.flatMap(d => (d.edge.ok ? [{ id: d.id, edge: d.edge.value }] : [])),
            [],
            { orgId: ORG_OF_SESSION, levelId, timestamp: session.now() },
            'edges',
          );
          if (!commands.ok) { setFindings(commands.findings); return; }
          await session.write(commands.value);
          setFindings([]);
        })();
      }}
    />
  );
}

function positionOf(row: { readonly values: Readonly<Record<string, unknown>> }): Point {
  const raw = row.values['position'];
  if (typeof raw !== 'string') return { x_m: 0, y_m: 0 };
  try {
    const parsed: unknown = JSON.parse(raw);
    const point = parsed as { x_m?: unknown; y_m?: unknown };
    return {
      x_m: typeof point.x_m === 'number' ? point.x_m : 0,
      y_m: typeof point.y_m === 'number' ? point.y_m : 0,
    };
  } catch {
    return { x_m: 0, y_m: 0 };
  }
}
