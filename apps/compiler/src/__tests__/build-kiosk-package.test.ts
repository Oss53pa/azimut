import { describe, it, expect } from 'vitest';
import {
  createBuildKioskPackageHandler,
  kioskContextFromAssets,
} from '../build-kiosk-package.js';
import type { BuildKioskPackageContext } from '../build-kiosk-package.js';
import type { KioskAppAssets } from '../build-kiosk-tree.js';
import type { Job } from '../job.js';
import { refMinimal, refMultilevel } from '@azimut/testkit';

const enc = new TextEncoder();

function kioskFiles(): Map<string, Uint8Array> {
  return new Map<string, Uint8Array>([
    ['index.html', enc.encode('<!doctype html><title>Borne</title>')],
    ['assets/app.js', enc.encode('export const app = 1;')],
    ['assets/app.css', enc.encode('body{margin:0}')],
    ['data/graph.json', enc.encode('{"nodes":[]}')],
    ['data/directory.json', enc.encode('{"destinations":[]}')],
    ['data/scene.json', enc.encode('{"volumes":[]}')],
    ['maps/level-0.svg', enc.encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
  ]);
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
  files: ReadonlyMap<string, Uint8Array>,
): BuildKioskPackageContext {
  return {
    site: refMinimal,
    resolveKioskFiles: async () => files,
    version: 42,
    langs: ['fr', 'en'],
    minRuntime: '1.0.0',
  };
}

describe('createBuildKioskPackageHandler (D10)', () => {
  it('assembles a valid kiosk package tree and manifest', async () => {
    const handler = createBuildKioskPackageHandler(makeContext(kioskFiles()));
    const result = await handler(makeJob({ built_at: '2026-09-01T00:00:00Z' }));

    expect(result['site_id']).toBe(refMinimal.site.id);
    expect(result['version']).toBe(42);
    expect(result['content_hash']).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(result['file_count']).toBe(7);
    expect(result['total_size_bytes']).toBeGreaterThan(0);
    expect(result['built_at']).toBe('2026-09-01T00:00:00Z');
    expect(result['network_clean']).toBe(true);
  });

  it('content_hash is independent of built_at (D10.2)', async () => {
    const handler = createBuildKioskPackageHandler(makeContext(kioskFiles()));
    const a = await handler(makeJob({ built_at: '2026-01-01T00:00:00Z' }));
    const b = await handler(makeJob({ built_at: '2030-12-31T23:59:59Z' }));
    expect(a['content_hash']).toBe(b['content_hash']);
    expect(a['built_at']).not.toBe(b['built_at']);
  });

  it('defaults built_at to now when absent from payload', async () => {
    const handler = createBuildKioskPackageHandler(makeContext(kioskFiles()));
    const result = await handler(makeJob({}));
    expect(typeof result['built_at']).toBe('string');
    expect(result['content_hash']).toMatch(/^sha256:/);
  });

  it('throws when a required file is missing', async () => {
    const files = kioskFiles();
    files.delete('data/scene.json');
    const handler = createBuildKioskPackageHandler(makeContext(files));
    await expect(handler(makeJob())).rejects.toThrow('Kiosk package assembly failed');
  });

  it('throws on an absolute path', async () => {
    const files = kioskFiles();
    files.set('/etc/passwd', enc.encode('x'));
    const handler = createBuildKioskPackageHandler(makeContext(files));
    await expect(handler(makeJob())).rejects.toThrow('Kiosk package assembly failed');
  });

  it('throws on an outbound network reference (D10.1)', async () => {
    const files = kioskFiles();
    files.set('assets/app.js', enc.encode('fetch("https://evil.com/x")'));
    const handler = createBuildKioskPackageHandler(makeContext(files));
    await expect(handler(makeJob())).rejects.toThrow('Kiosk package assembly failed');
  });

  it('propagates a resolveKioskFiles rejection', async () => {
    const context: BuildKioskPackageContext = {
      site: refMinimal,
      resolveKioskFiles: async () => { throw new Error('storage unavailable'); },
      version: 1,
      langs: ['fr'],
      minRuntime: '1.0.0',
    };
    const handler = createBuildKioskPackageHandler(context);
    await expect(handler(makeJob())).rejects.toThrow('storage unavailable');
  });

  it('is deterministic (INV-4)', async () => {
    const handler = createBuildKioskPackageHandler(makeContext(kioskFiles()));
    const job = makeJob({ built_at: '2026-09-01T00:00:00Z' });
    expect(await handler(job)).toStrictEqual(await handler(job));
  });
});

describe('kioskContextFromAssets (D10 — end to end)', () => {
  const appAssets: KioskAppAssets = {
    indexHtml: enc.encode('<!doctype html><title>Borne</title><div id="app"></div>'),
    appJs: enc.encode('export const boot = () => {};'),
    appCss: enc.encode('body{margin:0;font-family:system-ui}'),
  };

  it('composes a context that assembles a real site into a manifest', async () => {
    const context = kioskContextFromAssets(refMultilevel, appAssets, {
      version: 7,
      langs: ['fr', 'en'],
      minRuntime: '1.0.0',
    });
    const handler = createBuildKioskPackageHandler(context);
    const result = await handler(makeJob({ built_at: '2026-09-01T00:00:00Z' }));

    expect(result['site_id']).toBe(refMultilevel.site.id);
    expect(result['version']).toBe(7);
    expect(result['content_hash']).toMatch(/^sha256:[0-9a-f]{64}$/);
    // index.html + app.js + app.css + 3 data files + one map per level (2).
    expect(result['file_count']).toBe(8);
    expect(result['network_clean']).toBe(true);
  });

  it('is deterministic across two independent composed contexts (INV-4)', async () => {
    const meta = { version: 7, langs: ['fr', 'en'], minRuntime: '1.0.0' };
    const a = await createBuildKioskPackageHandler(
      kioskContextFromAssets(refMultilevel, appAssets, meta),
    )(makeJob({ built_at: '2026-09-01T00:00:00Z' }));
    const b = await createBuildKioskPackageHandler(
      kioskContextFromAssets(refMultilevel, appAssets, meta),
    )(makeJob({ built_at: '2030-12-31T23:59:59Z' }));
    expect(a['content_hash']).toBe(b['content_hash']);
  });
});
