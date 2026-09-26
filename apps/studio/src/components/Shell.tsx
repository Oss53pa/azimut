import { type JSX, useEffect, useMemo, useState } from 'react';
import type { ViewId } from '../views.js';
import { SiteDataProvider } from '../context/SiteDataContext.js';
import { I18nProvider } from '../i18n/index.js';
import {
  appRepository, useSite, useSiteList, useSiteVocabularyLoad, useWayfindingRegistryLoad,
} from '../data/index.js';
import { Sidebar } from './Sidebar.js';
import { HeaderBar } from './HeaderBar.js';
import { SiteGate } from './SiteGate.js';
import { ViewRouter } from './ViewRouter.js';
import { CommandPalette } from './CommandPalette.js';
import { ScreenTrail } from './ScreenTrail.js';

const COLLAPSED_KEY = 'azimut.studio.sidebar.collapsed';

/** Le menu replié est une commodité du poste : lue sans garantie. */
function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean): void {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, value ? '1' : '0');
  } catch {
    // Stockage refusé (navigation privée) : le réglage vaut pour la session.
  }
}

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
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [searching, setSearching] = useState(false);

  const list = useSiteList(repository);
  const site = useSite(repository, siteId);
  const vocabulary = useSiteVocabularyLoad(repository, siteId);
  const wayfinding = useWayfindingRegistryLoad(repository, siteId);

  // Aucun site ouvert : le premier de la liste l'est, pour que l'application
  // s'ouvre sur du contenu plutôt que sur un choix vide.
  useEffect(() => {
    if (siteId !== '') return;
    if (list.state.status !== 'ready') return;
    const first = list.state.value[0];
    if (first !== undefined) setSiteId(first.id);
  }, [siteId, list.state]);

  // Ctrl K (Cmd K) ouvre la recherche depuis n'importe quel écran.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearching(open => !open);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); };
  }, []);

  function toggleCollapsed(): void {
    setCollapsed(prev => {
      writeCollapsed(!prev);
      return !prev;
    });
  }

  function openSite(id: string): void {
    setSiteId(id);
    setCurrentView('foundation');
  }

  function retry(): void {
    list.reload();
    site.reload();
    vocabulary.reload();
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
    <SiteDataProvider
      site={site.state.value}
      vocabulary={vocabulary.state}
      wayfinding={wayfinding.state}
      onReload={site.refresh}
    >
      <I18nProvider>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
          <HeaderBar
            onNavigate={setCurrentView}
            onOpenSearch={() => { setSearching(true); }}
            sites={list.state.status === 'ready' ? list.state.value : []}
            currentSiteId={siteId}
            onOpenSite={openSite}
          />
          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            <Sidebar
              currentView={currentView}
              onNavigate={setCurrentView}
              collapsed={collapsed}
              onToggleCollapsed={toggleCollapsed}
            />
            <main style={{
              flex: 1,
              padding: isAtelierView(currentView) ? 0 : '24px 32px',
              background: isAtelierView(currentView)
                ? 'var(--surface-canvas)'
                : 'var(--surface-page)',
              overflow: 'auto',
              minWidth: 0,
            }}>
              {!isAtelierView(currentView) && (
                <ScreenTrail view={currentView} onNavigate={setCurrentView} />
              )}
              <ViewRouter
                view={currentView}
                siteKey={siteId}
                onNavigate={setCurrentView}
                onOpenSite={openSite}
              />
            </main>
          </div>
          {searching && (
            <CommandPalette
              onNavigate={setCurrentView}
              onClose={() => { setSearching(false); }}
            />
          )}
        </div>
      </I18nProvider>
    </SiteDataProvider>
  );
}
