import { type JSX, useEffect, useState } from 'react';
import type { Finding, NodeKind, Point } from '@azimut/core-model';
import type { TrancheSession } from './useTrancheSession.js';
import { ORG_OF_SESSION } from './session-identity.js';
import { acceptNode, acceptEdge } from '../state/graph-input.js';
import type { EdgeRemedy } from '../state/graph-input.js';
import { acceptAxis } from '../state/graph-axis.js';
import { graphCommands } from '../state/graph-commands.js';
import { point, structured, text } from '../state/row-values.js';
import { readSessionGraph } from '../state/session-graph.js';
import { levelsOfSession } from '../state/session-scope.js';
import { inheritedEdgeWidthM } from '../state/edge-width.js';
import { graphToolForKey } from '../state/graph-shortcuts.js';
import { useVerticalLinkTool } from './useVerticalLinkTool.js';
import { updateNodeCommands, updateEdgeCommands } from '../state/graph-update-commands.js';
import { GraphView } from '../viewport/GraphView.js';
import type { GraphSelection } from '../viewport/GraphView.js';
import type { StoredRow } from '../state/session-store.js';
import { GraphScreen } from '../screens/GraphScreen.js';
import type {
  GraphTool, NodeSelection, EdgeSelection, AxisReport,
} from '../screens/GraphScreen.js';

/**
 * M4 (partie M) — l'adaptateur de la saisie du graphe.
 *
 * À part dans un fichier depuis que l'axe de circulation y est : l'écran tient
 * trois gestes — poser un nœud, tracer les arêtes, tracer un axe — et
 * `workshop-adapters.tsx` repassait au-delà des 400 lignes qu'A2.4 fixe.
 */

/**
 * L'axe proposé à l'ouverture : deux points, le minimum d'un segment.
 *
 * La zone de travail n'est pas construite, et un axe sans point de départ
 * n'aurait rien à modifier au clavier. Même raison que le contour proposé par
 * M3 (partie M).
 */
const DEFAULT_AXIS: readonly Point[] = [
  { x_m: 0, y_m: 0 }, { x_m: 10, y_m: 0 },
];

