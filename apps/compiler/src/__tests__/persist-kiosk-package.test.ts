import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit';
import { assembleKioskPackage } from '@azimut/engine-package';
import type { KioskPackage } from '@azimut/engine-package';
import { buildKioskTree } from '../build-kiosk-tree.js';
import type { KioskAppAssets } from '../build-kiosk-tree.js';
import { memoryAssetStore } from '../asset-store.js';
import { persistKioskPackage } from '../persist-kiosk-package.js';

const enc = new TextEncoder();
const dec = new TextDecoder();

const appAssets: KioskAppAssets = {
  indexHtml: enc.encode('<!doctype html><title>Borne</title>'),
  appJs: enc.encode('export const boot = () => {};'),
  appCss: enc.encode('body{margin:0}'),
};

function assemble(builtAt: string): KioskPackage {
  const result = assembleKioskPackage({
    siteId: refMultilevel.site.id,
    version: 3,
    builtAt,
    langs: ['fr', 'en'],
    minRuntime: '1.0.0',
    files: buildKioskTree(refMultilevel, appAssets),
  });
  if (!result.ok) throw new Error('assembly failed');
  return result.value;
}

describe('persistKioskPackage (D10)', () => {
  it('writes every tree file under the storage path and returns the record', async () => {
    const pkg = assemble('2026-09-01T00:00:00Z');
    const sink = memoryAssetStore();
    const record = await persistKioskPackage(
      sink, 'sites/site-ml/v3', pkg.manifest, pkg.files,
    );

    expect(record.site_id).toBe(refMultilevel.site.id);
    expect(record.version).toBe(3);
    expect(record.storage_path).toBe('sites/site-ml/v3');
    expect(record.content_hash).toBe(pkg.manifest.contentHash);
    expect(record.checksum).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(record.built_at).toBe('2026-09-01T00:00:00Z');

    // Every tree file was written under the prefix, manifest.json included.
    for (const path of pkg.files.keys()) {
      const stored = await sink.read(`sites/site-ml/v3/${path}`);
      expect(dec.decode(stored)).toBe(dec.decode(pkg.files.get(path)));
    }
    expect(await sink.list('sites/site-ml/v3/')).toContain(
      'sites/site-ml/v3/manifest.json',
    );
  });

  it('checksum covers the manifest bytes (byte integrity of what was stored)', async () => {
    const pkg = assemble('2026-09-01T00:00:00Z');
    const sink = memoryAssetStore();
    const record = await persistKioskPackage(
      sink, 'p', pkg.manifest, pkg.files,
    );
    const manifestBytes = await sink.read('p/manifest.json');
    // Same manifest bytes → recomputing yields the same checksum tail.
    const again = await persistKioskPackage(
      memoryAssetStore(), 'p', pkg.manifest, pkg.files,
    );
    expect(record.checksum).toBe(again.checksum);
    expect(dec.decode(manifestBytes)).toContain(pkg.manifest.contentHash);
  });

  it('content_hash is stable but checksum tracks builtAt (D10.2)', async () => {
    const a = assemble('2026-01-01T00:00:00Z');
    const b = assemble('2030-12-31T23:59:59Z');
    const ra = await persistKioskPackage(memoryAssetStore(), 'p', a.manifest, a.files);
    const rb = await persistKioskPackage(memoryAssetStore(), 'p', b.manifest, b.files);

    expect(ra.content_hash).toBe(rb.content_hash); // identity ignores builtAt
    expect(ra.checksum).not.toBe(rb.checksum); // integrity includes builtAt
  });

  it('normalizes a trailing slash on the storage path', async () => {
    const pkg = assemble('2026-09-01T00:00:00Z');
    const sink = memoryAssetStore();
    await persistKioskPackage(sink, 'sites/x/', pkg.manifest, pkg.files);
    await expect(sink.read('sites/x/manifest.json')).resolves.toBeDefined();
  });

  it('throws if the tree has no manifest.json', async () => {
    const pkg = assemble('2026-09-01T00:00:00Z');
    const withoutManifest = new Map(pkg.files);
    withoutManifest.delete('manifest.json');
    await expect(
      persistKioskPackage(memoryAssetStore(), 'p', pkg.manifest, withoutManifest),
    ).rejects.toThrow('missing manifest.json');
  });
});
