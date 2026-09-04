import { describe, it, expect } from 'vitest';
import { createBuildKioskPackageHandler } from '../build-kiosk-package.js';
import type { BuildKioskPackageContext } from '../build-kiosk-package.js';
import type { Job } from '../job.js';
import type { ArtifactInput } from '@azimut/engine-package';
import { refMinimal } from '@azimut/testkit';

const enc = new TextEncoder();

function makeArtifact(overrides?: Partial<ArtifactInput>): ArtifactInput {
  return {
    id: 'art-001',
    kind: 'artwork_svg',
    path: 'artworks/panel-001.svg',
    content: enc.encode('<svg><rect width="10" height="10"/></svg>'),
    metadata: { support_id: 'sup-001' },
    ...overrides,
  };
}

function makeJob(payload?: Record<string, unknown>): Job {
  return {
    id: 'job-kiosk-001',
    org_id: 'org-test-001',
    kind: 'build_kiosk_package',
    state: 'running',
    payload: payload ?? {},
    result: null,
    attempts: 1,
    max_attempts: 3,
    created_at: new Date('2024-06-15T12:00:00Z'),
    started_at: new Date('2024-06-15T12:00:01Z'),
    finished_at: null,
    error: null,
  };
}

function makeContext(
  artifacts: readonly ArtifactInput[],
): BuildKioskPackageContext {
  return {
    site: refMinimal,
    resolveArtifacts: async () => artifacts,
  };
}

