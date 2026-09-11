import { describe, it, expect } from 'vitest';
import { assembleKioskPackage } from '../assemble-kiosk-package.js';
import type { KioskPackageInput } from '../assemble-kiosk-package.js';
import {
  shouldUpdate,
  verifyAgainstManifest,
  commitUpdate,
  rollback,
} from '../update-protocol.js';
import type { InstalledVersion, KioskInstallation } from '../update-protocol.js';

const enc = new TextEncoder();

function files(marker: string): Map<string, Uint8Array> {
  return new Map<string, Uint8Array>([
    ['index.html', enc.encode(`<!doctype html><title>${marker}</title>`)],
    ['assets/app.js', enc.encode('export const app = 1;')],
    ['assets/app.css', enc.encode('body{margin:0}')],
    ['data/graph.json', enc.encode(`{"marker":"${marker}"}`)],
    ['data/directory.json', enc.encode('{"destinations":[]}')],
    ['data/scene.json', enc.encode('{"volumes":[]}')],
    ['maps/level-0.svg', enc.encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
  ]);
}

function installed(version: number, marker: string): InstalledVersion {
  const input: KioskPackageInput = {
    siteId: 'site-1',
    version,
    builtAt: '2026-09-01T00:00:00Z',
    langs: ['fr', 'en'],
    minRuntime: '1.0.0',
    files: files(marker),
  };
  const r = assembleKioskPackage(input);
  if (!r.ok) throw new Error('assemble failed');
  return { manifest: r.value.manifest, files: r.value.files };
}

describe('D10.4 — shouldUpdate', () => {
  it('updates when no local version', () => {
    expect(shouldUpdate(null, 5)).toBe(true);
  });
  it('does not update when versions match', () => {
    expect(shouldUpdate(5, 5)).toBe(false);
  });
  it('updates when versions differ', () => {
    expect(shouldUpdate(4, 5)).toBe(true);
  });
});

describe('D10.4 — verifyAgainstManifest', () => {
  it('accepts a consistent tree', () => {
    const v = installed(1, 'v1');
    const result = verifyAgainstManifest(v.manifest, v.files);
    expect(result.ok).toBe(true);
  });

  it('rejects a tampered file with PACKAGE.INTEGRITY_MISMATCH', () => {
    const v = installed(1, 'v1');
    const tampered = new Map(v.files);
    tampered.set('assets/app.js', enc.encode('tampered'));
    const result = verifyAgainstManifest(v.manifest, tampered);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.some((f) => f.code === 'PACKAGE.INTEGRITY_MISMATCH')).toBe(true);
  });

  it('rejects a missing file with PACKAGE.INTEGRITY_MISMATCH', () => {
    const v = installed(1, 'v1');
    const partial = new Map(v.files);
    partial.delete('data/scene.json');
    const result = verifyAgainstManifest(v.manifest, partial);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.some(
      (f) => f.code === 'PACKAGE.INTEGRITY_MISMATCH' && f.params['path'] === 'data/scene.json',
    )).toBe(true);
  });

  it('rejects a tampered manifest content hash', () => {
    const v = installed(1, 'v1');
    const badManifest = { ...v.manifest, contentHash: 'sha256:' + '0'.repeat(64) };
    const result = verifyAgainstManifest(badManifest, v.files);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.some((f) => f.code === 'PACKAGE.CHECKSUM_MISMATCH')).toBe(true);
  });
});

describe('D10.4 — commitUpdate (atomic) and rollback', () => {
  it('commits a valid candidate and keeps the previous version', () => {
    const install: KioskInstallation = { current: installed(1, 'v1'), previous: null };
    const candidate = installed(2, 'v2');
    const result = commitUpdate(install, candidate);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.current?.manifest.version).toBe(2);
    expect(result.value.previous?.manifest.version).toBe(1);
  });

  it('decisive: an interrupted download leaves the running version intact (no mixed state)', () => {
    const oldVersion = installed(1, 'v1');
    const install: KioskInstallation = { current: oldVersion, previous: null };

    // Simulate a download interrupted mid-way: the candidate tree is missing
    // one file declared by its manifest.
    const partial = new Map(installed(2, 'v2').files);
    partial.delete('assets/app.css');
    const candidate: InstalledVersion = {
      manifest: installed(2, 'v2').manifest,
      files: partial,
    };

    const result = commitUpdate(install, candidate);
    // Commit refused → nothing swapped.
    expect(result.ok).toBe(false);
    // The installation the runtime keeps serving is still the complete v1.
    expect(install.current?.manifest.version).toBe(1);
    const stillValid = verifyAgainstManifest(oldVersion.manifest, oldVersion.files);
    expect(stillValid.ok).toBe(true);
  });

  it('rolls back to the previous version after a failed boot', () => {
    const install: KioskInstallation = {
      current: installed(2, 'v2'),
      previous: installed(1, 'v1'),
    };
    const rolled = rollback(install);
    expect(rolled.current?.manifest.version).toBe(1);
    expect(rolled.previous).toBeNull();
  });
});
