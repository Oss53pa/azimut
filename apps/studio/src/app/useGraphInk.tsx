import { type JSX, useMemo, useState } from 'react';
import type { Finding, GraphNode, NodeKind, Point } from '@azimut/core-model';
import { StateBanner, SPACE } from '../components/ui/index.js';
import { useI18n } from '../i18n/useI18n.js';
import type { UiMessageKey } from '../i18n/messages.js';
import { GraphView } from '../viewport/GraphView.js';
import type { GraphViewProps } from '../viewport/GraphView.js';
import { acceptEdge, acceptNode } from '../state/graph-input.js';
import { graphCommands } from '../state/graph-commands.js';
import { strokeToGraph } from '../state/graph-ink.js';
import type { GraphTool } from '../state/graph-shortcuts.js';
import { footprintsOfLevel } from '../state/session-scope.js';
import type { PointerKind } from '../editor/ink/pointer-kind.js';
import { useSketchInk } from './useSketchInk.js';
import { useStrictness } from '../editor/ink/use-strictness.js';
import { ORG_OF_SESSION } from './session-identity.js';
import type { TrancheSession } from './useTrancheSession.js';

/**
 * J1.2 (partie J) — le réseau de circulation tracé au stylet, dans l'atelier
 * du graphe (M4, partie M).
 *
 * Outil « Nœud » : un point appuyé pose un nœud du type choisi avant le geste.
 * Outil « Arête » : un trait d'un nœud à un autre les relie, avec la largeur
 * héritée du bâtiment, et le même jugement que l'outil au clavier
 * (`acceptEdge`). Chaque geste est une commande, annulable d'une frappe.
 *
 * La vue s'ajuste sur les empreintes du niveau et les nœuds : un cadrage qui
 * suivrait le seul nœud posé ferait tomber le suivant ailleurs que là où on
 * l'a tracé.
 */
export type GraphInkInputs = {
  readonly session: TrancheSession;
  readonly levelId: string;
  readonly tool: GraphTool;
  readonly nextNodeKind: NodeKind;
  readonly inheritedWidthM: number;
  readonly levelNodes: readonly GraphNode[];
  readonly onFindings: (findings: readonly Finding[]) => void;
};

export function useGraphInk(inputs: GraphInkInputs): {
  readonly zone: (view: Omit<GraphViewProps, 'ink' | 'frame' | 'viewKey' | 'sketch'>) => JSX.Element;
} {
  const { session, levelId, tool, nextNodeKind, inheritedWidthM, levelNodes, onFindings } = inputs;
  const { t } = useI18n();
  const [notice, setNotice] = useState<UiMessageKey | null>(null);
  const frame = useMemo(
    () => footprintsOfLevel(session.state, levelId).flatMap(f => f.geometry.vertices),
    [session.state, levelId],
  );

  async function write(commands: ReturnType<typeof graphCommands>): Promise<void> {
    if (!commands.ok) { onFindings(commands.findings); return; }
    await session.write(commands.value);
    onFindings([]);
  }

  // J1.3 — le niveau de redressement retenu par l'utilisateur.
  const straightening = useStrictness(`redressement-graphe-${levelId}`);

  /** Un tracé lu comme une saisie du réseau : un trait, ou une esquisse promue (J3.3). */
  function read(points: readonly Point[], pointer: PointerKind, pxPerMeter: number): void {
    const out = strokeToGraph(points, {
      tool, pointer, pxPerMeter, strictness: straightening.level,
      nodes: levelNodes.map(n => ({ id: n.id, at: n.position })),
    });
    const scope = { orgId: ORG_OF_SESSION, levelId, timestamp: session.now() };
    if (out.kind === 'not_graph_tool') { setNotice('ink.graph.not_tool'); return; }
    if (out.kind === 'unrecognized') {
      setNotice(tool === 'node' ? 'ink.graph.tap_expected' : 'ink.graph.edge_expected');
      return;
    }
    setNotice(null);
    if (out.kind === 'on_existing_node') return;
    if (out.kind === 'place_node') {
      const id = session.newId();
      const node = acceptNode({ kind: nextNodeKind, label: '', position: out.at });
      void write(graphCommands([{ id, node }], [], [], scope, `node:${id}`));
      return;
    }
    const from = levelNodes.find(n => n.id === out.fromNodeId);
    const to = levelNodes.find(n => n.id === out.toNodeId);
    if (from === undefined || to === undefined) return;
    const edge = acceptEdge({
      from: { nodeId: from.id, levelId, position: from.position, elevation_m: 0 },
      to: { nodeId: to.id, levelId, position: to.position, elevation_m: 0 },
      widthM: inheritedWidthM, slopePct: 0, accessible: true, direction: 'both',
      evacuationRoute: false, hasVerticalLink: false,
    });
    if (!edge.ok) { onFindings(edge.findings); return; }
    const id = session.newId();
    void write(graphCommands([], [{ id, edge: edge.value }], [], scope, `edge:${id}`));
  }

  // J3 — la même couche d'esquisse que dans l'atelier des empreintes : elle
  // est celle du niveau, pas celle d'un atelier.
  const sketch = useSketchInk(session, levelId, setNotice, read);

  const ink: NonNullable<GraphViewProps['ink']> = {
    onTouchRefused: () => { setNotice('ink.touch_refused'); },
    onStroke: (points, pointer, pxPerMeter, _origin, detail) => {
      if (sketch.active) { sketch.onStroke(points, detail, pxPerMeter, pointer); return; }
      if (detail.eraser) { setNotice('ink.eraser_sketch_only'); return; }
      read(points, pointer, pxPerMeter);
    },
  };

  return {
    zone: view => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm, height: '100%' }}>
        <GraphView {...view} ink={ink} frame={frame} viewKey={`graphe:${levelId}`}
          sketch={{
            strokes: sketch.strokes, selected: sketch.selected,
            toolbar: <>{straightening.control}{sketch.toolbar}</>,
          }} />
        {notice !== null && <StateBanner severity="info" message={t(notice)} />}
      </div>
    ),
  };
}
