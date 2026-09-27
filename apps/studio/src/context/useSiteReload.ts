import { useContext } from 'react';
import { SiteReloadContext } from './site-data.js';

/** La relecture du site courant, fournie par la coquille. */
export function useSiteReload(): () => void {
  return useContext(SiteReloadContext);
}
