import type { SiteData, Finding } from '@azimut/core-model';
import {
  validateGraph,
  validateDirectory,
  validateGeometry,
  runChecks,
} from '@azimut/engine-graph';
import type { Job } from './job.js';

export type AuditSiteContext = {
  readonly site: SiteData;
};

export type AuditSiteResult = {
  readonly checks_run: readonly string[];
  readonly checks_skipped: readonly string[];
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
 *   - checks_run, checks_skipped: which checks executed
 *   - total_findings, blocking_count, warning_count, info_count
 *   - findings: the full findings array
 */
export function createAuditSiteHandler(
  context: AuditSiteContext,
): (job: Job) => Promise<Record<string, unknown>> {
  const { site } = context;

  return async (): Promise<Record<string, unknown>> => {
    const checksRun: string[] = [];
    const checksSkipped: string[] = [];
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
    const checkResult = runChecks(site);
    if (checkResult.ok) {
      checksRun.push(...checkResult.value.checks_run);
      checksSkipped.push(...checkResult.value.checks_skipped);
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
      checks_run: checksRun.sort(),
      checks_skipped: checksSkipped.sort(),
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
