import { createContext } from 'react';
import { EMPTY_WAYFINDING_REGISTRY, type WayfindingRegistry } from '@azimut/core-model';

/**
 * État du registre du wayfinding, et non le registre seul : un registre vide
 * et un registre illisible portent la même valeur et ne disent pas la même
 * chose. Même raison, même forme que l'état du vocabulaire.
 */
export type WayfindingRegistryState = {
  readonly registry: WayfindingRegistry;
  readonly status: 'loading' | 'ready' | 'failed';
};

export const EMPTY_WAYFINDING_STATE: WayfindingRegistryState = {
  registry: EMPTY_WAYFINDING_REGISTRY,
  status: 'ready',
};

export const SiteWayfindingContext = createContext<WayfindingRegistryState>(EMPTY_WAYFINDING_STATE);
