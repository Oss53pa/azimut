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
import { CustomerFlowsView } from '../views/CustomerFlowsView.js';
import { TemplatesView } from '../views/TemplatesView.js';
import { FacesView } from '../views/FacesView.js';
import { ProofsView } from '../views/ProofsView.js';
import { AdvertisingView } from '../views/AdvertisingView.js';
import { TenantSignsView } from '../views/TenantSignsView.js';
import { WorksiteView } from '../views/WorksiteView.js';
import { OperationsView } from '../views/OperationsView.js';
import { BudgetView } from '../views/BudgetView.js';
import { PortfolioView } from '../views/PortfolioView.js';
import { CrossCuttingView } from '../views/CrossCuttingView.js';
import { EditorView } from '../editor/EditorView.js';

type ViewRouterProps = {
  readonly view: ViewId;
  readonly siteKey: string;
  readonly onNavigate: (view: ViewId) => void;
  readonly onOpenSite: (key: string) => void;
};

/**
 * Un identifiant d'écran, un composant. Le routeur ne décide de rien d'autre ;
 * l'exhaustivité du `switch` est vérifiée par le compilateur, un écran ajouté
 * à `ViewId` sans composant ne compile pas.
 */
export function ViewRouter(
  { view, siteKey, onNavigate, onOpenSite }: ViewRouterProps,
): JSX.Element {
  switch (view) {
    case 'dashboard': return <DashboardView onNavigate={onNavigate} />;
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
    case 'customer-flows': return <CustomerFlowsView />;
    case 'templates': return <TemplatesView />;
    case 'faces': return <FacesView />;
    case 'proofs': return <ProofsView />;
    case 'advertising': return <AdvertisingView />;
    case 'tenant-signs': return <TenantSignsView />;
    case 'worksite': return <WorksiteView />;
    case 'operations': return <OperationsView />;
    case 'budget': return <BudgetView />;
    case 'portfolio': return <PortfolioView currentKey={siteKey} onOpenSite={onOpenSite} />;
    case 'cross-cutting': return <CrossCuttingView />;
    case 'editor': return <EditorView />;
  }
}
