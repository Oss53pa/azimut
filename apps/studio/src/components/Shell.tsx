import { type JSX, useState } from 'react';
import type { ViewId } from '../views.js';
import { Sidebar } from './Sidebar.js';
import { DashboardView } from '../views/DashboardView.js';
import { GraphView } from '../views/GraphView.js';
import { DestinationsView } from '../views/DestinationsView.js';
import { SupportsView } from '../views/SupportsView.js';
import { TemplatesView } from '../views/TemplatesView.js';
import { FloorPlansView } from '../views/FloorPlansView.js';
import { FacesView } from '../views/FacesView.js';
import { ChecksView } from '../views/ChecksView.js';
import { ProofsView } from '../views/ProofsView.js';

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
  }
}

export function Shell(): JSX.Element {
  const [currentView, setCurrentView] = useState<ViewId>('dashboard');

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    }}>
      <Sidebar currentView={currentView} onNavigate={setCurrentView} />
      <main style={{
        flex: 1,
        padding: 24,
        background: 'var(--az-main-bg)',
        overflow: 'auto',
      }}>
        {renderView(currentView)}
      </main>
    </div>
  );
}
