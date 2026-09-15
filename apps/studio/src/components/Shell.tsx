import { type JSX, useEffect, useMemo, useState } from 'react';
import type { ViewId } from '../views.js';
import { SiteDataProvider } from '../context/SiteDataContext.js';
import { I18nProvider } from '../i18n/index.js';
import { appRepository, useSite, useSiteList } from '../data/index.js';
import { Sidebar } from './Sidebar.js';
import { HeaderBar } from './HeaderBar.js';
import { SiteGate } from './SiteGate.js';
import { ViewRouter } from './ViewRouter.js';

/** L'atelier occupe toute la surface : pas de marge, fond de plan à vif. */
function isAtelierView(view: ViewId): boolean {
  return view === 'editor' || view === 'floor-plans';
}

export function Shell(): JSX.Element {
  // Le dépôt est construit une fois : il porte l'origine de la donnée, et
  // changer d'identité en cours de session relancerait tous les chargements.
  const repository = useMemo(() => appRepository(), []);

  const [currentView, setCurrentView] = useState<ViewId>('dashboard');
  const [siteId, setSiteId] = useState('');

  const list = useSiteList(repository);
  const site = useSite(repository, siteId);

  // Aucun site ouvert : le premier de la liste l'est, pour que l'application
  // s'ouvre sur du contenu plutôt que sur un choix vide.
  useEffect(() => {
    if (siteId !== '') return;
    if (list.state.status !== 'ready') return;
    const first = list.state.value[0];
    if (first !== undefined) setSiteId(first.id);
  }, [siteId, list.state]);

  function openSite(id: string): void {
    setSiteId(id);
    setCurrentView('foundation');
  }

  function retry(): void {
    list.reload();
    site.reload();
  }

  if (site.state.status !== 'ready') {
    return (
      <I18nProvider>
        <SiteGate
          repository={repository}
          siteState={site.state}
          listState={list.state}
          onOpenSite={openSite}
          onRetry={retry}
        />
      </I18nProvider>
    );
  }

  return (
    <SiteDataProvider site={site.state.value}>
      <I18nProvider>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
          <HeaderBar onNavigate={setCurrentView} />
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
                siteKey={siteId}
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
