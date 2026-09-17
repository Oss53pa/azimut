import { type JSX, type ReactNode } from 'react';
import type { SiteData, SiteVocabulary } from '@azimut/core-model';
import { EMPTY_VOCABULARY } from '@azimut/core-model';
import { SiteDataContext } from './site-data.js';
import { SiteVocabularyContext } from './site-vocabulary.js';

type ProviderProps = {
  readonly site: SiteData;
  /**
   * Facultatif : le vocabulaire se charge à part et peut ne pas être arrivé,
   * ou ne pas exister. Son absence vaut registre vide, jamais échec — une
   * carte s'affiche sans lexique.
   */
  readonly vocabulary?: SiteVocabulary | undefined;
  readonly children: ReactNode;
};

export function SiteDataProvider({ site, vocabulary, children }: ProviderProps): JSX.Element {
  return (
    <SiteDataContext.Provider value={site}>
      <SiteVocabularyContext.Provider value={vocabulary ?? EMPTY_VOCABULARY}>
        {children}
      </SiteVocabularyContext.Provider>
    </SiteDataContext.Provider>
  );
}
