import { type JSX, useState } from 'react';
import type { ViewId } from '../views.js';
import { SiteDataProvider } from '../context/SiteDataContext.js';
import { I18nProvider } from '../i18n/index.js';
import { allReferenceSites, refMultilevel } from '@azimut/testkit/sites';
import { Sidebar } from './Sidebar.js';
import { HeaderBar } from './HeaderBar.js';
import { ViewRouter } from './ViewRouter.js';

/** L'atelier occupe toute la surface : pas de marge, fond de plan à vif. */
function isAtelierView(view: ViewId): boolean {
  return view === 'editor' || view === 'floor-plans';
}

export function Shell(): JSX.Element {
  const [currentView, setCurrentView] = useState<ViewId>('dashboard');
  const [siteKey, setSiteKey] = useState('ref-multilevel');
  const site = allReferenceSites.get(siteKey) ?? refMultilevel;

  function openSite(key: string): void {
    setSiteKey(key);
    setCurrentView('foundation');
  }

  return (
    <SiteDataProvider site={site}>
      <I18nProvider>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
          <HeaderBar />
          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
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
              <ViewRouter
                view={currentView}
                siteKey={siteKey}
                onNavigate={setCurrentView}
                onOpenSite={openSite}
              />
            </main>
          </div>
        </div>
      </I18nProvider>
    </SiteDataProvider>
  );
}
