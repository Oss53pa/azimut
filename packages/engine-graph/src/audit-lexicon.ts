import type { Finding, LexiconTerm, SiteData } from '@azimut/core-model';
import { findLexiconMatches } from '@azimut/core-model';

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
  const names = [...site.destination_names].sort((left, right) =>
    left.id.localeCompare(right.id),
  );

  const findings: Finding[] = [];
  let forbidden = 0;
  let discouraged = 0;

  for (const name of names) {
    for (const match of findLexiconMatches(name.value, terms, name.lang)) {
      const isForbidden = match.severity === 'forbidden';
      if (isForbidden) forbidden += 1;
      else discouraged += 1;

      findings.push({
        code: isForbidden
          ? 'LAYOUT.LEXICON_FORBIDDEN_TERM'
          : 'LAYOUT.LEXICON_DISCOURAGED_TERM',
        severity: isForbidden ? 'blocking' : 'warning',
        entity: { kind: 'destination_name', id: name.id },
        params: {
          term: match.term,
          lang: name.lang,
          // Bornes dans la dénomination, pour surligner sans redécouper.
          start: match.start,
          end: match.end,
        },
        ruleRef: 'A5.8',
      });
    }
  }

  return {
    checked_texts: names.length,
    forbidden_count: forbidden,
    discouraged_count: discouraged,
    findings,
  };
}
