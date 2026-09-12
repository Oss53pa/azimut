import type { SiteData } from '@azimut/core-model';
import { assembleKioskPackage } from '@azimut/engine-package';
import { buildKioskTree, buildKioskTreeFromStore } from './build-kiosk-tree.js';
import type { KioskAppAssets } from './build-kiosk-tree.js';
import type { AssetStore } from './asset-store.js';
import type { Job } from './job.js';

/**
 * D10 — `build_kiosk_package` job handler.
 *
 * Produces the kiosk deployment tree (index.html, assets, data, maps) and its
 * D10.2 manifest via assembleKioskPackage. The runtime app assets and the
 * generated data/map files are resolved from storage by the context; assembly
 * validates the tree (required files, no absolute path, no outbound reference)
 * and computes the deterministic contentHash (builtAt excluded).
 */
export type BuildKioskPackageContext = {
  readonly site: SiteData;
  /**
   * Resolve the kiosk tree files, keyed by relative path. In production this
   * reads compiled artifacts from storage; in tests it returns fixture bytes.
   */
  readonly resolveKioskFiles: () => Promise<ReadonlyMap<string, Uint8Array>>;
  /** Site content version stamped on the manifest. */
  readonly version: number;
  /** Active languages of the site. */
  readonly langs: readonly string[];
  /** Minimum kiosk runtime version required. */
  readonly minRuntime: string;
};

export type BuildKioskPackageResult = {
  readonly site_id: string;
  readonly version: number;
  readonly content_hash: string;
  readonly file_count: number;
  readonly total_size_bytes: number;
  readonly built_at: string;
  readonly network_clean: boolean;
};

/**
 * Compose a {@link BuildKioskPackageContext} from a site and the built runtime
 * app assets. The generated data/map files are produced deterministically by
 * {@link buildKioskTree}, closing the D10 loop: site → tree → manifest.
 */
export function kioskContextFromAssets(
  site: SiteData,
  appAssets: KioskAppAssets,
  meta: { version: number; langs: readonly string[]; minRuntime: string },
): BuildKioskPackageContext {
  return {
    site,
    resolveKioskFiles: async () => buildKioskTree(site, appAssets),
    version: meta.version,
    langs: meta.langs,
    minRuntime: meta.minRuntime,
  };
}

/**
 * Compose a {@link BuildKioskPackageContext} that reads the runtime app bundle
 * from a storage port ({@link AssetStore}) and generates the per-site data and
 * maps in-process. This is the production wiring: the static bundle lives in
 * storage, the site-derived files are computed at build time.
 */
export function kioskContextFromStore(
  site: SiteData,
  store: AssetStore,
  meta: { version: number; langs: readonly string[]; minRuntime: string },
): BuildKioskPackageContext {
  return {
    site,
    resolveKioskFiles: () => buildKioskTreeFromStore(site, store),
    version: meta.version,
    langs: meta.langs,
    minRuntime: meta.minRuntime,
  };
}

export function createBuildKioskPackageHandler(
  context: BuildKioskPackageContext,
): (job: Job) => Promise<Record<string, unknown>> {
  const { site, resolveKioskFiles, version, langs, minRuntime } = context;

  return async (job: Job): Promise<Record<string, unknown>> => {
    const payload = job.payload;
    const builtAt =
      typeof payload['built_at'] === 'string'
        ? payload['built_at']
        : new Date().toISOString();

    const files = await resolveKioskFiles();

    const result = assembleKioskPackage({
      siteId: site.site.id,
      version,
      builtAt,
      langs,
      minRuntime,
      files,
    });

    if (!result.ok) {
      const codes = result.findings.map((f) => f.code).join(', ');
      throw new Error(`Kiosk package assembly failed: ${codes}`);
    }

    const { manifest, files: tree } = result.value;
    let totalSize = 0;
    for (const bytes of tree.values()) totalSize += bytes.length;

    const summary: BuildKioskPackageResult = {
      site_id: manifest.siteId,
      version: manifest.version,
      content_hash: manifest.contentHash,
      file_count: manifest.files.length,
      total_size_bytes: totalSize,
      built_at: manifest.builtAt,
      network_clean: true,
    };
    return { ...summary };
  };
}
