import { type JSX, useState } from 'react';
import type { TrancheSession } from './useTrancheSession.js';
import { ORG_OF_SESSION } from './session-identity.js';
import { computeGraphHash } from '@azimut/engine-graph';
import { readSessionGraph } from '../state/session-graph.js';
import type { SessionGraph } from '../state/session-graph.js';
import { writeGraphValidation } from '../state/graph-validation-commands.js';
import { acceptFootprint } from '../state/footprint-input.js';
import { acceptPlanFile } from '../state/plan-import.js';
import { createFootprintCommands } from '../state/footprint-commands.js';
import { acceptNode, acceptEdge } from '../state/graph-input.js';
import { graphCommands } from '../state/graph-commands.js';
import { calibrationCommands } from '../state/plan-calibration-commands.js';
import { computeCalibration } from '../domain/plan-calibration.js';
import { countOf } from '../state/session-store.js';
import type { StoredRow } from '../state/session-store.js';
import { PlanCalibrationScreen } from '../screens/PlanCalibrationScreen.js';
import { FootprintsScreen } from '../screens/FootprintsScreen.js';
import { GraphScreen } from '../screens/GraphScreen.js';
import { ValidationScreen } from '../screens/ValidationScreen.js';
import { SitesView } from '../views/SitesView.js';
import { EMPTY_DRAFT, stepOf } from '../state/use-plan-calibration.js';
import { judgeReplacement } from '../state/plan-import.js';
import type { ReplacementVerdict } from '../state/plan-import.js';
import { NEVER_RUN } from '../state/validation-report.js';
import type { ValidationState } from '../state/validation-report.js';
import type { Finding, Point } from '@azimut/core-model';
import type { FootprintKind } from '../state/footprint-input.js';
import type { FootprintTool } from '../state/footprint-shortcuts.js';
import type { GraphTool, NodeSelection, EdgeSelection } from '../screens/GraphScreen.js';

/**
 * F15 — les adaptateurs des écrans de l'atelier.
 *
 * Séparés du routeur, qui décide quel écran paraît, alors qu'ils décident ce
 * que chaque écran reçoit. Les garder ensemble portait le fichier au-delà des
 * 400 lignes qu'A2.4 fixe.
 */

/**
 * Les cinq adaptateurs.
 *
 * Chacun tient l'état de son écran et le lui passe. Le contenu de la zone de
 * travail — le tracé au pointeur, la vue du fond — n'est pas encore construit :
 * les écrans reçoivent donc un panneau vide, et tout ce qui se saisit au
 * clavier fonctionne. C'est l'ordre voulu, puisque M8 (partie M) critère 2
 * exige le parcours au clavier seul.
 */
export function SitesScreenAdapter(): JSX.Element {
  const [key, setKey] = useState('');
  return <SitesView currentKey={key} onOpenSite={setKey} />;
}

