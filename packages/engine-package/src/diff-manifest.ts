import type { Outcome, Finding } from '@azimut/core-model';
import type { PackageManifest } from './assemble-package.js';

export type ManifestDiffReport = {
  readonly matched_count: number;
  readonly divergent_count: number;
  readonly added_ids: readonly string[];
  readonly removed_ids: readonly string[];
};

/**
 * Compare two package manifests artifact-by-artifact.
 *
 * Emits PACKAGE.NON_DETERMINISTIC for every artifact whose checksum
 * differs between baseline and candidate (same id, different hash).
 *
 * Also reports artifacts present in only one of the two manifests
 * (added/removed), which indicates a structural divergence.
 */
export function diffManifest(
  baseline: PackageManifest,
  candidate: PackageManifest,
): Outcome<ManifestDiffReport> {
  const baselineMap = new Map(
    baseline.artifacts.map((a) => [a.id, a]),
  );
  const candidateMap = new Map(
    candidate.artifacts.map((a) => [a.id, a]),
  );

  const allIds = new Set([
    ...baselineMap.keys(),
    ...candidateMap.keys(),
  ]);
  const sortedIds = [...allIds].sort();

  const findings: Finding[] = [];
  let matchedCount = 0;
  let divergentCount = 0;
  const addedIds: string[] = [];
  const removedIds: string[] = [];

  for (const id of sortedIds) {
    const base = baselineMap.get(id);
    const cand = candidateMap.get(id);

    if (base && !cand) {
      removedIds.push(id);
      continue;
    }

    if (!base && cand) {
      addedIds.push(id);
      continue;
    }

    if (base && cand) {
      if (base.checksum !== cand.checksum) {
        divergentCount++;
        findings.push({
          code: 'PACKAGE.NON_DETERMINISTIC',
          severity: 'blocking',
          entity: { kind: 'artifact', id },
          params: {
            path: base.path,
            baseline_checksum: base.checksum,
            candidate_checksum: cand.checksum,
            baseline_size: base.size_bytes,
            candidate_size: cand.size_bytes,
          },
          ruleRef: null,
        });
      } else {
        matchedCount++;
      }
    }
  }

  // Structural changes (added/removed) are also non-deterministic.
  for (const id of removedIds) {
    findings.push({
      code: 'PACKAGE.NON_DETERMINISTIC',
      severity: 'blocking',
      entity: { kind: 'artifact', id },
      params: { reason: 'removed_in_candidate' },
      ruleRef: null,
    });
  }
  for (const id of addedIds) {
    findings.push({
      code: 'PACKAGE.NON_DETERMINISTIC',
      severity: 'blocking',
      entity: { kind: 'artifact', id },
      params: { reason: 'added_in_candidate' },
      ruleRef: null,
    });
  }

  const report: ManifestDiffReport = {
    matched_count: matchedCount,
    divergent_count: divergentCount + addedIds.length + removedIds.length,
    added_ids: addedIds,
    removed_ids: removedIds,
  };

  if (findings.length > 0) {
    return { ok: false, findings };
  }

  return { ok: true, value: report, warnings: [] };
}
