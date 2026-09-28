import { useEffect, useState } from 'react';
import { EMPTY_CHARTER_REGISTRY, type CharterRegistry } from '@azimut/core-model';
import type { SiteRepository } from './site-repository.js';

/**
 * État du registre de charte, et non le registre seul : une charte absente et
 * une charte illisible portent la même valeur et ne disent pas la même chose.
 */
export type CharterRegistryState = {
  readonly registry: CharterRegistry;
  readonly status: 'loading' | 'ready' | 'failed';
};

/**
 * A5.8 — charge les chartes d'un site, à la demande de l'écran qui les
 * montre. Un échec se déclare `failed` et rend un registre vide que l'écran
 * ne prend pas pour un fait.
 */
export function useCharterRegistryLoad(repository: SiteRepository, siteId: string): CharterRegistryState {
  const [state, setState] = useState<CharterRegistryState>({ registry: EMPTY_CHARTER_REGISTRY, status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ registry: EMPTY_CHARTER_REGISTRY, status: 'loading' });
    repository.loadCharterRegistry(siteId).then(
      registry => { if (!cancelled) setState({ registry, status: 'ready' }); },
      () => { if (!cancelled) setState({ registry: EMPTY_CHARTER_REGISTRY, status: 'failed' }); },
    );
    return () => { cancelled = true; };
  }, [repository, siteId]);

  return state;
}
