import { useEffect, useState } from 'react';
import { EMPTY_MAINTENANCE_REGISTRY, type MaintenanceRegistry } from '@azimut/core-model';
import type { SiteRepository } from './site-repository.js';

/**
 * État du parc posé, et non le registre seul : un parc vide et un parc
 * illisible portent la même valeur et ne disent pas la même chose.
 */
export type MaintenanceRegistryState = {
  readonly registry: MaintenanceRegistry;
  readonly status: 'loading' | 'ready' | 'failed';
};

/**
 * A5.7 — charge le parc posé d'un site, à la demande de l'écran qui le
 * montre. Un échec se déclare `failed` et rend un registre vide que l'écran
 * ne prend pas pour un fait.
 */
export function useMaintenanceRegistryLoad(repository: SiteRepository, siteId: string): MaintenanceRegistryState {
  const [state, setState] = useState<MaintenanceRegistryState>({
    registry: EMPTY_MAINTENANCE_REGISTRY, status: 'loading',
  });

  useEffect(() => {
    let cancelled = false;
    setState({ registry: EMPTY_MAINTENANCE_REGISTRY, status: 'loading' });
    repository.loadMaintenanceRegistry(siteId).then(
      registry => { if (!cancelled) setState({ registry, status: 'ready' }); },
      () => { if (!cancelled) setState({ registry: EMPTY_MAINTENANCE_REGISTRY, status: 'failed' }); },
    );
    return () => { cancelled = true; };
  }, [repository, siteId]);

  return state;
}
