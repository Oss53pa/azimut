import { createContext } from 'react';
import type { SiteVocabulary } from '@azimut/core-model';
import { EMPTY_VOCABULARY } from '@azimut/core-model';

/**
 * Contexte distinct de celui du site, et non un champ ajouté à `SiteData`.
 *
 * Un site se charge et se dessine sans lexique ni fait ; seuls les contrôles de
 * vocabulaire en ont besoin. Les mêler obligerait chaque écran de carte à
 * porter une donnée qu'il n'emploie pas, et chaque construction de `SiteData` —
 * il y en a une quinzaine au dépôt — à la fournir.
 *
 * Défaut : un vocabulaire vide. Un écran monté hors fournisseur contrôle donc
 * sur du vide et le déclare non exercé, plutôt que d'échouer ou de conclure.
 */
export const SiteVocabularyContext = createContext<SiteVocabulary>(EMPTY_VOCABULARY);
