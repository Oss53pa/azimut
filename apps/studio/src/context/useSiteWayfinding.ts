import { useContext } from 'react';
import { SiteWayfindingContext, type WayfindingRegistryState } from './site-wayfinding.js';

export function useSiteWayfinding(): WayfindingRegistryState {
  return useContext(SiteWayfindingContext);
}
