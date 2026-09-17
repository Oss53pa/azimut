import type { Finding, LexiconTerm, SiteData } from '@azimut/core-model';
import { findLexiconMatches } from '@azimut/core-model';
import { checkableTexts } from './site-texts.js';

/**
 * Contrôle du vocabulaire de la charte sur les textes du site (A5.8).
 *
 * Les deux codes `LAYOUT.LEXICON_FORBIDDEN_TERM` et
 * `LAYOUT.LEXICON_DISCOURAGED_TERM` figuraient au catalogue D2 sans qu'aucun
 * moteur ne les lève. Ce module les lève.
 *
 * **Le contrôle porte sur la source, pas sur le rendu.** Une dénomination
 * fautive se propage à chaque face, à chaque plan et à chaque index qui la
 * cite : la signaler une fois sur la destination dit quoi corriger, alors que la
 * signaler sur douze panneaux dit seulement où le mal s'est répandu. C'est aussi
 * pourquoi l'entité rapportée est `destination_name` et non le support.
 *
 * L'ensemble des textes jugés est celui de `checkableTexts`, partagé avec le
 * contrôle des faits du site : les deux doivent porter sur le même corpus, sans
 * quoi « charte propre » et « fait respecté » ne parleraient plus du même
 * livrable.
 */
export type LexiconReport = {
  readonly checked_texts: number;
  readonly forbidden_count: number;
  readonly discouraged_count: number;
  readonly findings: readonly Finding[];
};

/**
 * Audite les dénominations d'un site contre le lexique de sa charte.
 *
 * Le rapport porte ses anomalies plutôt que de les rendre en `Outcome` : une
 * dénomination interdite n'empêche pas de rendre le rapport, c'est ce que le
 * rapport sert à montrer. Même choix que `CoverageReport`.
 *
 * L'ordre est déterministe : les dénominations sont parcourues par identifiant,
 * et les appariements de chacune viennent déjà ordonnés par position.
 */
export function auditLexicon(
  site: SiteData,
  terms: readonly LexiconTerm[],
): LexiconReport {
  const texts = checkableTexts(site);

  const findings: Finding[] = [];
  let forbidden = 0;
  let discouraged = 0;

  for (const text of texts) {
    for (const match of findLexiconMatches(text.value, terms, text.lang)) {
      const isForbidden = match.severity === 'forbidden';
      if (isForbidden) forbidden += 1;
      else discouraged += 1;

      findings.push({
        code: isForbidden
          ? 'LAYOUT.LEXICON_FORBIDDEN_TERM'
          : 'LAYOUT.LEXICON_DISCOURAGED_TERM',
        severity: isForbidden ? 'blocking' : 'warning',
        entity: { kind: text.kind, id: text.id },
        params: {
          term: match.term,
          lang: text.lang,
          // Bornes dans le texte, pour surligner sans redécouper.
          start: match.start,
          end: match.end,
        },
        ruleRef: 'A5.8',
      });
    }
  }

  return {
    checked_texts: texts.length,
    forbidden_count: forbidden,
    discouraged_count: discouraged,
    findings,
  };
}
