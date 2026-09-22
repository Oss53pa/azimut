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

