import { useContext } from 'react';
import type { SiteVocabulary } from '@azimut/core-model';
import { SiteVocabularyContext } from './site-vocabulary.js';

export function useSiteVocabulary(): SiteVocabulary {
  return useContext(SiteVocabularyContext);
}
