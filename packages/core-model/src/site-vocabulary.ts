/**
 * Ce que le site oppose à ses propres textes.
 *
 * Trois registres de nature différente, réunis parce qu'ils répondent à la même
 * question — ce qu'on a le droit d'écrire sur un support :
 *
 * - le **lexique de charte** (A5.8) dit comment on parle ;
 * - les **faits du site** (M3, complément atelier) disent ce qui est vrai ;
 * - les **affirmations de source** (M16, complément atelier) disent ce qui reste discuté.
 *
 * Ce n'est pas de la géométrie, et cela ne rejoint donc pas `SiteData` : un site
 * se charge et se dessine sans qu'aucun de ces trois registres existe. Ils se
 * chargent à part, et leur absence se déclare plutôt qu'elle ne se devine.
 *
 * Tout est facultatif, et c'est le point : un registre vide range son contrôle
 * parmi les non exercés. Il ne le fait jamais réussir.
 */
import type { LexiconTerm } from './lexicon.js';
import type { SiteFact } from './site-facts.js';
import type { SourceClaim, DiscrepancyDecision } from './source-claims.js';

export type SiteVocabulary = {
  readonly lexicon?: readonly LexiconTerm[];
  readonly facts?: readonly SiteFact[];
  readonly claims?: readonly SourceClaim[];
  readonly decisions?: Readonly<Record<string, DiscrepancyDecision>>;
};

/** Un site qui ne déclare rien. Explicite, pour ne pas confondre avec un oubli. */
export const EMPTY_VOCABULARY: SiteVocabulary = {};
