import { sha256Binary } from '@azimut/core-model';
import type { KioskManifest } from '@azimut/engine-package';
import type { AssetWriter } from './asset-store.js';

/**
 * D10 — Persist an assembled kiosk package to storage and produce the
 * `kiosk_package` record for the caller to insert.
 *
 * Writes every tree file (manifest.json included) under `<storagePath>/…` and
 * returns the record: `content_hash` is the manifest's deterministic identity
 * (builtAt excluded, D10.2); `checksum` is the byte integrity of exactly what
 * was stored — the SHA-256 of the manifest.json bytes, which cover every file's
 * hash plus builtAt. The record mirrors the `kiosk_package` table; persisting
 * the DB row is the caller's responsibility (the compiler holds no DB handle).
 */
export type KioskPackageRecord = {
  readonly site_id: string;
  readonly version: number;
  readonly storage_path: string;
  readonly checksum: string;
  readonly content_hash: string;
  readonly built_at: string;
};

/** Join a storage path prefix and a tree-relative path (POSIX, no double slash). */
function joinStorage(storagePath: string, treePath: string): string {
  const base = storagePath.replace(/\/+$/, '');
  return base.length === 0 ? treePath : `${base}/${treePath}`;
}

export async function persistKioskPackage(
  sink: AssetWriter,
  storagePath: string,
  manifest: KioskManifest,
  tree: ReadonlyMap<string, Uint8Array>,
): Promise<KioskPackageRecord> {
  const manifestBytes = tree.get('manifest.json');
  if (manifestBytes === undefined) {
    throw new Error('Assembled kiosk tree is missing manifest.json');
  }

  // Deterministic write order (sorted paths) — a sink may key on order.
  const paths = [...tree.keys()].sort();
  for (const path of paths) {
    await sink.write(joinStorage(storagePath, path), tree.get(path) as Uint8Array);
  }

  return {
    site_id: manifest.siteId,
    version: manifest.version,
    storage_path: storagePath,
    checksum: `sha256:${sha256Binary(manifestBytes)}`,
    content_hash: manifest.contentHash,
    built_at: manifest.builtAt,
  };
}
