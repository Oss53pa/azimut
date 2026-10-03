import { type JSX, useCallback, useEffect, useMemo } from 'react';
import { useCurrentRoute, navigateTo } from './useCurrentRoute.js';
import { buildPath } from './routes.js';
import type { Route } from './routes.js';
import { useTrancheSession } from './useTrancheSession.js';
import type { TrancheSession } from './useTrancheSession.js';
import { Shell } from '../components/Shell.js';
import { StateBanner } from '../components/ui/index.js';
import { useI18n } from '../i18n/useI18n.js';
import { ResumeSessionDialog } from '../screens/ResumeSessionDialog.js';
import { LevelBar } from '../screens/LevelBar.js';
import { levelsOfSession } from '../state/session-scope.js';
import { buildingNames } from '../state/session-buildings.js';
import { MessageTableAdapter } from './MessageTableAdapter.js';
import { ACTOR_OF_SESSION, ORG_OF_SESSION } from './session-identity.js';
import { appSink } from '../state/app-sink.js';
import { sessionFromSite } from '../state/session-from-site.js';
import { appRepository, isRepositoryError } from '../data/index.js';
import { PlanScreenAdapter } from './PlanAdapter.js';
import { FootprintsScreenAdapter } from './FootprintsAdapter.js';
import { GraphScreenAdapter } from './GraphAdapter.js';
import { ValidationScreenAdapter } from './ValidationAdapter.js';
import { SitesAdapter } from './SitesAdapter.js';
import { SiteRecordScreenAdapter } from './SiteRecordAdapter.js';

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
  if (route.screen === 'sites') return <SitesAdapter />;
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
  const { t } = useI18n();
  const levelId = 'levelId' in route ? route.levelId : '';
  // Le chemin d'écriture réel dès que le dépôt est configuré. Sans
  // configuration, `appSink` rend `null` et la session retombe sur son
  // émetteur local — le cas hors ligne de M8 (partie M) critère 3.
  const remote = useMemo(() => appSink() ?? undefined, []);

  /**
   * E5.4 — le second terme du choix de reprise : ce que le dépôt porte.
   *
   * Un site que le dépôt ne connaît pas rend `null` plutôt qu'une défaillance :
   * c'est le cas d'un site créé hors ligne, et l'atelier s'ouvre alors vide.
   * Toute autre défaillance remonte, et la session la signale.
   */
  const repository = useMemo(() => appRepository(), []);
  const load = useCallback(async () => {
    try {
      return sessionFromSite(await repository.loadSite(route.siteId));
    } catch (cause: unknown) {
      if (isRepositoryError(cause) && cause.failure === 'not_found') return null;
      throw cause;
    }
  }, [repository, route.siteId]);

  const session = useTrancheSession({
    orgId: ORG_OF_SESSION,
    siteId: route.siteId,
    levelId,
  }, remote, load);

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
      {/*
        F7 (partie F) — un site vide et un site illisible ne se ressemblent
        pas. Quand le dépôt n'a pas pu être lu, l'atelier le dit au lieu de
        laisser croire que le site ne porte rien.
      */}
      {session.loadFailed && (
        <StateBanner severity="blocking" message={t('session.load.failed')} />
      )}
      {/*
        T-1.5 — les niveaux du site, et le passage de l'un à l'autre. Posé ici
        et non dans un écran : les quatre écrans d'atelier portent sur un
        niveau, et une barre par écran en ferait quatre à tenir d'accord.
        L'écran de validation porte sur le site entier et n'en reçoit pas.
      */}
      {route.screen !== 'validation' && route.screen !== 'record' && (
        <LevelBar
          levels={levelChoices(session, levelId)}
          currentId={levelId}
          onSelect={id => { navigateTo(buildPath({ ...route, levelId: id })); }}
        />
      )}
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
    case 'record':
      return <SiteRecordScreenAdapter session={session} siteId={route.siteId} />;
    case 'plan':
      return <PlanScreenAdapter session={session} siteId={route.siteId} levelId={levelId} />;
    case 'footprints':
      return <FootprintsScreenAdapter session={session} levelId={levelId} />;
    case 'graph':
      return <GraphScreenAdapter session={session} levelId={levelId} />;
    case 'validation':
      return <ValidationScreenAdapter session={session} siteId={route.siteId} />;
  }
}

/**
 * Les niveaux que la barre propose.
 *
 * Le bâtiment n'est nommé que si le site en porte plusieurs : sur un site à
 * un seul bâtiment, le répéter à chaque niveau n'ajoute rien et allonge la
 * barre. Le niveau courant figure toujours, même quand la session ne le
 * porte pas — l'adresse en nomme un, et une barre qui ne le montrerait pas
 * laisserait croire qu'on est ailleurs.
 */
function levelChoices(
  session: TrancheSession,
  currentId: string,
): readonly { id: string; name: string; buildingName: string | null }[] {
  const { levels } = levelsOfSession(session.state);
  if (levels.length === 0) return [];
  const names = buildingNames(session.state);
  const several = names.size > 1;
  const choices = levels.map(level => ({
    id: level.id,
    name: level.name,
    buildingName: several ? names.get(level.building_id) ?? null : null,
  }));
  return choices.some(choice => choice.id === currentId)
    ? choices
    : [...choices, { id: currentId, name: currentId, buildingName: null }];
}
