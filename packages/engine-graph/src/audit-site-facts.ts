import type { Finding, LexiconTerm, SiteData, SiteFact } from '@azimut/core-model';
import { findLexiconMatches } from '@azimut/core-model';
import { checkableTexts } from './site-texts.js';

/**
 * Contrôle des textes du site contre ses faits — complément atelier M3, QC-05.
 *
 * Un fait vérifié bannit des mots : « parking gratuit » interdit paiement,
 * payant, tarif. L'anomalie nomme le fait, sa valeur et sa source, parce que la
 * correction n'est pas toujours d'effacer le mot — elle peut être de réviser le
 * fait, si c'est lui qui a cessé d'être vrai. Une anomalie qui dirait seulement
 * « mot interdit » cacherait ce second chemin.
 */
export type SiteFactReport = {
  readonly checked_texts: number;
  readonly checked_facts: number;
  readonly findings: readonly Finding[];
};

export function auditSiteFacts(
  site: SiteData,
  facts: readonly SiteFact[],
): SiteFactReport {
  const texts = checkableTexts(site);
  const ordered = [...facts].sort((left, right) => left.key.localeCompare(right.key));
  const findings: Finding[] = [];

  for (const text of texts) {
    for (const fact of ordered) {
      const terms: LexiconTerm[] = fact.forbidden.map((word) => ({
        lang: word.lang,
        term: word.term,
        severity: 'forbidden',
      }));

      for (const match of findLexiconMatches(text.value, terms, text.lang)) {
        findings.push({
          code: 'LAYOUT.FACT_CONTRADICTED',
          severity: 'blocking',
          entity: { kind: text.kind, id: text.id },
          params: {
            fact: fact.key,
            fact_value: fact.value,
            fact_source: fact.source,
            term: match.term,
            lang: text.lang,
            start: match.start,
            end: match.end,
          },
          ruleRef: 'atelier-M3',
        });
      }
    }
  }

  return {
    checked_texts: texts.length,
    checked_facts: facts.length,
    findings,
  };
}
