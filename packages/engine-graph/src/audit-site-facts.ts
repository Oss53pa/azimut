import type { Finding, LexiconTerm, SiteData, SiteFact } from '@azimut/core-model';
import { findLexiconMatches, factValueText, PUBLISHABLE_FACT_STATUSES } from '@azimut/core-model';
import { checkableTexts } from './site-texts.js';

/**
 * Contrôle des textes du site contre ses faits — A5.11, règle M01.S11.
 *
 * « Un texte de livrable qui contredit un fait déclaré est refusé. »
 *
 * Un fait vérifié bannit des mots : « parking gratuit » interdit paiement,
 * payant, tarif. L'anomalie nomme le fait, sa valeur et sa source, parce que la
 * correction n'est pas toujours d'effacer le mot — elle peut être de réviser le
 * fait, si c'est lui qui a cessé d'être vrai. Une anomalie qui dirait seulement
 * « mot interdit » cacherait ce second chemin.
 *
 * **Deux contrôles de plus, et ils viennent du statut.** D2.2 range
 * `PARK.SOURCE_MISSING` au niveau du fait — « Fait du site sans source
 * déclarée, règle M01.S11 » — et `PARK.PROPOSAL_AS_EXISTING` au statut de
 * proposition affiché comme un existant. Les deux se levaient jusqu'ici sur les
 * objets de stationnement, faute de colonne pour porter le statut d'un fait :
 * le statut vivait sur les objets, et un fait déclaré n'en avait aucun, donc
 * tout fait s'affichait comme un existant. La migration 0053 a aligné la table
 * sur A5.11, et les deux contrôles se rattachent au fait, là où le catalogue
 * les met.
 */
export type SiteFactReport = {
  readonly checked_texts: number;
  readonly checked_facts: number;
  readonly findings: readonly Finding[];
};

/**
 * Audite les textes du site contre ses faits, et les faits contre eux-mêmes.
 *
 * `forDeliverable` durcit le second contrôle, et lui seul : hors livrable, une
 * proposition est un état de travail légitime ; portée à un livrable, elle
 * s'afficherait comme un fait, ce que la règle M01.S11 refuse. Une source
 * manquante, elle, manque dans les deux modes.
 */
export function auditSiteFacts(
  site: SiteData,
  facts: readonly SiteFact[],
  forDeliverable = false,
): SiteFactReport {
  const texts = checkableTexts(site);
  const ordered = [...facts].sort((left, right) => left.key.localeCompare(right.key));
  const findings: Finding[] = [];

  for (const fact of ordered) {
    if (fact.source_ref.trim() === '') {
      findings.push({
        code: 'PARK.SOURCE_MISSING',
        severity: 'blocking',
        entity: { kind: 'site_fact', id: fact.key },
        params: { fact: fact.key, status: fact.status },
        ruleRef: 'M01.S11',
      });
    }
    if (forDeliverable && !PUBLISHABLE_FACT_STATUSES.includes(fact.status)) {
      findings.push({
        code: 'PARK.PROPOSAL_AS_EXISTING',
        severity: 'blocking',
        entity: { kind: 'site_fact', id: fact.key },
        params: { fact: fact.key, status: fact.status },
        ruleRef: 'M01.S11',
      });
    }
  }

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
            fact_value: factValueText(fact.value),
            fact_source: fact.source_ref,
            term: match.term,
            lang: text.lang,
            start: match.start,
            end: match.end,
          },
          ruleRef: 'M01.S11',
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
