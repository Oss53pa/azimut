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
import { checkEdgeAvailability } from './checks/edge-availability.js';
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
 * `livrable` est ce qui part à l'impression ou à la publication, et P1 du
 * complément atelier y devient opposable — une proposition affichée s'y lirait
 * comme un fait.
 *
 * La notion n'est pas inventée : QC-21 du complément décrit exactement une
 * anomalie « signalante, bloquante à l'impression ». Un contrôle dont la
 * sévérité dépend de la destination du rendu a besoin de connaître cette
 * destination.
 */
export type CheckMode = 'atelier' | 'livrable';

export type CheckOptions = {
  readonly mode?: CheckMode;
};

/** Contrôles du socle, toujours exercés, quel que soit ce que le site déclare. */
const BASE_CHECKS: readonly string[] = [
  'all_vacant_category',
  'approved_version_immutable',
  'duplicate_display_name',
  'edge_availability',
  'forbidden_characters',
  'sentence_length',
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
  findings.push(...checkEdgeAvailability(site));

  // QC-06 (complément atelier) n'attend aucune déclaration : un caractère
  // interdit l'est sans qu'une charte ait à le dire, et dans toutes les langues.
  // Il tourne donc toujours, aux deux modes, puisque le contrôle est bloquant
  // sans condition de destination — contrairement à QC-21.
  findings.push(...auditTypography(site).findings);

  // QC-20 (complément atelier), voisin du précédent et signalant : il n'attend
  // aucune déclaration non plus, et ne juge que le texte libre d'un gabarit.
  findings.push(...auditSentenceLength(site).findings);

  const run: string[] = [...BASE_CHECKS];
  const undeclared: string[] = [];

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
    findings.push(...auditSiteFacts(site, facts).findings);
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
    // Le contrôle de P1 (complément atelier) ne tourne qu'en mode livrable, et
    // il se nomme, pour qu'un rapport d'atelier ne laisse pas croire qu'il a
    // été exercé.
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
      checks_undeclared: undeclared,
      findings,
    },
    warnings: [],
  };
}