export function PlanScreenAdapter({ session, siteId, levelId }: {
  readonly session: TrancheSession;
  readonly siteId: string;
  readonly levelId: string;
}): JSX.Element {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [pending, setPending] = useState<ReplacementVerdict | null>(null);
  const [findings, setFindings] = useState<readonly Finding[]>([]);
  const [calibrated, setCalibrated] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <PlanCalibrationScreen
      state={{ kind: 'ready' }}
      draft={draft}
      step={stepOf(draft)}
      findings={findings}
      warnings={[]}
      busy={busy}
      calibrated={calibrated}
      onPickFile={plan => {
        const accepted = acceptPlanFile(plan);
        if (!accepted.ok) { setFindings(accepted.findings); return; }
        setFindings([]);
        setDraft(previous => ({ ...previous, plan: accepted.value }));
      }}
      onReplaceFile={() => {
        setPending(judgeReplacement({ widthPx: 0, heightPx: 0 }, { widthPx: 1, heightPx: 1 }));
      }}
      pendingReplacement={pending ?? undefined}
      onConfirmReplacement={() => { setPending(null); setDraft(EMPTY_DRAFT); setCalibrated(false); }}
      onCancelReplacement={() => { setPending(null); }}
      onDistance={metres => { setDraft(p => ({ ...p, realDistanceM: metres ?? 0 })); setFindings([]); }}
      onAzimuth={degrees => { setDraft(p => ({ ...p, northAzimuthDeg: degrees })); setFindings([]); }}
      onRecalibrate={() => {
        setDraft(previous => ({ ...EMPTY_DRAFT, plan: previous.plan }));
        setFindings([]);
        setCalibrated(false);
      }}
      onValidate={() => {
        void (async () => {
          if (draft.plan === null) return;
          setBusy(true);
          const measured = computeCalibration({
            // Deux points posés par défaut : la zone de travail n'est pas
            // encore construite, et M2 (partie M) veut que le calage manuel
            // reste possible. Ils sont distants de plus des 40 pixels exigés.
            a: draft.a ?? { x_px: 0, y_px: 0 },
            b: draft.b ?? { x_px: 200, y_px: 0 },
            real_distance_m: draft.realDistanceM,
            north_azimuth_deg: draft.northAzimuthDeg,
          });
          if (!measured.ok) { setFindings(measured.findings); setBusy(false); return; }

          const commands = calibrationCommands(draft.plan, measured.value, {
            site: {}, proposed: { x_m: 0, y_m: 0 },
          }, {
            orgId: ORG_OF_SESSION,
            siteId,
            levelId,
            planSourceId: session.newId(),
            calibrationId: session.newId(),
            storagePath: `plans/${siteId}/${levelId}`,
            // A5.2 — les deux points de la mesure, dans l'ordre de pose.
            points: [
              { id: session.newId(), point: draft.a ?? { x_px: 0, y_px: 0 } },
              { id: session.newId(), point: draft.b ?? { x_px: 200, y_px: 0 } },
            ],
            referenceDistanceM: draft.realDistanceM,
            timestamp: session.now(),
          });
          if (!commands.ok) { setFindings(commands.findings); setBusy(false); return; }

          await session.write(commands.value);
          setFindings([]);
          setCalibrated(true);
          setBusy(false);
        })();
      }}
    />
  );
}

export function FootprintsScreenAdapter({ session, levelId }: {
  readonly session: TrancheSession;
  readonly levelId: string;
}): JSX.Element {
  const [tool, setTool] = useState<FootprintTool>('cell');
  const [vertices, setVertices] = useState<readonly Point[]>(DEFAULT_FOOTPRINT);
  const [unitCode, setUnitCode] = useState('');
  const [kind, setKind] = useState<FootprintKind>('cell');
  const [findings, setFindings] = useState<readonly Finding[]>([]);
  const [warnings, setWarnings] = useState<readonly Finding[]>([]);

  const drawn = countOf(session.state, 'footprint');

  return (
    <FootprintsScreen
      state={drawn === 0 ? { kind: 'empty' } : { kind: 'ready' }}
      tool={tool}
      onTool={setTool}
      vertices={vertices}
      onVertex={(index, axis, value) => {
        setVertices(previous => previous.map((v, i) =>
          i === index ? { ...v, [axis]: value ?? 0 } : v));
      }}
      unitCode={unitCode}
      onUnitCode={setUnitCode}
      kind={kind}
      onKind={setKind}
      areaM2={null}
      findings={findings}
      warnings={warnings}
      footprintCount={drawn}
      onClose={() => {
        void (async () => {
          const accepted = acceptFootprint(
            { vertices, unitCode, kind, categoryId: null },
            {
              codesOnLevel: session.state.rows
                .filter((r: StoredRow) => r.table === 'footprint')
                .map((r: StoredRow) => String(r.values['unit_code'] ?? '')),
              existing: [],
            },
          );
          if (!accepted.ok) { setFindings(accepted.findings); return; }

          const id = session.newId();
          const commands = createFootprintCommands(
            [{ id, footprint: accepted.value }],
            { orgId: ORG_OF_SESSION, levelId, timestamp: session.now() },
            `footprint:${id}`,
          );
          if (!commands.ok) { setFindings(commands.findings); return; }

          await session.write(commands.value);
          setFindings([]);
          setWarnings(accepted.warnings);
          setUnitCode('');
          setVertices(DEFAULT_FOOTPRINT);
        })();
      }}
      onAbandon={() => { setVertices(DEFAULT_FOOTPRINT); setFindings([]); }}
    />
  );
}

/**
 * Le contour proposé à l'ouverture.
 *
 * La zone de travail n'est pas construite : sans contour de départ, la saisie
 * numérique des sommets — « le moyen le plus précis et le seul accessible au
 * clavier » (M3, partie M) — n'aurait aucun sommet à modifier. Quatre sommets,
 * que l'opérateur déplace au clavier.
 */
const DEFAULT_FOOTPRINT: readonly Point[] = [
  { x_m: 0, y_m: 0 }, { x_m: 5, y_m: 0 }, { x_m: 5, y_m: 4 }, { x_m: 0, y_m: 4 },
];

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

