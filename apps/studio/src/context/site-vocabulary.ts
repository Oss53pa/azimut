import { createContext } from 'react';
import type { SiteVocabulary } from '@azimut/core-model';
import { EMPTY_VOCABULARY } from '@azimut/core-model';

/**
 * État du vocabulaire, et non le vocabulaire seul.
 *
 * Un registre vide et un registre qu'on n'a pas pu lire portent la même
 * valeur et ne disent pas la même chose. Confondre les deux ferait passer une
 * panne de chargement pour « ce site ne déclare rien », et les contrôles se
 * rangeraient parmi les non exercés sans que personne ne sache qu'ils
 * auraient dû l'être. C'est la même erreur que celle corrigée dans les
 * rapports d'audit, et elle se reproduit volontiers d'un étage à l'autre.
 */
export type VocabularyState = {
  readonly vocabulary: SiteVocabulary;
  /** `failed` : la lecture a échoué. Le registre vide n'est alors pas un fait. */
  readonly status: 'loading' | 'ready' | 'failed';
  /** Code du catalogue expliquant l'échec, quand il y en a un. */
  readonly errorCode: string | null;
};

/**
 * Contexte distinct de celui du site, et non un champ ajouté à `SiteData`.
 *
 * Un site se charge et se dessine sans lexique ni fait ; seuls les contrôles de
 * vocabulaire en ont besoin. Les mêler obligerait chaque écran de carte à
 * porter une donnée qu'il n'emploie pas, et chaque construction de `SiteData` —
 * il y en a une quinzaine au dépôt — à la fournir.
 */
export const EMPTY_VOCABULARY_STATE: VocabularyState = {
  vocabulary: EMPTY_VOCABULARY,
  status: 'ready',
  errorCode: null,
};

export const SiteVocabularyContext = createContext<VocabularyState>(EMPTY_VOCABULARY_STATE);