export function GraphScreenAdapter({ session, levelId }: {
  readonly session: TrancheSession;
  readonly levelId: string;
}): JSX.Element {
  const [tool, setTool] = useState<GraphTool>('node');
  const [selection, setSelection] = useState<NodeSelection | EdgeSelection | null>(null);
  const [findings, setFindings] = useState<readonly Finding[]>([]);
  // M4 (partie M) : « Le type se choisit avant le geste, jamais après. » Le
  // carrefour est le défaut parce que c'est le nœud le plus fréquent d'un
  // relevé, non parce que c'était le seul possible.
  const [nextNodeKind, setNextNodeKind] = useState<NodeKind>('junction');
  const [axis, setAxis] = useState<readonly Point[]>(DEFAULT_AXIS);
  const [axisReport, setAxisReport] = useState<AxisReport | null>(null);
  // M4 (partie M) : ce que la sélection désigne, et ce que le panneau a changé
  // sans l'avoir encore écrit. Les deux sont distincts : le panneau se remplit
  // depuis le graphe à la sélection, puis vit sa vie jusqu'à l'application.
  const [chosen, setChosen] = useState<GraphSelection | null>(null);
  const [dirty, setDirty] = useState(false);
  // M4 (partie M) : la correction que le refus propose. Elle était calculée
  // par `acceptEdge` et jetée, l'écran recevant `null` en toute circonstance.
  const [remedy, setRemedy] = useState<EdgeRemedy | null>(null);

  const graph = readSessionGraph(session.state);
  // T-1.5 — la session porte tous les niveaux du site, et non le seul niveau
  // du chemin. L'outil de liaison verticale a besoin de l'autre extrémité :
  // sans cette lecture il n'aurait rien à relier, et il ne pouvait donc pas
  // être construit.
  const { levels } = levelsOfSession(session.state);
  const level = levels.find(l => l.id === levelId);
  // M4 (partie M) : la largeur utile d'une arête est « héritée du bâtiment,
  // `building.default_edge_width_m` ». L'écran ne la choisit plus : il la lit
  // par le niveau courant, une fois, et les deux outils qui tracent des arêtes
  // la reçoivent ensemble.
  const inheritedWidthM = inheritedEdgeWidthM(session.state, levelId);
  const link = useVerticalLinkTool(session);

  /**
   * M4 (partie M) donne une touche à chacun des quatre outils. La table
   * existait en donnée et n'était liée à rien : presser `L` ne faisait rien
   * alors que la barre annonçait le contraire.
   *
   * Une touche nue ne s'applique pas dans un champ de saisie, où elle est un
   * caractère.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      const picked = graphToolForKey(event.key);
      if (picked === null) return;
      event.preventDefault();
      setTool(picked);
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); };
  }, []);

  function select(picked: GraphSelection): void {
    setChosen(picked);
    setDirty(false);
    if (picked.kind === 'node') {
      const found = graph.nodes.find(n => n.id === picked.id);
      setSelection(found === undefined ? null : {
        kind: 'node', nodeKind: found.kind, label: found.label, position: found.position,
      });
      return;
    }
    const found = graph.edges.find(e => e.id === picked.id);
    setSelection(found === undefined ? null : {
      kind: 'edge', widthM: found.width_m, slopePct: found.slope_pct,
      accessible: found.accessible, direction: found.direction,
      evacuationRoute: found.evacuation_route, lengthM: found.length_m,
    });
  }

  /**
   * M4 (partie M) — l'application des propriétés, en un geste annulable.
   *
   * Déplacer un nœud recalcule la longueur des arêtes qui le touchent, dans la
   * même commande : « La longueur est recalculée à toute modification de
   * position. » Laisser ces longueurs en l'état écrirait en base des valeurs
   * qui ne correspondent plus à leurs extrémités, et aucun écran ne le dirait.
   */
  function applyProperties(): void {
    void (async () => {
      if (chosen === null || selection === null) return;
      const write = { orgId: ORG_OF_SESSION, timestamp: session.now() };

      if (chosen.kind === 'node' && selection.kind === 'node') {
        const before = graph.nodes.find(n => n.id === chosen.id);
        if (before === undefined) return;
        const built = updateNodeCommands(before, {
          kind: selection.nodeKind, label: selection.label, position: selection.position,
        }, graph.edges, graph.nodes, write, `node:${chosen.id}`);
        if (!built.ok) { setFindings(built.findings); return; }
        await session.write(built.value);
      }

      if (chosen.kind === 'edge' && selection.kind === 'edge') {
        const before = graph.edges.find(e => e.id === chosen.id);
        if (before === undefined) return;
        const built = updateEdgeCommands(before, {
          widthM: selection.widthM, slopePct: selection.slopePct,
          accessible: selection.accessible, direction: selection.direction,
          evacuationRoute: selection.evacuationRoute,
        }, write, `edge:${chosen.id}`);
        if (!built.ok) { setFindings(built.findings); return; }
        await session.write(built.value);
      }

      setFindings([]);
      setDirty(false);
    })();
  }

  /**
   * M4 (partie M) porte sur un niveau : son chemin le nomme, et la zone de
   * travail est un plan.
   *
   * Les lignes n'étaient pas filtrées. Tant que la session n'en portait qu'un,
   * cela ne se voyait pas ; dès qu'elle en porte deux, l'écran mêlait les
   * nœuds des deux étages, l'outil « Arête » les reliait deux à deux — donc
   * entre niveaux, donc en refus — et le tracé d'axe reprenait comme
   * coïncident un nœud situé un étage plus haut.
   */
  const nodes: readonly StoredRow[] = session.state.rows.filter(
    r => r.table === 'node' && text(r.values, 'level_id') === levelId,
  );
  const onLevel = new Set(nodes.map(row => row.id));
  // Une arête ne porte pas de niveau : elle en hérite de ses extrémités. Celle
  // qui en relie deux ne se dessine dans le plan d'aucun des deux ; c'est la
  // liaison verticale qui la porte, et la barre d'état la compte.
  const edges: readonly StoredRow[] = session.state.rows.filter(r => r.table === 'edge'
    && onLevel.has(String(r.values['from_node_id'] ?? ''))
    && onLevel.has(String(r.values['to_node_id'] ?? '')));
  const levelNodes = graph.nodes.filter(node => node.level_id === levelId);
  const levelEdges = graph.edges.filter(edge =>
    onLevel.has(edge.from_node_id) && onLevel.has(edge.to_node_id));
  const levelLinks = graph.vertical_links.filter(vlink =>
    graph.edges.some(edge => edge.id === vlink.edge_id
      && (onLevel.has(edge.from_node_id) || onLevel.has(edge.to_node_id))));

  return (
    <GraphScreen
      state={nodes.length === 0 ? { kind: 'empty' } : { kind: 'ready' }}
      tool={tool}
      onTool={setTool}
      selection={selection}
      onNodeKind={nodeKind => { setDirty(true); setSelection(s => (s?.kind === 'node' ? { ...s, nodeKind } : s)); }}
      onNodeLabel={label => { setDirty(true); setSelection(s => (s?.kind === 'node' ? { ...s, label } : s)); }}
      onNodePosition={(axis, value) => {
        setDirty(true);
        setSelection(s => (s?.kind === 'node'
          ? { ...s, position: { ...s.position, [axis]: value ?? 0 } }
          : s));
      }}
      onEdgeWidth={value => { setDirty(true); setSelection(s => (s?.kind === 'edge' ? { ...s, widthM: value ?? 0 } : s)); }}
      onEdgeSlope={value => { setDirty(true); setSelection(s => (s?.kind === 'edge' ? { ...s, slopePct: value ?? 0 } : s)); }}
      onEdgeAccessible={accessible => { setDirty(true); setSelection(s => (s?.kind === 'edge' ? { ...s, accessible } : s)); }}
      onEdgeDirection={direction => { setDirty(true); setSelection(s => (s?.kind === 'edge' ? { ...s, direction } : s)); }}
      onEdgeEvacuation={evacuationRoute => {
        setDirty(true);
        setSelection(s => (s?.kind === 'edge' ? { ...s, evacuationRoute } : s));
      }}
      findings={[...findings, ...link.findings]}
      remedy={remedy}
      // M4 (partie M) : « Refus, avec proposition de créer la liaison. » La
      // proposition ouvre l'outil qui la crée, et ne se contente pas de la
      // nommer.
      onApplyRemedy={() => { setTool('vertical_link'); setRemedy(null); }}
      verticalLink={link.fields({
        levelId,
        levels,
        graph,
        fromNodeId: chosen?.kind === 'node' ? chosen.id : null,
      })}
      levelName={level?.name ?? levelId}
      nodeCount={nodes.length}
      edgeCount={edges.length}
      linkCount={levelLinks.length}
      nextNodeKind={nextNodeKind}
      onNextNodeKind={setNextNodeKind}
      axis={axis}
      onAxisPoint={(index, coordinate, value) => {
        setAxis(previous => previous.map((p, i) =>
          i === index ? { ...p, [coordinate]: value ?? 0 } : p));
      }}
      onAxisAdd={() => {
        setAxis(previous => {
          const last = previous[previous.length - 1];
          // Le point ajouté prolonge l'axe plutôt que de se poser sur le
          // dernier : deux points confondus ne feraient aucun segment, et
          // l'opérateur croirait avoir ajouté quelque chose.
          return [...previous, { x_m: (last?.x_m ?? 0) + 10, y_m: last?.y_m ?? 0 }];
        });
      }}
      onAxisRemove={() => { setAxis(previous => previous.slice(0, -1)); }}
      axisReport={axisReport}
      onApplyProperties={applyProperties}
      propertiesDirty={dirty}
      onAxisDraw={() => {
        void (async () => {
          const outcome = acceptAxis(axis, {
            nodes: nodes.flatMap((row: StoredRow) => {
              const position = positionOf(row);
              return position === null ? [] : [{ id: row.id, position }];
            }),
            edges: edges.map((row: StoredRow) => ({
              fromNodeId: String(row.values['from_node_id'] ?? ''),
              toNodeId: String(row.values['to_node_id'] ?? ''),
            })),
            levelId,
            kind: nextNodeKind,
            widthM: inheritedWidthM,
            direction: 'both',
            mintId: () => session.newId(),
          });
          if (!outcome.ok) { setFindings(outcome.findings); return; }

          const { nodes: created, edges: drawn, reused, skipped } = outcome.value;
          if (created.length > 0 || drawn.length > 0) {
            const commands = graphCommands(
              created, drawn, [],
              { orgId: ORG_OF_SESSION, levelId, timestamp: session.now() },
              `axis:${created[0]?.id ?? drawn[0]?.id ?? 'vide'}`,
            );
            if (!commands.ok) { setFindings(commands.findings); return; }
            await session.write(commands.value);
          }
          setFindings([]);
          setAxisReport({
            nodes: created.length, edges: drawn.length,
            reused: reused.length, skipped,
          });
        })();
      }}
      onPlaceNode={() => {
        void (async () => {
          const index = nodes.length;
          const node = acceptNode({
            kind: nextNodeKind,
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
          const unreadable: string[] = [];
          for (let i = 1; i < rows.length; i += 1) {
            const from = rows[i - 1];
            const to = rows[i];
            if (from === undefined || to === undefined) continue;
            const a = positionOf(from);
            const b = positionOf(to);
            // Une position illisible n'est pas remplacée par l'origine. Elle
            // l'était, et un nœud rouvert depuis le dépôt — qui porte sa
            // position déjà analysée, non en JSON — se retrouvait en (0, 0) :
            // toutes les arêtes tracées après un rechargement auraient été de
            // longueur nulle, donc refusées, sans que l'écran dise pourquoi.
            if (a === null || b === null) {
              unreadable.push(a === null ? from.id : to.id);
              continue;
            }
            drawn.push({
              id: session.newId(),
              edge: acceptEdge({
                from: { nodeId: from.id, levelId, position: a, elevation_m: 0 },
                to: { nodeId: to.id, levelId, position: b, elevation_m: 0 },
                widthM: inheritedWidthM, slopePct: 0, accessible: true, direction: 'both',
                evacuationRoute: false, hasVerticalLink: false,
              }),
            });
          }
          if (unreadable.length > 0) {
            setFindings(unreadable.map(id => ({
              code: 'EDIT.COMMAND_SHAPE_INVALID',
              severity: 'blocking',
              entity: { kind: 'node', id },
              params: {},
              ruleRef: null,
            })));
            return;
          }
          const refused = drawn.find(d => !d.edge.ok);
          if (refused !== undefined && !refused.edge.ok) {
            setFindings(refused.edge.findings);
            setRemedy(refused.edge.remedy ?? null);
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
    >
      {/*
        F15 — la zone de travail, montée ici parce que l'adaptateur sait ce
        que la session porte. M4 (partie M) veut que les nœuds se distinguent
        par leur forme et les arêtes par leur trait : c'est cette vue qui le
        rend, depuis l'encodage en donnée.
      */}
      <GraphView
        nodes={levelNodes}
        edges={levelEdges}
        selected={chosen}
        onSelect={select}
      />
    </GraphScreen>
  );
}

/**
 * La position d'un nœud, telle que la ligne la porte.
 *
 * `null` quand elle ne se lit pas. L'appelant le dit plutôt que de poser
 * l'origine : une arête tracée depuis une position inventée serait écrite en
 * base, et rien ne la distinguerait d'une arête saisie.
 */
function positionOf(row: StoredRow): Point | null {
  return point(structured(row.values, 'position'));
}
