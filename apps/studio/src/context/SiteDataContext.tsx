import { type JSX, type ReactNode } from 'react';
import type { SiteData } from '@azimut/core-model';
import { SiteDataContext } from './site-data.js';
import {
  SiteVocabularyContext, EMPTY_VOCABULARY_STATE, type VocabularyState,
} from './site-vocabulary.js';

type ProviderProps = {
  readonly site: SiteData;
  /**
   * Facultatif : le vocabulaire se charge à part et peut ne pas être arrivé.
   * Son absence vaut registre vide *lu*, et non registre illisible — une carte
   * s'affiche sans lexique.
   */
  readonly vocabulary?: VocabularyState | undefined;
  readonly children: ReactNode;
};

export function SiteDataProvider({ site, vocabulary, children }: ProviderProps): JSX.Element {
  return (
    <SiteDataContext.Provider value={site}>
      <SiteVocabularyContext.Provider value={vocabulary ?? EMPTY_VOCABULARY_STATE}>
        {children}
      </SiteVocabularyContext.Provider>
    </SiteDataContext.Provider>
  );
}
