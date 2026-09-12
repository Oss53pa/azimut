import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit';
import type { SiteData } from '@azimut/core-model';
import {
  createKioskPackageJobHandler,
  siteActiveLangs,
} from '../kiosk-package-job.js';
import { memoryAssetStore } from '../asset-store.js';
import type { KioskPackageRecord } from '../persist-kiosk-package.js';
import type { Job } from '../job.js';

const enc = new TextEncoder();

function bundleStore() {
  return memoryAssetStore(
    new Map<string, Uint8Array>([
      ['index.html', enc.encode('<!doctype html><title>Borne</title>')],
      ['assets/app.js', enc.encode('export const boot = () => {};')],
      ['assets/app.css', enc.encode('body{margin:0}')],
    ]),
  );
}

function makeJob(payload: Record<string, unknown>): Job {
  return {
    id: 'job-1',
    org_id: 'org-42',
    kind: 'build_kiosk_package',
    state: 'running',
    payload,
    result: null,
    attempts: 1,
    max_attempts: 3,
    created_at: new Date('2026-09-01T12:00:00Z'),
    started_at: new Date('2026-09-01T12:00:01Z'),
    finished_at: null,
    error: null,
  };
}

describe('siteActiveLangs', () => {
  it('returns the distinct directory languages, sorted', () => {
    expect(siteActiveLangs(refMultilevel)).toEqual(['en', 'fr']);
  });

  it('falls back to fr when the directory has no names', () => {
    const bare: SiteData = { ...refMultilevel, destination_names: [] };
    expect(siteActiveLangs(bare)).toEqual(['fr']);
  });
});

describe('createKioskPackageJobHandler (D10 — job-driven)', () => {
  it('loads the site, assembles, persists and records in one flow', async () => {
    const loaded: Array<{ orgId: string; siteId: string }> = [];
    const records: Array<{ record: KioskPackageRecord; orgId: string }> = [];
    const sink = memoryAssetStore();

    const handler = createKioskPackageJobHandler({
      loadSite: async (orgId, siteId) => {
        loaded.push({ orgId, siteId });
        return refMultilevel;
      },
      bundleStore: bundleStore(),
      packageSink: sink,
      storagePathFor: (siteId, version) => `sites/${siteId}/v${version}`,
      recordPackage: async (record, orgId) => { records.push({ record, orgId }); },
      minRuntime: '1.0.0',
    });

    const result = await handler(
      makeJob({ site_id: refMultilevel.site.id, version: 6, built_at: '2026-09-01T00:00:00Z' }),
    );

    // Site was loaded with the job org and payload site.
    expect(loaded).toEqual([{ orgId: 'org-42', siteId: refMultilevel.site.id }]);

    // Package summary.
    expect(result['site_id']).toBe(refMultilevel.site.id);
    expect(result['version']).toBe(6);
    expect(result['content_hash']).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(result['storage_path']).toBe(`sites/${refMultilevel.site.id}/v6`);

    // Written to storage.
    const prefix = `sites/${refMultilevel.site.id}/v6`;
    await expect(sink.read(`${prefix}/manifest.json`)).resolves.toBeDefined();
    await expect(sink.read(`${prefix}/data/site.json`)).resolves.toBeDefined();

    // DB row recorded with the job org.
    expect(records).toHaveLength(1);
    expect(records[0]?.orgId).toBe('org-42');
    expect(records[0]?.record.storage_path).toBe(prefix);
  });

  it('advertises the site active languages by default', async () => {
    const sink = memoryAssetStore();
    const handler = createKioskPackageJobHandler({
      loadSite: async () => refMultilevel,
      bundleStore: bundleStore(),
      packageSink: sink,
      storagePathFor: () => 'p',
      minRuntime: '1.0.0',
    });
    await handler(makeJob({ site_id: 's', version: 1 }));
    const manifest = JSON.parse(new TextDecoder().decode(await sink.read('p/manifest.json')));
    expect(manifest.langs).toEqual(['en', 'fr']);
  });

  it('rejects a payload without site_id', async () => {
    const handler = createKioskPackageJobHandler({
      loadSite: async () => refMultilevel,
      bundleStore: bundleStore(),
      packageSink: memoryAssetStore(),
      storagePathFor: () => 'p',
      minRuntime: '1.0.0',
    });
    await expect(handler(makeJob({ version: 1 }))).rejects.toThrow('site_id');
  });

  it('rejects a payload without an integer version', async () => {
    const handler = createKioskPackageJobHandler({
      loadSite: async () => refMultilevel,
      bundleStore: bundleStore(),
      packageSink: memoryAssetStore(),
      storagePathFor: () => 'p',
      minRuntime: '1.0.0',
    });
    await expect(handler(makeJob({ site_id: 's', version: 'x' }))).rejects.toThrow('version');
  });
});
