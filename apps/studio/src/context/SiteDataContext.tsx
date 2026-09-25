import { type JSX, type ReactNode } from 'react';
import type { SiteData } from '@azimut/core-model';
import { SiteDataContext } from './site-data.js';
import {
  SiteVocabularyContext, EMPTY_VOCABULARY_STATE, type VocabularyState,
} from './site-vocabulary.js';
import {
  SiteWayfindingContext, EMPTY_WAYFINDING_STATE, type WayfindingRegistryState,
} from './site-wayfinding.js';

type ProviderProps = {
  readonly site: SiteData;
  /**
   * Facultatif : le vocabulaire se charge à part et peut ne pas être arrivé.
   * Son absence vaut registre vide *lu*, et non registre illisible — une carte
   * s'affiche sans lexique.
   */
  readonly vocabulary?: VocabularyState | undefined;
  /** Facultatif pour la même raison : le registre du wayfinding se lit à part. */
  readonly wayfinding?: WayfindingRegistryState | undefined;
  readonly children: ReactNode;
};

export function SiteDataProvider({ site, vocabulary, wayfinding, children }: ProviderProps): JSX.Element {
  return (
    <SiteDataContext.Provider value={site}>
      <SiteVocabularyContext.Provider value={vocabulary ?? EMPTY_VOCABULARY_STATE}>
        <SiteWayfindingContext.Provider value={wayfinding ?? EMPTY_WAYFINDING_STATE}>
          {children}
        </SiteWayfindingContext.Provider>
      </SiteVocabularyContext.Provider>
    </SiteDataContext.Provider>
  );
}
