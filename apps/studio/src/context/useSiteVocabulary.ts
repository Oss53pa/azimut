import { useContext } from 'react';
import { SiteVocabularyContext, type VocabularyState } from './site-vocabulary.js';

export function useSiteVocabulary(): VocabularyState {
  return useContext(SiteVocabularyContext);
}
