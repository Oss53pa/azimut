import { useContext } from 'react';
import type { SiteData } from '@azimut/core-model';
import { SiteDataContext } from './site-data.js';

export function useSiteData(): SiteData {
  const ctx = useContext(SiteDataContext);
  if (ctx === null) {
    throw new Error('useSiteData must be used inside SiteDataProvider');
  }
  return ctx;
}
