import { useEffect, useState } from 'react';
import { parseRoute } from './routes.js';
import type { Route } from './routes.js';

/** La route courante, tenue à jour par les retours arrière du navigateur. */
export function useCurrentRoute(): Route {
  const [route, setRoute] = useState<Route>(() =>
    parseRoute(typeof location === 'undefined' ? '/' : location.pathname));

  useEffect(() => {
    const onPop = (): void => { setRoute(parseRoute(location.pathname)); };
    window.addEventListener('popstate', onPop);
    return () => { window.removeEventListener('popstate', onPop); };
  }, []);

  return route;
}


/**
 * Change de route sans recharger la page.
 *
 * `pushState` ne lève aucun événement : le navigateur le réserve aux retours
 * arrière. Sans le `popstate` posé ici, l'adresse changerait et l'écran
 * resterait celui d'avant — une navigation qui ne navigue pas.
 */
export function navigateTo(path: string): void {
  if (typeof history === 'undefined' || path === location.pathname) return;
  history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
