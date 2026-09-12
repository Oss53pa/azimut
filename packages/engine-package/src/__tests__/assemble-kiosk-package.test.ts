import { describe, it, expect } from 'vitest';
import {
  assembleKioskPackage,
  kioskManifestToJson,
} from '../assemble-kiosk-package.js';
import type { KioskPackageInput } from '../assemble-kiosk-package.js';

const enc = new TextEncoder();
const dec = new TextDecoder();

function baseFiles(): Map<string, Uint8Array> {
  return new Map<string, Uint8Array>([
    ['index.html', enc.encode('<!doctype html><title>Borne</title>')],
    ['assets/app.js', enc.encode('export const app = 1;')],
    ['assets/app.css', enc.encode('body{margin:0}')],
    ['data/graph.json', enc.encode('{"nodes":[]}')],
    ['data/directory.json', enc.encode('{"destinations":[]}')],
    ['data/scene.json', enc.encode('{"volumes":[]}')],
    ['data/site.json', enc.encode('{"site":{}}')],
    ['maps/level-0.svg', enc.encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
  ]);
}

function baseInput(overrides?: Partial<KioskPackageInput>): KioskPackageInput {
  return {
    siteId: 'site-1',
    version: 42,
    builtAt: '2026-09-01T00:00:00Z',
    langs: ['fr', 'en'],
    minRuntime: '1.0.0',
    files: baseFiles(),
    ...overrides,
  };
}

describe('D10.1 / D10.2 — assembleKioskPackage', () => {
  it('assembles the required tree and a conformant manifest', () => {
    const result = assembleKioskPackage(baseInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { manifest, files } = result.value;

    expect(manifest.siteId).toBe('site-1');
    expect(manifest.version).toBe(42);
    expect(manifest.builtAt).toBe('2026-09-01T00:00:00Z');
    expect(manifest.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(manifest.langs).toEqual(['en', 'fr']); // sorted
    expect(manifest.minRuntime).toBe('1.0.0');
    // manifest.json is added to the tree; not listed in files[].
    expect(files.has('manifest.json')).toBe(true);
    expect(manifest.files.some((f) => f.path === 'manifest.json')).toBe(false);
    // Every content file is listed with a sha256.
    for (const f of manifest.files) {
      expect(f.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('manifest files are sorted by path (determinism)', () => {
    const result = assembleKioskPackage(baseInput());
    if (!result.ok) return;
    const paths = result.value.manifest.files.map((f) => f.path);
    expect(paths).toEqual([...paths].sort());
  });

  it('excludes builtAt from contentHash (D10.2, the only non-deterministic field)', () => {
    const a = assembleKioskPackage(baseInput({ builtAt: '2026-01-01T00:00:00Z' }));
    const b = assembleKioskPackage(baseInput({ builtAt: '2030-12-31T23:59:59Z' }));
    if (!a.ok || !b.ok) throw new Error('should assemble');
    expect(a.value.manifest.contentHash).toBe(b.value.manifest.contentHash);
    expect(a.value.manifest.builtAt).not.toBe(b.value.manifest.builtAt);
  });

  it('contentHash changes when a content file changes', () => {
    const a = assembleKioskPackage(baseInput());
    const mutated = baseFiles();
    mutated.set('data/graph.json', enc.encode('{"nodes":[{"id":"n1"}]}'));
    const b = assembleKioskPackage(baseInput({ files: mutated }));
    if (!a.ok || !b.ok) throw new Error('should assemble');
    expect(a.value.manifest.contentHash).not.toBe(b.value.manifest.contentHash);
  });

  it('rejects a missing required file with PACKAGE.FILE_MISSING', () => {
    const files = baseFiles();
    files.delete('assets/app.js');
    const result = assembleKioskPackage(baseInput({ files }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.some((f) => f.code === 'PACKAGE.FILE_MISSING')).toBe(true);
  });

  it('requires at least one maps/level-<ordinal>.svg', () => {
    const files = baseFiles();
    files.delete('maps/level-0.svg');
    const result = assembleKioskPackage(baseInput({ files }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.some(
      (f) => f.code === 'PACKAGE.FILE_MISSING' && f.params['path'] === 'maps/level-<ordinal>.svg',
    )).toBe(true);
  });

  it('rejects an absolute path with PACKAGE.ABSOLUTE_PATH', () => {
    const files = baseFiles();
    files.set('/etc/passwd', enc.encode('x'));
    const result = assembleKioskPackage(baseInput({ files }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.some((f) => f.code === 'PACKAGE.ABSOLUTE_PATH')).toBe(true);
  });

  it('rejects a parent-directory escape', () => {
    const files = baseFiles();
    files.set('../secret.txt', enc.encode('x'));
    const result = assembleKioskPackage(baseInput({ files }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.some((f) => f.code === 'PACKAGE.ABSOLUTE_PATH')).toBe(true);
  });

  it('rejects an external network reference (D10.1)', () => {
    const files = baseFiles();
    files.set('index.html', enc.encode('<script src="https://cdn.example.com/a.js"></script>'));
    const result = assembleKioskPackage(baseInput({ files }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.some((f) => f.code === 'PACKAGE.NETWORK_DEPENDENCY')).toBe(true);
  });

  it('manifest.json round-trips through kioskManifestToJson', () => {
    const result = assembleKioskPackage(baseInput());
    if (!result.ok) return;
    const json = dec.decode(result.value.files.get('manifest.json'));
    expect(json).toBe(kioskManifestToJson(result.value.manifest));
    const parsed = JSON.parse(json);
    expect(parsed.builtAt).toBe('2026-09-01T00:00:00Z');
    expect(parsed.contentHash).toBe(result.value.manifest.contentHash);
  });
});
