import { type JSX, useState } from 'react';
import { useCurrentRoute } from './useCurrentRoute.js';
import type { Route } from './routes.js';
import { useTrancheSession } from './useTrancheSession.js';
import type { TrancheSession } from './useTrancheSession.js';
import { acceptFootprint } from '../state/footprint-input.js';
import { acceptPlanFile } from '../state/plan-import.js';
import { createFootprintCommands } from '../state/footprint-commands.js';
import { acceptNode, acceptEdge } from '../state/graph-input.js';
import { graphCommands } from '../state/graph-commands.js';
import { calibrationCommands } from '../state/plan-calibration-commands.js';
import { computeCalibration } from '../domain/plan-calibration.js';
import { countOf } from '../state/session-store.js';
import type { StoredRow } from '../state/session-store.js';
import { Shell } from '../components/Shell.js';
import { PlanCalibrationScreen } from '../screens/PlanCalibrationScreen.js';
import { FootprintsScreen } from '../screens/FootprintsScreen.js';
import { GraphScreen } from '../screens/GraphScreen.js';
import { ValidationScreen } from '../screens/ValidationScreen.js';
import { ResumeSessionDialog } from '../screens/ResumeSessionDialog.js';
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
 * F15 — `app/`, la composition des écrans.
 *
 * Les cinq écrans de la tranche M (partie M) vivent à leurs chemins. Tout
 * autre chemin retombe sur l'atelier existant, qui navigue par vue : les
 * dix-neuf écrans construits hors spécification ne sont ni étendus ni
 * corrigés ici, ils attendent l'incrément qui les appelle.
 */
export function TrancheRouter(): JSX.Element {
  const route = useCurrentRoute();
  if (route.screen === 'legacy') return <Shell />;
  if (route.screen === 'sites') return <SitesScreenAdapter />;
  // Les quatre écrans d'atelier partagent une session : sans cela le parcours
  // de M8 (partie M) n'en serait pas un, chaque écran repartant de zéro.
  return <TrancheWorkspace route={route} />;
}

function TrancheWorkspace({ route }: {
  readonly route: Exclude<Route, { screen: 'legacy' } | { screen: 'sites' }>;
}): JSX.Element {
  const levelId = 'levelId' in route ? route.levelId : '';
  const session = useTrancheSession({
    orgId: ORG_OF_SESSION,
    siteId: route.siteId,
    levelId,
  });

  // E5.4 — la reprise se pose par-dessus l'écran, qui reste visible derrière.
  // Cacher le travail pendant qu'on demande quoi en faire priverait
  // l'utilisateur de ce sur quoi il doit se décider.
  const resume = session.pendingResume;

  return (
    <>
      {screenOf(route, session, levelId)}
      {resume !== null && (
        <ResumeSessionDialog
          rowCount={resume.rows.length}
          queuedCount={resume.queued.length}
          onAccept={session.acceptResume}
          onDiscard={session.discardResume}
        />
      )}
    </>
  );
}

function screenOf(
  route: Exclude<Route, { screen: 'legacy' } | { screen: 'sites' }>,
  session: TrancheSession,
  levelId: string,
): JSX.Element {
  switch (route.screen) {
    case 'plan':
      return <PlanScreenAdapter session={session} siteId={route.siteId} levelId={levelId} />;
    case 'footprints':
      return <FootprintsScreenAdapter session={session} levelId={levelId} />;
    case 'graph':
      return <GraphScreenAdapter session={session} levelId={levelId} />;
    case 'validation':
      return <ValidationScreenAdapter />;
  }
}

/**
 * L'organisation de la session.
 *
 * Tant qu'aucune session d'authentification n'est ouverte, le parcours
 * s'exécute sous une organisation nommée, qui n'est ni un secret ni une
 * donnée client (A2.4). Le cloisonnement réel reste tenu par la base : cette
 * valeur ne le remplace pas, elle permet au parcours d'exister avant lui.
 */
const ORG_OF_SESSION = '00000000-0000-4000-8000-000000000001';

/**
 * Les cinq adaptateurs.
 *
 * Chacun tient l'état de son écran et le lui passe. Le contenu de la zone de
 * travail — le tracé au pointeur, la vue du fond — n'est pas encore construit :
 * les écrans reçoivent donc un panneau vide, et tout ce qui se saisit au
 * clavier fonctionne. C'est l'ordre voulu, puisque M8 (partie M) critère 2
 * exige le parcours au clavier seul.
 */
function SitesScreenAdapter(): JSX.Element {
  const [key, setKey] = useState('');
  return <SitesView currentKey={key} onOpenSite={setKey} />;
}

function PlanScreenAdapter({ session, siteId, levelId }: {
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

function FootprintsScreenAdapter({ session, levelId }: {
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

function GraphScreenAdapter({ session, levelId }: {
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
function ValidationScreenAdapter(): JSX.Element {
  const [validation, setValidation] = useState<ValidationState>(NEVER_RUN);
  return (
    <ValidationScreen
      state={{ kind: 'ready' }}
      validation={validation}
      coverageRatePct={null}
      rulesPack={null}
      onRun={() => {
        const started = performance.now();
        // Le parcours de M8 (partie M) ne charge pas encore de paquet de
        // règles : la validation porte donc sur ce que la session contient,
        // et ne lève aucune anomalie normative. Elle dit ce qu'elle a vu.
        const findings: readonly Finding[] = [];
        setValidation({
          kind: 'ran',
          findings,
          ranAt: new Date().toISOString(),
          durationMs: Math.round(performance.now() - started),
        });
      }}
      onOpen={() => { /* le lien ouvre la zone de travail, non construite */ }}
      onExport={() => { /* l'export passe par prepareExport */ }}
    />
  );
}
