import type { SiteData, Outcome, Finding } from '@azimut/core-model';
import { checkNamingCollisions } from './checks/naming.js';
import {
  checkDuplicateDisplayName,
  checkIncompleteLangCoverage,
  checkAllVacantCategory,
} from './checks/directory.js';
import { checkUnitCodeRequired, checkUnitCodeDuplicate } from './checks/unit-code.js';
import { checkLevelCalibrated, checkSiteOriginCoherent } from './checks/site-frame.js';
import { checkApprovedVersionImmutable } from './checks/support-version.js';

export type CheckReport = {
  readonly checks_run: readonly string[];
  readonly checks_skipped: readonly string[];
  readonly findings: readonly Finding[];
};

/**
 * Assemble les contrôles sémantiques du socle. Chaque contrôle vit dans son
 * fichier, sous `checks/` ; celui-ci ne fait que les appeler dans un ordre
 * fixe et nommer ce qui a tourné.
 */
export function runChecks(site: SiteData): Outcome<CheckReport> {
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

  return {
    ok: true,
    value: {
      checks_run: [
        'all_vacant_category',
        'approved_version_immutable',
        'duplicate_display_name',
        'incomplete_lang_coverage',
        'level_calibrated',
        'naming_collision',
        'site_origin_coherent',
        'unit_code_duplicate',
        'unit_code_required',
      ],
      checks_skipped: [
        'adjacence_chromatique',
        'contraste',
        'lisibilite',
      ],
      findings,
    },
    warnings: [],
  };
}
