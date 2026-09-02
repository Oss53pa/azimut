import type {
  SiteData,
  Outcome,
  Finding,
} from '@azimut/core-model';

export type ArtifactKind =
  | 'artwork_pdf'
  | 'artwork_svg'
  | 'floor_plan'
  | 'oriented_plan'
  | 'evacuation_plan'
  | 'isometric_view'
  | 'quantity_csv';

export type PackageArtifact = {
  readonly id: string;
  readonly kind: ArtifactKind;
  readonly path: string;
  readonly size_bytes: number;
  readonly checksum: string;
  readonly metadata: Record<string, string>;
};

export type PackageManifest = {
  readonly package_id: string;
  readonly site_id: string;
  readonly org_id: string;
  readonly created_at: string;
  readonly artifacts: readonly PackageArtifact[];
  readonly total_size_bytes: number;
  readonly artifact_count: number;
};

export type ArtifactInput = {
  readonly id: string;
  readonly kind: ArtifactKind;
  readonly path: string;
  readonly content: Uint8Array;
  readonly metadata: Record<string, string>;
};

function computeChecksum(data: Uint8Array): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const byte = data[i] as number;
    hash = ((hash << 5) - hash + byte) | 0;
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return `djb2-${hex}`;
}

function validateArtifact(
  input: ArtifactInput,
  index: number,
): Finding | null {
  if (input.content.length === 0) {
    return {
      code: 'PACKAGE.EMPTY_ARTIFACT',
      severity: 'warning',
      entity: { kind: 'artifact', id: input.id },
      params: { index, path: input.path },
      ruleRef: null,
    };
  }
  return null;
}

export function assemblePackage(
  site: SiteData,
  packageId: string,
  createdAt: string,
  inputs: readonly ArtifactInput[],
): Outcome<PackageManifest> {
  const warnings: Finding[] = [];

  const sortedInputs = [...inputs].sort(
    (a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id),
  );

  const seenIds = new Set<string>();
  const seenPaths = new Set<string>();
  const blockingFindings: Finding[] = [];

  for (let i = 0; i < sortedInputs.length; i++) {
    const input = sortedInputs[i] as ArtifactInput;

    if (seenIds.has(input.id)) {
      blockingFindings.push({
        code: 'PACKAGE.DUPLICATE_ID',
        severity: 'blocking',
        entity: { kind: 'artifact', id: input.id },
        params: { id: input.id, index: i },
        ruleRef: null,
      });
    }
    seenIds.add(input.id);

    if (seenPaths.has(input.path)) {
      blockingFindings.push({
        code: 'PACKAGE.DUPLICATE_PATH',
        severity: 'blocking',
        entity: { kind: 'artifact', id: input.id },
        params: { path: input.path, index: i },
        ruleRef: null,
      });
    }
    seenPaths.add(input.path);

    const warn = validateArtifact(input, i);
    if (warn) {
      warnings.push(warn);
    }
  }

  if (blockingFindings.length > 0) {
    return { ok: false, findings: blockingFindings };
  }

  const artifacts: PackageArtifact[] = sortedInputs.map((input) => ({
    id: input.id,
    kind: input.kind,
    path: input.path,
    size_bytes: input.content.length,
    checksum: computeChecksum(input.content),
    metadata: { ...input.metadata },
  }));

  let totalSize = 0;
  for (const a of artifacts) {
    totalSize += a.size_bytes;
  }

  const manifest: PackageManifest = {
    package_id: packageId,
    site_id: site.site.id,
    org_id: site.organization.id,
    created_at: createdAt,
    artifacts,
    total_size_bytes: totalSize,
    artifact_count: artifacts.length,
  };

  return { ok: true, value: manifest, warnings };
}

export function manifestToJson(manifest: PackageManifest): string {
  const sorted = {
    package_id: manifest.package_id,
    site_id: manifest.site_id,
    org_id: manifest.org_id,
    created_at: manifest.created_at,
    artifact_count: manifest.artifact_count,
    total_size_bytes: manifest.total_size_bytes,
    artifacts: manifest.artifacts.map((a) => ({
      id: a.id,
      kind: a.kind,
      path: a.path,
      size_bytes: a.size_bytes,
      checksum: a.checksum,
      metadata: a.metadata,
    })),
  };
  return JSON.stringify(sorted, null, 2);
}
