import { type JSX } from 'react';
import type { ViewId } from '../views.js';
import { DashboardView } from '../views/DashboardView.js';
import { ProductMapView } from '../views/ProductMapView.js';
import { SitesView } from '../views/SitesView.js';
import { FoundationView } from '../views/FoundationView.js';
import { PlanCalibrationView } from '../views/PlanCalibrationView.js';
import { FootprintsView } from '../views/FootprintsView.js';
import { GraphView } from '../views/GraphView.js';
import { DestinationsView } from '../views/DestinationsView.js';
import { SupportsView } from '../views/SupportsView.js';
import { FloorPlansView } from '../views/FloorPlansView.js';
import { ChecksView } from '../views/ChecksView.js';
import { MessageScheduleView } from '../views/MessageScheduleView.js';
import { TemplatesView } from '../views/TemplatesView.js';
import { FacesView } from '../views/FacesView.js';
import { ProofsView } from '../views/ProofsView.js';
import { EditorView } from '../editor/EditorView.js';

type ViewRouterProps = {
  readonly view: ViewId;
  readonly siteKey: string;
  readonly onNavigate: (view: ViewId) => void;
  readonly onOpenSite: (key: string) => void;
};

/** Un identifiant d'écran, un composant. Le routeur ne décide de rien d'autre. */
export function ViewRouter(
  { view, siteKey, onNavigate, onOpenSite }: ViewRouterProps,
): JSX.Element {
  switch (view) {
    case 'dashboard': return <DashboardView />;
    case 'product-map': return <ProductMapView onNavigate={onNavigate} />;
    case 'sites': return <SitesView currentKey={siteKey} onOpenSite={onOpenSite} />;
    case 'foundation': return <FoundationView onNavigate={onNavigate} />;
    case 'plan-calibration': return <PlanCalibrationView />;
    case 'footprints': return <FootprintsView onNavigate={onNavigate} />;
    case 'graph': return <GraphView />;
    case 'destinations': return <DestinationsView />;
    case 'supports': return <SupportsView />;
    case 'floor-plans': return <FloorPlansView />;
    case 'checks': return <ChecksView />;
    case 'message-schedule': return <MessageScheduleView />;
    case 'templates': return <TemplatesView />;
    case 'faces': return <FacesView />;
    case 'proofs': return <ProofsView />;
    case 'editor': return <EditorView />;
    default: return <DashboardView />;
  }
}