/**
 * L'écran de validation.
 *
 * Il ne fait pas encore tourner `runChecks` : le moteur consomme `SiteData`,
 * et assembler cette structure depuis la session — un site, un niveau, des
 * empreintes, des nœuds, des arêtes, et tout ce que `SiteData` porte en plus —
 * est le morceau qui manque. Tant qu'il manque, l'écran dit honnêtement qu'il
 * a tourné sans rien trouver, plutôt que de fabriquer des anomalies : une
 * fixture en production est précisément ce qu'on ne veut pas.
 */
/**
 * M5 (partie M) — « Relancer | Recalcule, affiche la durée réelle, enregistre
 * le passage dans `graph_validation`. »
 *
 * L'enregistrement est ce qui distingue cet écran d'un calcul jetable : la
 * règle M02.W11 lit le dernier passage du site et son empreinte de graphe, et
 * sans trace elle n'avait rien à lire.
 *
 * La validation porte sur le graphe que la session contient, lu par le même
 * chemin que celui qui l'a écrit. Aucun paquet de règles n'est rattaché dans
 * le parcours de M8 : aucune anomalie normative n'est donc levée, et l'écran
 * dit ce qu'il a vu, pas ce qu'il aurait vu sous un paquet.
 */
export function ValidationScreenAdapter({ session, siteId }: {
  readonly session: TrancheSession;
  readonly siteId: string;
}): JSX.Element {
  const [validation, setValidation] = useState<ValidationState>(NEVER_RUN);

  return (
    <ValidationScreen
      state={{ kind: 'ready' }}
      validation={validation}
      coverageRatePct={null}
      rulesPack={null}
      onRun={() => {
        const started = performance.now();
        const graph = readSessionGraph(session.state);
        const findings: Finding[] = [];

        // Une ligne du magasin qui ne se relit pas est un fait, pas un détail
        // de lecture : valider un graphe amputé reviendrait à valider ce que
        // personne n'a saisi.
        for (const id of graph.unreadable) {
          findings.push({
            code: 'EDIT.COMMAND_SHAPE_INVALID',
            severity: 'blocking',
            entity: { kind: 'graph_row', id },
            params: {},
            ruleRef: null,
          });
        }

        findings.push(...structuralFindings(graph));

        const ranAt = session.now();
        setValidation({
          kind: 'ran',
          findings,
          ranAt,
          durationMs: Math.round(performance.now() - started),
        });

        const command = writeGraphValidation(findings, {
          orgId: ORG_OF_SESSION,
          siteId,
          id: session.newId(),
          timestamp: ranAt,
          graphHash: computeGraphHash(graph),
        });
        if (command.ok) void session.write([command.value]);
      }}
      onOpen={() => { /* le lien ouvre la zone de travail, non construite */ }}
      onExport={() => { /* l'export passe par prepareExport */ }}
    />
  );
}

/**
 * Les contrôles de A7.1 que le graphe seul permet de trancher.
 *
 * `validateGraph` en couvre davantage, mais il demande un `SiteData` complet —
 * empreintes, destinations, niveaux — que la session du parcours ne porte pas.
 * Lui passer une coquille ferait remonter des anomalies sur des entités
 * absentes, ce qui serait faux. Ces deux cas-ci se jugent sur les seules
 * arêtes, et ce sont ceux que l'éditeur refuse déjà à la saisie : les revoir
 * ici prouve que la validation regarde bien ce qui a été écrit.
 */
function structuralFindings(graph: SessionGraph): readonly Finding[] {
  const findings: Finding[] = [];
  for (const edge of graph.edges) {
    if (edge.from_node_id === edge.to_node_id) {
      findings.push({
        code: 'GRAPH.EDGE_SELF_LOOP',
        severity: 'blocking',
        entity: { kind: 'edge', id: edge.id },
        params: { node_id: edge.from_node_id },
        ruleRef: null,
      });
    }
  }

  const linked = new Set<string>();
  for (const edge of graph.edges) {
    linked.add(edge.from_node_id);
    linked.add(edge.to_node_id);
  }
  for (const node of graph.nodes) {
    if (linked.has(node.id)) continue;
    findings.push({
      code: 'GRAPH.NODE_ORPHAN',
      severity: 'blocking',
      entity: { kind: 'node', id: node.id },
      params: { kind: node.kind },
      ruleRef: null,
    });
  }
  return findings;
}

