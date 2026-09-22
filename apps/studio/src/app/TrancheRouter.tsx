import { type JSX, useEffect, useState } from 'react';
import { parseRoute } from './routes.js';
import type { Route } from './routes.js';
import { Shell } from '../components/Shell.js';
import { PlanCalibrationScreen } from '../screens/PlanCalibrationScreen.js';
import { FootprintsScreen } from '../screens/FootprintsScreen.js';
import { GraphScreen } from '../screens/GraphScreen.js';
import { ValidationScreen } from '../screens/ValidationScreen.js';
import { SitesView } from '../views/SitesView.js';
import { EMPTY_DRAFT, stepOf } from '../state/use-plan-calibration.js';
import { NEVER_RUN } from '../state/validation-report.js';
import type { ValidationState } from '../state/validation-report.js';
import type { Point } from '@azimut/core-model';
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

  switch (route.screen) {
    case 'sites':
      return <SitesScreenAdapter />;
    case 'plan':
      return <PlanScreenAdapter />;
    case 'footprints':
      return <FootprintsScreenAdapter />;
    case 'graph':
      return <GraphScreenAdapter />;
    case 'validation':
      return <ValidationScreenAdapter />;
    case 'legacy':
      return <Shell />;
  }
}

/** La route courante, tenue à jour par les retours arrière du navigateur. */
export function useCurrentRoute(): Route {
  const [route, setRoute] = useState<Route>(() =>
    parseRoute(typeof location === 'undefined' ? '/' : location.pathname));

  useEffect(() => {
    const onPop = (): void => { setRoute(parseRoute(location.pathname)); };
    window.addEventListener('popstate', onPop);
    return () => { window.removeEventListener('popstate', onPop); };
  }, []);

  return route;
}

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

function PlanScreenAdapter(): JSX.Element {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  return (
    <PlanCalibrationScreen
      state={{ kind: 'ready' }}
      draft={draft}
      step={stepOf(draft)}
      findings={[]}
      warnings={[]}
      busy={false}
      calibrated={false}
      onPickFile={plan => {
        setDraft(previous => ({
          ...previous,
          plan: { format: 'pdf', mediaType: plan.mediaType, byteSize: plan.byteSize, page: 1 },
        }));
      }}
      onDistance={metres => { setDraft(p => ({ ...p, realDistanceM: metres ?? 0 })); }}
      onAzimuth={degrees => { setDraft(p => ({ ...p, northAzimuthDeg: degrees })); }}
      onRecalibrate={() => { setDraft(EMPTY_DRAFT); }}
      onValidate={() => { /* l'écriture passe par le magasin, lot 1.2 */ }}
    />
  );
}

function FootprintsScreenAdapter(): JSX.Element {
  const [tool, setTool] = useState<FootprintTool>('cell');
  const [vertices, setVertices] = useState<readonly Point[]>([]);
  const [unitCode, setUnitCode] = useState('');
  const [kind, setKind] = useState<FootprintKind>('cell');

  return (
    <FootprintsScreen
      state={vertices.length === 0 ? { kind: 'empty' } : { kind: 'ready' }}
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
      findings={[]}
      warnings={[]}
      footprintCount={0}
      onClose={() => { /* la fermeture passe par acceptFootprint */ }}
      onAbandon={() => { setVertices([]); }}
    />
  );
}

function GraphScreenAdapter(): JSX.Element {
  const [tool, setTool] = useState<GraphTool>('node');
  const [selection, setSelection] = useState<NodeSelection | EdgeSelection | null>(null);

  return (
    <GraphScreen
      state={{ kind: 'empty' }}
      tool={tool}
      onTool={setTool}
      selection={selection}
      onNodeKind={nodeKind => {
        setSelection(s => (s?.kind === 'node' ? { ...s, nodeKind } : s));
      }}
      onNodeLabel={label => {
        setSelection(s => (s?.kind === 'node' ? { ...s, label } : s));
      }}
      onNodePosition={(axis, value) => {
        setSelection(s => (s?.kind === 'node'
          ? { ...s, position: { ...s.position, [axis]: value ?? 0 } }
          : s));
      }}
      onEdgeWidth={value => {
        setSelection(s => (s?.kind === 'edge' ? { ...s, widthM: value ?? 0 } : s));
      }}
      onEdgeSlope={value => {
        setSelection(s => (s?.kind === 'edge' ? { ...s, slopePct: value ?? 0 } : s));
      }}
      onEdgeAccessible={accessible => {
        setSelection(s => (s?.kind === 'edge' ? { ...s, accessible } : s));
      }}
      onEdgeDirection={direction => {
        setSelection(s => (s?.kind === 'edge' ? { ...s, direction } : s));
      }}
      onEdgeEvacuation={evacuationRoute => {
        setSelection(s => (s?.kind === 'edge' ? { ...s, evacuationRoute } : s));
      }}
      findings={[]}
      remedy={null}
      onApplyRemedy={() => { /* la liaison passe par graphCommands */ }}
      nodeCount={0}
      edgeCount={0}
    />
  );
}

function ValidationScreenAdapter(): JSX.Element {
  const [validation, setValidation] = useState<ValidationState>(NEVER_RUN);
  return (
    <ValidationScreen
      state={{ kind: 'ready' }}
      validation={validation}
      coverageRatePct={null}
      rulesPack={null}
      onRun={() => {
        setValidation({
          kind: 'ran', findings: [], ranAt: new Date().toISOString(), durationMs: 0,
        });
      }}
      onOpen={() => { /* le lien ouvre la zone de travail, lot suivant */ }}
      onExport={() => { /* l'export passe par prepareExport */ }}
    />
  );
}
