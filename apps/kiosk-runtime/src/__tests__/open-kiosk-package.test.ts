import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit';
import { assembleKioskPackage, kioskManifestContentHash, kioskManifestToJson } from '@azimut/engine-package';
import type { KioskManifest } from '@azimut/engine-package';
import { sha256Binary } from '@azimut/core-model';
import { openKioskPackage } from '../open-kiosk-package.js';
import { kioskDataFiles } from './kiosk-data-files.js';

/**
 * Lot 10 de l'audit (A7.5, D-11) : la borne n'ouvre que le paquet que son
 * manifeste décrit, octet pour octet.
 */
const enc = new TextEncoder();

function genuine(): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>([
    ['index.html', enc.encode('<!doctype html><title>Borne</title>')],
    ['assets/app.js', enc.encode('export const boot = () => {};')],
    ['assets/app.css', enc.encode('body{margin:0}')],
    ['maps/level-0.svg', enc.encode('<svg xmlns="http://www.w3.org/2000/svg"/>')],
    ...kioskDataFiles(refMultilevel),
  ]);
  const built = assembleKioskPackage({
    siteId: refMultilevel.site.id, version: 1, builtAt: '2026-10-23T00:00:00.000Z',
    langs: ['fr', 'en'], minRuntime: '1.0.0', files,
  });
  if (!built.ok) throw new Error(JSON.stringify(built.findings));
  return new Map(built.value.files);
}

function manifestOf(files: ReadonlyMap<string, Uint8Array>): KioskManifest {
  return JSON.parse(new TextDecoder().decode(files.get('manifest.json'))) as KioskManifest;
}

function codes(files: ReadonlyMap<string, Uint8Array>): readonly string[] {
  const out = openKioskPackage(files);
  return out.ok ? [] : out.findings.map(f => `${f.code} ${String(f.params['path'] ?? f.params['reason'] ?? '')}`);
}

describe('lot 10 : la borne vérifie l’empreinte avant toute lecture', () => {
  it('ouvre le paquet authentique', () => {
    const out = openKioskPackage(genuine());
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.value.site.id).toBe(refMultilevel.site.id);
  });

  it('refuse un paquet dont un octet de data/graph.json a changé', () => {
    const files = genuine();
    const bytes = new Uint8Array(files.get('data/graph.json') ?? new Uint8Array());
    bytes[10] = (bytes[10] ?? 0) ^ 1;
    files.set('data/graph.json', bytes);
    expect(codes(files)).toEqual(['PACKAGE.INTEGRITY_MISMATCH data/graph.json']);
  });

  it('refuse un manifeste dont une empreinte a été recalculée sans le reste', () => {
    const files = genuine();
    const tampered = new TextEncoder().encode('{"nodes":[],"edges":[],"vertical_links":[]}');
    files.set('data/graph.json', tampered);
    const manifest = manifestOf(files);
    const forged: KioskManifest = {
      ...manifest,
      files: manifest.files.map(f => f.path === 'data/graph.json' ? { ...f, sha256: sha256Binary(tampered) } : f),
    };
    files.set('manifest.json', enc.encode(kioskManifestToJson(forged)));
    expect(codes(files)).toEqual(['PACKAGE.CHECKSUM_MISMATCH manifest content hash']);
  });

  it('refuse un paquet sans manifeste, ou au manifeste illisible ou mal formé', () => {
    const without = genuine();
    without.delete('manifest.json');
    expect(codes(without)).toEqual(['PACKAGE.FILE_MISSING manifest.json']);

    const unreadable = genuine();
    unreadable.set('manifest.json', enc.encode('{pas du json'));
    expect(codes(unreadable)).toEqual(['PACKAGE.CHECKSUM_MISMATCH manifest unreadable']);

    const malformed = genuine();
    malformed.set('manifest.json', enc.encode(JSON.stringify({ ...manifestOf(malformed), extra: true })));
    expect(codes(malformed)).toEqual(['PACKAGE.CHECKSUM_MISMATCH manifest malformed']);
  });

  it('refuse un fichier de données que le manifeste ne couvre pas', () => {
    const files = genuine();
    const manifest = manifestOf(files);
    const partial = { ...manifest, files: manifest.files.filter(f => f.path !== 'data/site.json') };
    const hash = kioskManifestContentHash(partial);
    if (!hash.ok) throw new Error('empreinte');
    files.set('manifest.json', enc.encode(kioskManifestToJson({ ...partial, contentHash: hash.value })));
    expect(codes(files)).toEqual(['PACKAGE.INTEGRITY_MISMATCH data/site.json']);
  });
});
