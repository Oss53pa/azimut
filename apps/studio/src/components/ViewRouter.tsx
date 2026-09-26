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
import { OrientationZonesView } from '../views/OrientationZonesView.js';
import { InformationLevelsView } from '../views/InformationLevelsView.js';
import { SignageView } from '../views/SignageView.js';
import { CharterView } from '../views/CharterView.js';
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
import { SiteSheetView } from '../views/SiteSheetView.js';
import { StaggeringView } from '../views/StaggeringView.js';
import { ProfilesView } from '../views/ProfilesView.js';
import { ClosuresView } from '../views/ClosuresView.js';
import { WallPlansView } from '../views/WallPlansView.js';
import { AdInventoryView } from '../views/AdInventoryView.js';
import { TenantRulesView } from '../views/TenantRulesView.js';
import { WorksiteLotsView } from '../views/WorksiteLotsView.js';
import { OpsRoundsView } from '../views/OpsRoundsView.js';
import { BudgetReferencesView } from '../views/BudgetReferencesView.js';
import { BudgetTrackingView } from '../views/BudgetTrackingView.js';
import { OpsIncidentsView } from '../views/OpsIncidentsView.js';
import { OpsDivergencesView } from '../views/OpsDivergencesView.js';
import { OpsWorkOrdersView } from '../views/OpsWorkOrdersView.js';
import { OpsFleetView } from '../views/OpsFleetView.js';
import { WorksiteSlotsView } from '../views/WorksiteSlotsView.js';
import { WorksiteReservesView } from '../views/WorksiteReservesView.js';
import { TenantInstructionView } from '../views/TenantInstructionView.js';
import { AdCreativesView } from '../views/AdCreativesView.js';
import { EvacuationView } from '../views/EvacuationView.js';
import { PlacementView } from '../views/PlacementView.js';
import { CoverageAuditView } from '../views/CoverageAuditView.js';
import { KioskAppView } from '../views/KioskAppView.js';
import { DeliverablesView } from '../views/DeliverablesView.js';

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
    case 'dashboard': return <DashboardView onNavigate={onNavigate} siteKey={siteKey} />;
    case 'product-map': return <ProductMapView onNavigate={onNavigate} />;
    case 'sites': return <SitesView currentKey={siteKey} onOpenSite={onOpenSite} />;
    case 'foundation': return <FoundationView onNavigate={onNavigate} />;
    case 'plan-calibration': return <PlanCalibrationView />;
    case 'footprints': return <FootprintsView onNavigate={onNavigate} />;
    case 'graph': return <GraphView onNavigate={onNavigate} />;
    case 'closures': return <ClosuresView />;
    case 'destinations': return <DestinationsView onNavigate={onNavigate} />;
    case 'supports': return <SupportsView onNavigate={onNavigate} />;
    case 'floor-plans': return <FloorPlansView />;
    case 'checks': return <ChecksView />;
    case 'site-sheet': return <SiteSheetView />;
    case 'message-schedule': return <MessageScheduleView />;
    case 'orientation-zones': return <OrientationZonesView />;
    case 'information-levels': return <InformationLevelsView />;
    case 'staggering': return <StaggeringView />;
    case 'placement': return <PlacementView />;
    case 'coverage-audit': return <CoverageAuditView onNavigate={onNavigate} />;
    case 'customer-flows': return <CustomerFlowsView />;
    case 'travel-profiles': return <ProfilesView />;
    case 'signage': return <SignageView onNavigate={onNavigate} />;
    case 'charter': return <CharterView siteKey={siteKey} />;
    case 'templates': return <TemplatesView onNavigate={onNavigate} />;
    case 'faces': return <FacesView />;
    case 'wall-plans': return <WallPlansView />;
    case 'evacuation': return <EvacuationView onNavigate={onNavigate} />;
    case 'proofs': return <ProofsView onNavigate={onNavigate} />;
    case 'advertising': return <AdvertisingView siteKey={siteKey} />;
    case 'ad-inventory': return <AdInventoryView siteKey={siteKey} />;
    case 'ad-creatives': return <AdCreativesView siteKey={siteKey} />;
    case 'tenant-signs': return <TenantSignsView siteKey={siteKey} />;
    case 'tenant-rules': return <TenantRulesView siteKey={siteKey} />;
    case 'tenant-instruction': return <TenantInstructionView siteKey={siteKey} />;
    case 'worksite': return <WorksiteView siteKey={siteKey} />;
    case 'worksite-lots': return <WorksiteLotsView siteKey={siteKey} />;
    case 'worksite-slots': return <WorksiteSlotsView siteKey={siteKey} />;
    case 'worksite-reserves': return <WorksiteReservesView siteKey={siteKey} />;
    case 'operations': return <OperationsView siteKey={siteKey} />;
    case 'ops-rounds': return <OpsRoundsView siteKey={siteKey} />;
    case 'ops-incidents': return <OpsIncidentsView siteKey={siteKey} />;
    case 'ops-divergences': return <OpsDivergencesView siteKey={siteKey} />;
    case 'ops-work-orders': return <OpsWorkOrdersView siteKey={siteKey} />;
    case 'ops-fleet': return <OpsFleetView siteKey={siteKey} />;
    case 'budget': return <BudgetView siteKey={siteKey} />;
    case 'budget-references': return <BudgetReferencesView siteKey={siteKey} />;
    case 'budget-tracking': return <BudgetTrackingView siteKey={siteKey} />;
    case 'portfolio': return <PortfolioView currentKey={siteKey} onOpenSite={onOpenSite} />;
    case 'cross-cutting': return <CrossCuttingView />;
    case 'editor': return <EditorView />;
    case 'kiosk-app': return <KioskAppView onNavigate={onNavigate} />;
    case 'deliverables': return <DeliverablesView onNavigate={onNavigate} />;
  }
}
