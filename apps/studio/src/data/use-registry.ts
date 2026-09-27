import { useEffect, useMemo, useState } from 'react';
import { appRepository } from './config.js';
import type { SiteRepository } from './site-repository.js';

/**
 * État d'un registre lu à part du site, et non le registre seul : un registre
 * vide et un registre illisible portent la même valeur et ne disent pas la
 * même chose. `demo` dit que le dépôt est celui de référence : ce qu'il rend
 * est un jeu de démonstration, et l'écran doit le dire.
 */
export type RegistryLoad<T> = {
  readonly registry: T;
  readonly status: 'loading' | 'ready' | 'failed';
  readonly demo: boolean;
};

/** Lecteur d'un registre ; une constante de module, pour rester stable. */
export type RegistryLoader<T> = (repository: SiteRepository, siteId: string) => Promise<T>;

/**
 * Charge un registre d'un site, à la demande de l'écran qui le montre. Un
 * échec se déclare `failed` et rend le registre vide, que l'écran ne prend pas
 * pour un fait.
 */
export function useRegistry<T>(load: RegistryLoader<T>, empty: T, siteId: string): RegistryLoad<T> {
  const repository = useMemo(() => appRepository(), []);
  const demo = repository.kind === 'reference';
  const [state, setState] = useState<RegistryLoad<T>>({ registry: empty, status: 'loading', demo });

  useEffect(() => {
    let cancelled = false;
    setState({ registry: empty, status: 'loading', demo });
    load(repository, siteId).then(
      registry => { if (!cancelled) setState({ registry, status: 'ready', demo }); },
      () => { if (!cancelled) setState({ registry: empty, status: 'failed', demo }); },
    );
    return () => { cancelled = true; };
  }, [repository, load, empty, siteId, demo]);

  return state;
}