describe('createBuildKioskPackageHandler', () => {
  it('assembles a valid package from clean artifacts', async () => {
    const artifacts = [makeArtifact()];
    const handler = createBuildKioskPackageHandler(makeContext(artifacts));
    const job = makeJob({
      package_id: 'pkg-001',
      created_at: '2024-06-15T12:00:00Z',
    });

    const result = await handler(job);
    expect(result['package_id']).toBe('pkg-001');
    expect(result['artifact_count']).toBe(1);
    expect(result['total_size_bytes']).toBeGreaterThan(0);
    expect(result['manifest_json_length']).toBeGreaterThan(0);
    expect(result['verified']).toBe(true);
    expect(result['network_clean']).toBe(true);
  });

  it('handles multiple artifacts', async () => {
    const artifacts = [
      makeArtifact({ id: 'art-1', path: 'a.svg' }),
      makeArtifact({
        id: 'art-2',
        path: 'b.svg',
        content: enc.encode('<svg><text>Hello</text></svg>'),
      }),
    ];
    const handler = createBuildKioskPackageHandler(makeContext(artifacts));
    const result = await handler(makeJob({
      package_id: 'pkg-multi',
      created_at: '2024-06-15T12:00:00Z',
    }));

    expect(result['artifact_count']).toBe(2);
    expect(result['verified']).toBe(true);
  });

  it('handles empty artifact list', async () => {
    const handler = createBuildKioskPackageHandler(makeContext([]));
    const result = await handler(makeJob({
      package_id: 'pkg-empty',
      created_at: '2024-06-15T12:00:00Z',
    }));

    expect(result['artifact_count']).toBe(0);
    expect(result['total_size_bytes']).toBe(0);
  });

  it('defaults package_id to job id when not in payload', async () => {
    const handler = createBuildKioskPackageHandler(makeContext([makeArtifact()]));
    const result = await handler(makeJob({
      created_at: '2024-06-15T12:00:00Z',
    }));

    expect(result['package_id']).toBe('job-kiosk-001');
  });

  it('throws when artifacts contain network dependencies', async () => {
    const artifacts = [
      makeArtifact({
        id: 'art-net',
        path: 'bad.js',
        kind: 'artwork_svg',
        content: enc.encode('fetch("https://evil.com/data")'),
      }),
    ];
    const handler = createBuildKioskPackageHandler(makeContext(artifacts));

    await expect(
      handler(makeJob({
        package_id: 'pkg-net',
        created_at: '2024-06-15T12:00:00Z',
      })),
    ).rejects.toThrow('Network dependency detected');
  });

  it('throws when artifacts have duplicate ids', async () => {
    const artifacts = [
      makeArtifact({ id: 'art-dup', path: 'a.svg' }),
      makeArtifact({ id: 'art-dup', path: 'b.svg' }),
    ];
    const handler = createBuildKioskPackageHandler(makeContext(artifacts));

    await expect(
      handler(makeJob({
        package_id: 'pkg-dup',
        created_at: '2024-06-15T12:00:00Z',
      })),
    ).rejects.toThrow('Package assembly failed');
  });

  it('is deterministic (INV-4)', async () => {
    const artifacts = [
      makeArtifact({ id: 'art-1', path: 'a.svg' }),
      makeArtifact({
        id: 'art-2',
        path: 'b.svg',
        content: enc.encode('<svg><circle r="5"/></svg>'),
      }),
    ];
    const handler = createBuildKioskPackageHandler(makeContext(artifacts));
    const job = makeJob({
      package_id: 'pkg-det',
      created_at: '2024-06-15T12:00:00Z',
    });

    const r1 = await handler(job);
    const r2 = await handler(job);
    expect(r1).toStrictEqual(r2);
  });

  it('throws when duplicate paths', async () => {
    const artifacts = [
      makeArtifact({ id: 'art-1', path: 'same.svg' }),
      makeArtifact({ id: 'art-2', path: 'same.svg' }),
    ];
    const handler = createBuildKioskPackageHandler(makeContext(artifacts));

    await expect(
      handler(makeJob({
        package_id: 'pkg-dup-path',
        created_at: '2024-06-15T12:00:00Z',
      })),
    ).rejects.toThrow('Package assembly failed');
  });

  it('defaults created_at to current timestamp when not in payload', async () => {
    const handler = createBuildKioskPackageHandler(makeContext([makeArtifact()]));
    const result = await handler(makeJob({
      package_id: 'pkg-ts',
      // no created_at → defaults to new Date().toISOString()
    }));

    // Package was assembled with a generated timestamp
    expect(result['package_id']).toBe('pkg-ts');
    expect(result['artifact_count']).toBe(1);
    expect(typeof result['manifest_json_length']).toBe('number');
  });

  it('non-string package_id falls back to job.id', async () => {
    const handler = createBuildKioskPackageHandler(makeContext([makeArtifact()]));
    const result = await handler(makeJob({
      package_id: 42,
      created_at: '2024-06-15T12:00:00Z',
    }));

    expect(result['package_id']).toBe('job-kiosk-001');
  });

  it('propagates resolveArtifacts rejection', async () => {
    const context: BuildKioskPackageContext = {
      site: refMinimal,
      resolveArtifacts: async () => { throw new Error('storage unavailable'); },
    };
    const handler = createBuildKioskPackageHandler(context);

    await expect(
      handler(makeJob({
        package_id: 'pkg-err',
        created_at: '2024-06-15T12:00:00Z',
      })),
    ).rejects.toThrow('storage unavailable');
  });

  it('is deterministic (INV-4)', async () => {
    const artifacts = [makeArtifact()];
    const handler = createBuildKioskPackageHandler(makeContext(artifacts));
    const job = makeJob({
      package_id: 'pkg-det',
      created_at: '2024-06-15T12:00:00Z',
    });
    const r1 = await handler(job);
    const r2 = await handler(job);
    expect(r1).toStrictEqual(r2);
  });

  it('multiple artifacts produce a larger package', async () => {
    const artifacts = [
      makeArtifact({ id: 'art-1', path: 'artworks/p1.svg' }),
      makeArtifact({ id: 'art-2', path: 'artworks/p2.svg',
        content: enc.encode('<svg><circle r="5"/></svg>') }),
    ];
    const handler = createBuildKioskPackageHandler(makeContext(artifacts));
    const result = await handler(makeJob({
      package_id: 'pkg-multi',
      created_at: '2024-06-15T12:00:00Z',
    }));
    expect(result['artifact_count']).toBe(2);
    expect(result['verified']).toBe(true);
  });
});
