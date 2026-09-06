import { type JSX, useState } from 'react';
import type { ViewId } from '../views.js';
import { SiteDataProvider } from '../context/SiteDataContext.js';
import { refMultilevel } from '@azimut/testkit/sites';
import { Sidebar } from './Sidebar.js';
import { HeaderBar } from './HeaderBar.js';
import { DashboardView } from '../views/DashboardView.js';
import { GraphView } from '../views/GraphView.js';
import { DestinationsView } from '../views/DestinationsView.js';
import { SupportsView } from '../views/SupportsView.js';
import { TemplatesView } from '../views/TemplatesView.js';
import { FloorPlansView } from '../views/FloorPlansView.js';
import { FacesView } from '../views/FacesView.js';
import { ChecksView } from '../views/ChecksView.js';
import { ProofsView } from '../views/ProofsView.js';
import { EditorView } from '../editor/EditorView.js';

function renderView(view: ViewId): JSX.Element {
  switch (view) {
    case 'dashboard': return <DashboardView />;
    case 'graph': return <GraphView />;
    case 'destinations': return <DestinationsView />;
    case 'supports': return <SupportsView />;
    case 'templates': return <TemplatesView />;
    case 'floor-plans': return <FloorPlansView />;
    case 'faces': return <FacesView />;
    case 'checks': return <ChecksView />;
    case 'proofs': return <ProofsView />;
    case 'editor': return <EditorView />;
  }
}

/** Whether the view uses the full-bleed Atelier layout (no padding). */
function isAtelierView(view: ViewId): boolean {
  return view === 'editor' || view === 'floor-plans';
}

export function Shell(): JSX.Element {
  const [currentView, setCurrentView] = useState<ViewId>('dashboard');

  return (
    <SiteDataProvider site={refMultilevel}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}>
        <HeaderBar />
        <div style={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
        }}>
          <Sidebar currentView={currentView} onNavigate={setCurrentView} />
          <main style={{
            flex: 1,
            padding: isAtelierView(currentView) ? 0 : '20px 24px',
            background: isAtelierView(currentView)
              ? 'var(--surface-canvas)'
              : 'var(--surface-page)',
            overflow: 'auto',
            minWidth: 0,
          }}>
            {renderView(currentView)}
          </main>
        </div>
      </div>
    </SiteDataProvider>
  );
}
