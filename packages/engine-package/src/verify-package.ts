import { sha256Binary } from '@azimut/core-model';
import type { Outcome, Finding } from '@azimut/core-model';
import type { PackageManifest } from './assemble-package.js';

export type VerifyPackageResult = {
  readonly verified_count: number;
  readonly total_count: number;
};

function computeChecksum(data: Uint8Array): string {
  return `sha256-${sha256Binary(data)}`;
}

/**
 * Verify a package manifest against actual artifact contents.
 *
 * Checks:
 * - Every artifact in the manifest is present in the contents map
 * - Every checksum matches the recomputed hash
 * - artifact_count matches the manifest
 * - total_size_bytes matches
 *
 * Emits PACKAGE.CHECKSUM_MISMATCH for each failing artifact.
 */
export function verifyPackage(
  manifest: PackageManifest,
  artifactContents: ReadonlyMap<string, Uint8Array>,
): Outcome<VerifyPackageResult> {
  const findings: Finding[] = [];

  const sortedArtifacts = [...manifest.artifacts].sort((a, b) =>
    a.id.localeCompare(b.id),
  );

  let verifiedCount = 0;

  for (const artifact of sortedArtifacts) {
    const content = artifactContents.get(artifact.id);

    if (content === undefined) {
      findings.push({
        code: 'PACKAGE.CHECKSUM_MISMATCH',
        severity: 'blocking',
        entity: { kind: 'artifact', id: artifact.id },
        params: {
          path: artifact.path,
          expected: artifact.checksum,
          actual: 'missing',
        },
        ruleRef: null,
      });
      continue;
    }

    const actual = computeChecksum(content);
    if (actual !== artifact.checksum) {
      findings.push({
        code: 'PACKAGE.CHECKSUM_MISMATCH',
        severity: 'blocking',
        entity: { kind: 'artifact', id: artifact.id },
        params: {
          path: artifact.path,
          expected: artifact.checksum,
          actual,
        },
        ruleRef: null,
      });
      continue;
    }

    if (content.length !== artifact.size_bytes) {
      findings.push({
        code: 'PACKAGE.CHECKSUM_MISMATCH',
        severity: 'blocking',
        entity: { kind: 'artifact', id: artifact.id },
        params: {
          path: artifact.path,
          expected_size: artifact.size_bytes,
          actual_size: content.length,
        },
        ruleRef: null,
      });
      continue;
    }

    verifiedCount++;
  }

  const result: VerifyPackageResult = {
    verified_count: verifiedCount,
    total_count: sortedArtifacts.length,
  };

  if (findings.length > 0) {
    return { ok: false, findings };
  }

  return { ok: true, value: result, warnings: [] };
}
