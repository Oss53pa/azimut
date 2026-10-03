import type { SiteData, Finding, SiteVocabulary } from '@azimut/core-model';
import { EMPTY_VOCABULARY } from '@azimut/core-model';
import {
  validateGraph,
  validateDirectory,
  validateGeometry,
  runChecks,
} from '@azimut/engine-graph';
import type { CheckMode } from '@azimut/engine-graph';
import type { Job } from './job.js';

/**
 * Le mode vient de la charge de travail, et vaut `atelier` par défaut.
 *
 * Un audit lancé sans le dire est un audit de travail : c'est le choix le moins
 * surprenant, et surtout celui qui ne fait pas passer un jeu d'objets pour
 * publiable sans que personne l'ait demandé.
 */
function parseMode(raw: unknown): CheckMode {
  return raw === 'livrable' ? 'livrable' : 'atelier';
}

export type AuditSiteContext = {
  readonly site: SiteData;
  /**
   * Ce que le site oppose à ses propres textes — A5.8 et A5.11.
   *
   * Facultatif, et l'absence n'est pas neutre : les contrôles qui dépendent
   * d'une déclaration ne s'exécutent alors pas, et le résultat les nomme dans
   * `checks_undeclared`. C'est ce qu'exige A5.8 — « le contrôle ne s'exécute
   * pas et le signale » — et c'est ce qui distingue un site sans charte d'un
   * site dont la charte n'interdit rien.
   */
  readonly vocabulary?: SiteVocabulary;
};

export type AuditSiteResult = {
  readonly mode: CheckMode;
  readonly checks_run: readonly string[];
  readonly checks_skipped: readonly string[];
  /** Contrôles qu'aucune déclaration du site ne permet d'exercer. */
  readonly checks_undeclared: readonly string[];
  readonly total_findings: number;
  readonly blocking_count: number;
  readonly warning_count: number;
  readonly info_count: number;
};

/**
 * Create a job handler for `audit_site`.
 *
 * Runs all available non-normative validations and checks:
 *   1. Graph validation (connectivity, self-loops, etc.)
 *   2. Directory validation (destinations, names)
 *   3. Geometry validation (footprints, volumes)
 *   4. Semantic checks (duplicates, language coverage, vacancies)
 *
 * Result:
 *   - checks_run, checks_skipped, checks_undeclared: which checks executed,
 *     which lacked a rules pack, and which the site declares nothing to oppose
 *   - total_findings, blocking_count, warning_count, info_count
 *   - findings: the full findings array
 */
export function createAuditSiteHandler(
  context: AuditSiteContext,
): (job: Job) => Promise<Record<string, unknown>> {
  const { site } = context;
  const vocabulary = context.vocabulary ?? EMPTY_VOCABULARY;

  return async (job: Job): Promise<Record<string, unknown>> => {
    const mode = parseMode(job.payload['mode']);
    const checksRun: string[] = [];
    const checksSkipped: string[] = [];
    const checksUndeclared: string[] = [];
    const allFindings: Finding[] = [];

    // 1. Graph validation
    const graphResult = validateGraph(site);
    checksRun.push('validate_graph');
    if (graphResult.ok) {
      allFindings.push(...graphResult.warnings);
    } else {
      allFindings.push(...graphResult.findings);
    }

    // 2. Directory validation
    const dirResult = validateDirectory(site);
    checksRun.push('validate_directory');
    if (dirResult.ok) {
      allFindings.push(...dirResult.warnings);
    } else {
      allFindings.push(...dirResult.findings);
    }

    // 3. Geometry validation
    const geomResult = validateGeometry(site);
    checksRun.push('validate_geometry');
    if (geomResult.ok) {
      allFindings.push(...geomResult.warnings);
    } else {
      allFindings.push(...geomResult.findings);
    }

    // 4. Semantic checks (runChecks)
    const checkResult = runChecks(site, vocabulary, { mode });
    if (checkResult.ok) {
      checksRun.push(...checkResult.value.checks_run);
      checksSkipped.push(...checkResult.value.checks_skipped);
      checksUndeclared.push(...checkResult.value.checks_undeclared);
      allFindings.push(...checkResult.value.findings);
    }

    // Sort findings deterministically by code then entity id (INV-4)
    allFindings.sort((a, b) => {
      const codeCmp = a.code.localeCompare(b.code);
      if (codeCmp !== 0) return codeCmp;
      const aId = a.entity?.id ?? '';
      const bId = b.entity?.id ?? '';
      return aId.localeCompare(bId);
    });

    let blockingCount = 0;
    let warningCount = 0;
    let infoCount = 0;
    for (const f of allFindings) {
      if (f.severity === 'blocking') blockingCount++;
      else if (f.severity === 'warning') warningCount++;
      else infoCount++;
    }

    const result: AuditSiteResult = {
      // Le rapport dit sous quel mode il a été produit : « zéro bloquant » n'a
      // pas le même sens à l'atelier et à l'impression.
      mode,
      checks_run: checksRun.sort(),
      checks_skipped: checksSkipped.sort(),
      checks_undeclared: checksUndeclared.sort(),
      total_findings: allFindings.length,
      blocking_count: blockingCount,
      warning_count: warningCount,
      info_count: infoCount,
    };

    return {
      ...result,
      findings: allFindings,
    };
  };
}
