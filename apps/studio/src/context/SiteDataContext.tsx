import { type JSX, type ReactNode } from 'react';
import type { SiteData } from '@azimut/core-model';
import { SiteDataContext } from './site-data.js';

type ProviderProps = {
  readonly site: SiteData;
  readonly children: ReactNode;
};

export function SiteDataProvider({ site, children }: ProviderProps): JSX.Element {
  return (
    <SiteDataContext.Provider value={site}>
      {children}
    </SiteDataContext.Provider>
  );
}
