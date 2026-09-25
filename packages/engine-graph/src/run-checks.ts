import type { SiteData, Outcome, Finding, SiteVocabulary } from '@azimut/core-model';
import { checkNamingCollisions } from './checks/naming.js';
import {
  checkDuplicateDisplayName,
  checkIncompleteLangCoverage,
  checkAllVacantCategory,
} from './checks/directory.js';
import { checkUnitCodeRequired, checkUnitCodeDuplicate } from './checks/unit-code.js';
import { checkLevelCalibrated, checkSiteOriginCoherent } from './checks/site-frame.js';
import { checkApprovedVersionImmutable } from './checks/support-version.js';
import { auditLexicon } from './audit-lexicon.js';
import { auditTypography } from './audit-typography.js';
import { auditSentenceLength } from './audit-sentence-length.js';
import { auditSiteFacts } from './audit-site-facts.js';
import { auditSourceClaims } from './audit-source-claims.js';
import { auditParking } from './audit-parking.js';

/**
 * Réexport : le vocabulaire est un registre du modèle, pas une notion de
 * moteur. Il vit en `core-model` pour que le dépôt de données puisse le rendre
 * sans dépendre d'un moteur.
 */
export type { SiteVocabulary } from '@azimut/core-model';

export type CheckReport = {
  readonly checks_run: readonly string[];
  readonly checks_skipped: readonly string[];
  /**
   * Contrôles qu'aucune déclaration du site ne permet d'exercer.
   *
   * Distinct de `checks_skipped`, qui dit « il manque un paquet de règles ».
   * Ici le site ne déclare rien à opposer — pas de lexique de charte, pas de
   * fait, pas d'écart entre sources. Les confondre ferait passer un site
   * muet pour un site contrôlé.
   */
  readonly checks_undeclared: readonly string[];
  readonly findings: readonly Finding[];
};

/**
 * Ce pour quoi les contrôles tournent.
 *
 * `atelier` est le travail en cours : une proposition y est un état légitime.
 * `livrable` est ce qui part à l'impression ou à la publication, et la règle
 * M01.S11 y devient opposable — « un fait de statut `proposal` ne s'affiche
 * jamais comme un existant », et une proposition affichée s'y lirait comme un
 * fait.
 *
 * Un contrôle dont la portée dépend de la destination du rendu a besoin de
 * connaître cette destination : c'est tout ce que ce type porte.
 */
export type CheckMode = 'atelier' | 'livrable';

export type CheckOptions = {
  readonly mode?: CheckMode;
};

/**
 * Contrôles du socle, toujours exercés, quel que soit ce que le site déclare.
 *
 * Les deux contrôles de rédaction en sont sortis : A5.8 range leurs limites
 * parmi les règles de charte, et un site sans charte n'a rien à leur opposer.
 * Ils rejoignent donc les contrôles qui dépendent d'une déclaration.
 */
const BASE_CHECKS: readonly string[] = [
  'all_vacant_category',
  'approved_version_immutable',
  'duplicate_display_name',
  'incomplete_lang_coverage',
  'level_calibrated',
  'naming_collision',
  'site_origin_coherent',
  'unit_code_duplicate',
  'unit_code_required',
];

/**
 * Assemble les contrôles sémantiques du socle. Chaque contrôle vit dans son
 * fichier, sous `checks/` ou dans son propre module d'audit ; celui-ci ne fait
 * que les appeler dans un ordre fixe et nommer ce qui a tourné.
 */
export function runChecks(
  site: SiteData,
  vocabulary: SiteVocabulary = {},
  options: CheckOptions = {},
): Outcome<CheckReport> {
  const forDeliverable = options.mode === 'livrable';
  const findings: Finding[] = [];

  findings.push(...checkDuplicateDisplayName(site));
  findings.push(...checkIncompleteLangCoverage(site));
  findings.push(...checkAllVacantCategory(site));
  findings.push(...checkNamingCollisions(site));
  findings.push(...checkUnitCodeRequired(site));
  findings.push(...checkUnitCodeDuplicate(site));
  findings.push(...checkLevelCalibrated(site));
  findings.push(...checkSiteOriginCoherent(site));
  findings.push(...checkApprovedVersionImmutable(site));

  const run: string[] = [...BASE_CHECKS];
  const undeclared: string[] = [];

  // A5.8 — « Quand la charte ne porte pas une règle, le contrôle correspondant
  // ne s'exécute pas et le signale, comme pour un paquet de règles absent. »
  // Les deux contrôles de rédaction lisent la charte du site ; le rapport dit
  // lequel a tourné, et aucune limite n'est appliquée par défaut.
  const charterRules = vocabulary.charter_rules ?? [];

  const typography = auditTypography(site, charterRules);
  findings.push(...typography.findings);
  (typography.applied ? run : undeclared).push('forbidden_characters');

  const sentences = auditSentenceLength(site, charterRules);
  findings.push(...sentences.findings);
  (sentences.applied ? run : undeclared).push('sentence_length');

  const lexicon = vocabulary.lexicon ?? [];
  if (lexicon.length === 0) {
    undeclared.push('charter_lexicon');
  } else {
    findings.push(...auditLexicon(site, lexicon).findings);
    run.push('charter_lexicon');
  }

  const facts = vocabulary.facts ?? [];
  if (facts.length === 0) {
    undeclared.push('site_facts');
  } else {
    findings.push(...auditSiteFacts(site, facts, forDeliverable).findings);
    run.push('site_facts');
  }

  // Le stationnement est de la géométrie du site : il vient de `SiteData`, pas
  // du vocabulaire, et un site sans parking n'a rien à contrôler — ce n'est pas
  // un contrôle non exercé, c'est un site sans parking.
  if (site.parkings.length > 0) {
    findings.push(...auditParking({
      parkings: site.parkings,
      spaces: site.parking_spaces,
      uncovered: site.parking_uncovered,
    }, forDeliverable).findings);
    run.push('parking_coverage');
    // Le contrôle de publication ne tourne qu'en mode livrable, et il se
    // nomme, pour qu'un rapport d'atelier ne laisse pas croire qu'il a été
    // exercé.
    if (forDeliverable) run.push('parking_publication');
  }

  const claims = vocabulary.claims ?? [];
  if (claims.length === 0) {
    undeclared.push('source_discrepancies');
  } else {
    findings.push(...auditSourceClaims(claims, vocabulary.decisions).findings);
    run.push('source_discrepancies');
  }

  return {
    ok: true,
    value: {
      checks_run: run.sort((a, b) => a.localeCompare(b)),
      checks_skipped: [
        'adjacence_chromatique',
        'contraste',
        'lisibilite',
      ],
      // Trié, comme les exercés : l'ordre d'un rapport ne dit rien de l'ordre
      // dans lequel le code a posé ses questions (A9).
      checks_undeclared: undeclared.sort((a, b) => a.localeCompare(b)),
      findings,
    },
    warnings: [],
  };
}
