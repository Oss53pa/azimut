import { type JSX, useEffect } from 'react';
import { useCurrentRoute } from './useCurrentRoute.js';
import type { Route } from './routes.js';
import { useTrancheSession } from './useTrancheSession.js';
import type { TrancheSession } from './useTrancheSession.js';
import { Shell } from '../components/Shell.js';
import { ResumeSessionDialog } from '../screens/ResumeSessionDialog.js';
import { MessageTableAdapter } from './MessageTableAdapter.js';
import { ACTOR_OF_SESSION, ORG_OF_SESSION } from './session-identity.js';
import {
  SitesScreenAdapter, PlanScreenAdapter, FootprintsScreenAdapter,
  GraphScreenAdapter, ValidationScreenAdapter,
} from './workshop-adapters.js';

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
  // Partie R : l'écran du tableau des messages est de la famille Registre et
  // porte sur le site, non sur un niveau. Il n'entre donc pas dans l'atelier,
  // dont les quatre écrans partagent une session par niveau.
  if (route.screen === 'messages') {
    return <MessageTableAdapter siteId={route.siteId} actor={ACTOR_OF_SESSION} />;
  }
  // Les quatre écrans d'atelier partagent une session : sans cela le parcours
  // de M8 (partie M) n'en serait pas un, chaque écran repartant de zéro.
  return <TrancheWorkspace route={route} />;
}

function TrancheWorkspace({ route }: {
  readonly route: WorkshopRoute;
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

  /**
   * E5.2 et M3 (partie M) — `Ctrl+Z` annule, `Ctrl+Maj+Z` rétablit.
   *
   * La liaison est posée ici et non dans chaque écran : la portée de la pile
   * est « le site en cours d'édition », et deux liaisons concurrentes
   * annuleraient deux gestes pour une frappe. Un champ de saisie garde la
   * sienne : annuler une frappe n'est pas annuler un geste d'édition.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      void (event.shiftKey ? session.redo() : session.undo());
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); };
  }, [session]);

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

type WorkshopRoute = Exclude<
  Route,
  { screen: 'legacy' } | { screen: 'sites' } | { screen: 'messages' }
>;

function screenOf(
  route: WorkshopRoute,
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



