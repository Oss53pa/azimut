import type { SiteData } from '@azimut/core-model';
import {
  assemblePackage,
  manifestToJson,
  verifyPackage,
  scanForNetworkDependency,
} from '@azimut/engine-package';
import type { ArtifactInput } from '@azimut/engine-package';
import type { Job } from './job.js';

export type BuildKioskPackageContext = {
  readonly site: SiteData;
  /**
   * Resolve all artifact inputs for the kiosk package.
   * In production this reads from compiled-artifact storage;
   * in tests it returns mock data.
   */
  readonly resolveArtifacts: () => Promise<readonly ArtifactInput[]>;
};

export type BuildKioskPackageResult = {
  readonly package_id: string;
  readonly artifact_count: number;
  readonly total_size_bytes: number;
  readonly manifest_json_length: number;
  readonly verified: boolean;
  readonly network_clean: boolean;
};

/**
 * Create a job handler for `build_kiosk_package`.
 *
 * Assembles a kiosk deployment package:
 *   1. Resolves artifact inputs from context
 *   2. Assembles manifest via assemblePackage
 *   3. Verifies checksums via verifyPackage
 *   4. Scans for network dependencies via scanForNetworkDependency
 *
 * Payload:
 *   - package_id: string — unique package identifier
 *   - created_at: string — ISO timestamp for the manifest
 *
 * Throws when assembly, verification, or network scan fails.
 */
export function createBuildKioskPackageHandler(
  context: BuildKioskPackageContext,
): (job: Job) => Promise<Record<string, unknown>> {
  const { site, resolveArtifacts } = context;

  return async (job: Job): Promise<Record<string, unknown>> => {
    const payload = job.payload;
    const packageId =
      typeof payload['package_id'] === 'string'
        ? payload['package_id']
        : job.id;
    const createdAt =
      typeof payload['created_at'] === 'string'
        ? payload['created_at']
        : new Date().toISOString();

    // 1. Resolve artifacts
    const inputs = await resolveArtifacts();

    // 2. Assemble package
    const assembleResult = assemblePackage(
      site,
      packageId,
      createdAt,
      inputs,
    );
    if (!assembleResult.ok) {
      const codes = assembleResult.findings.map((f) => f.code).join(', ');
      throw new Error(`Package assembly failed: ${codes}`);
    }
    const manifest = assembleResult.value;

    // 3. Verify checksums (round-trip integrity)
    const contentMap = new Map<string, Uint8Array>();
    for (const input of inputs) {
      contentMap.set(input.id, input.content);
    }
    const verifyResult = verifyPackage(manifest, contentMap);
    if (!verifyResult.ok) {
      const codes = verifyResult.findings.map((f) => f.code).join(', ');
      throw new Error(`Package verification failed: ${codes}`);
    }

    // 4. Scan for network dependencies
    const scanResult = scanForNetworkDependency(contentMap);
    if (!scanResult.ok) {
      const codes = scanResult.findings
        .map((f) => `${f.entity?.id ?? '?'}:${f.params['patterns']}`)
        .join('; ');
      throw new Error(`Network dependency detected: ${codes}`);
    }

    const manifestJson = manifestToJson(manifest);

    return {
      package_id: manifest.package_id,
      artifact_count: manifest.artifact_count,
      total_size_bytes: manifest.total_size_bytes,
      manifest_json_length: manifestJson.length,
      verified: true,
      network_clean: true,
    };
  };
}
