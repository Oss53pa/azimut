import { sha256Binary, contentHash } from '@azimut/core-model';
import type { Outcome, Finding } from '@azimut/core-model';
import type { KioskManifest, KioskManifestFile } from './assemble-kiosk-package.js';

/**
 * D10.4 — Kiosk update protocol (pure decision logic).
 *
 * The runtime side (real HTTP, filesystem, atomic rename) is environment
 * specific; the decisive logic — decide whether to update, verify a downloaded
 * tree against the manifest file by file, commit atomically while keeping the
 * previous version, and roll back a failed boot — is pure and lives here so it
 * can be tested deterministically, including the decisive "interrupted download
 * must not produce a mixed state" scenario.
 */

export type InstalledVersion = {
  readonly manifest: KioskManifest;
  readonly files: ReadonlyMap<string, Uint8Array>;
};

export type KioskInstallation = {
  readonly current: InstalledVersion | null;
  readonly previous: InstalledVersion | null;
};

/**
 * Step 2/3 of D10.4: the runtime compares its local version against the light
 * remote version file and downloads only when they differ.
 */
export function shouldUpdate(
  localVersion: number | null,
  remoteVersion: number,
): boolean {
  return localVersion === null || localVersion !== remoteVersion;
}

function recomputeContentHash(manifest: KioskManifest): string {
  const hash = contentHash({
    siteId: manifest.siteId,
    version: manifest.version,
    langs: [...manifest.langs].sort(),
    minRuntime: manifest.minRuntime,
    files: manifest.files.map((f) => ({ path: f.path, sha256: f.sha256 })),
  });
  return `sha256:${hash}`;
}

/**
 * Step 4 of D10.4: verify every manifest file against a downloaded tree. A
 * single discrepancy cancels the update (PACKAGE.INTEGRITY_MISMATCH). The
 * manifest's own contentHash is re-derived and checked so a tampered manifest
 * is caught too.
 */
export function verifyAgainstManifest(
  manifest: KioskManifest,
  files: ReadonlyMap<string, Uint8Array>,
): Outcome<true> {
  const findings: Finding[] = [];

  if (recomputeContentHash(manifest) !== manifest.contentHash) {
    findings.push({
      code: 'PACKAGE.CHECKSUM_MISMATCH',
      severity: 'blocking',
      entity: null,
      params: { reason: 'manifest content hash' },
      ruleRef: null,
    });
  }

  const sorted: readonly KioskManifestFile[] = [...manifest.files].sort(
    (a, b) => a.path.localeCompare(b.path),
  );
  for (const entry of sorted) {
    const bytes = files.get(entry.path);
    if (bytes === undefined) {
      findings.push({
        code: 'PACKAGE.INTEGRITY_MISMATCH',
        severity: 'blocking',
        entity: null,
        params: { path: entry.path, reason: 'missing' },
        ruleRef: null,
      });
      continue;
    }
    if (sha256Binary(bytes) !== entry.sha256) {
      findings.push({
        code: 'PACKAGE.INTEGRITY_MISMATCH',
        severity: 'blocking',
        entity: null,
        params: { path: entry.path, reason: 'sha256' },
        ruleRef: null,
      });
    }
  }

  if (findings.length > 0) return { ok: false, findings };
  return { ok: true, value: true, warnings: [] };
}

/**
 * Step 5 of D10.4: atomic commit. The candidate is verified against its own
 * manifest first; only a fully-consistent candidate replaces `current`, and the
 * outgoing version is kept as `previous`. On any discrepancy nothing changes —
 * an interrupted or corrupt download leaves the running version intact (no
 * mixed state).
 */
export function commitUpdate(
  install: KioskInstallation,
  candidate: InstalledVersion,
): Outcome<KioskInstallation> {
  const verified = verifyAgainstManifest(candidate.manifest, candidate.files);
  if (!verified.ok) return verified;
  return {
    ok: true,
    value: { current: candidate, previous: install.current },
    warnings: [],
  };
}

/**
 * Step 6 of D10.4: if the first boot on the new version fails, restore the
 * previous version automatically. The failed version is dropped.
 */
export function rollback(install: KioskInstallation): KioskInstallation {
  return { current: install.previous, previous: null };
}
