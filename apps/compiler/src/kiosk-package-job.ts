import type { SiteData } from '@azimut/core-model';
import { loadSiteDataAs } from '@azimut/db';
import type { PostgresJsDatabase } from '@azimut/db';
import { createBuildKioskPackageHandler } from './build-kiosk-package.js';
import type { BuildKioskPackageContext } from './build-kiosk-package.js';
import { buildKioskTreeFromStore } from './build-kiosk-tree.js';
import type { AssetStore, AssetWriter } from './asset-store.js';
import type { PackageRecorder } from './db-package-recorder.js';
import type { Job } from './job.js';

/**
 * D10 — Job-driven `build_kiosk_package` handler.
 *
 * Ties every port together into one worker-registrable handler: per job it
 * loads the site, reads the runtime bundle from storage, assembles the tree and
 * manifest, writes the package to storage and records the `kiosk_package` row.
 * The site is loaded per job (not baked into a context), so a single handler
 * serves every site the worker sees.
 *
 * The job payload carries `site_id` and `version`; the org comes from the job.
 */
export type KioskPackageJobDeps = {
  /**
   * Load the site model for a job, as its requester (A6.1). Defaults to
   * {@link dbLoadSite} in prod.
   */
  readonly loadSite: (orgId: string, siteId: string, requestedBy: string) => Promise<SiteData>;
  /** Storage the runtime app bundle is read from. */
  readonly bundleStore: AssetStore;
  /** Storage the assembled package is written to. */
  readonly packageSink: AssetWriter;
  /** Storage path prefix for a given site/version. */
  readonly storagePathFor: (siteId: string, version: number) => string;
  /** Optional recorder for the kiosk_package DB row. */
  readonly recordPackage?: PackageRecorder;
  /** Minimum kiosk runtime version required. */
  readonly minRuntime: string;
  /** Languages advertised by the package. Defaults to {@link siteActiveLangs}. */
  readonly langsFor?: (site: SiteData) => readonly string[];
};

/** The distinct languages present in the site's directory, sorted; `['fr']` if none. */
export function siteActiveLangs(site: SiteData): readonly string[] {
  const langs = new Set<string>();
  for (const dn of site.destination_names) langs.add(dn.lang);
  const sorted = [...langs].sort();
  return sorted.length > 0 ? sorted : ['fr'];
}

/**
 * Adapt a live database into a per-job site loader.
 *
 * A6.1 — the site is read under the requester's identity, in a transaction
 * that sets it and drops it: the service sees exactly what the requester sees.
 */
export function dbLoadSite(
  db: PostgresJsDatabase,
): (orgId: string, siteId: string, requestedBy: string) => Promise<SiteData> {
  return (orgId, siteId, requestedBy) => loadSiteDataAs(db, requestedBy, orgId, siteId);
}

function requireString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`build_kiosk_package job payload missing "${key}"`);
  }
  return value;
}

function requireVersion(payload: Record<string, unknown>): number {
  const value = payload['version'];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error('build_kiosk_package job payload missing integer "version"');
  }
  return value;
}

export function createKioskPackageJobHandler(
  deps: KioskPackageJobDeps,
): (job: Job) => Promise<Record<string, unknown>> {
  const langsFor = deps.langsFor ?? siteActiveLangs;

  return async (job: Job): Promise<Record<string, unknown>> => {
    const siteId = requireString(job.payload, 'site_id');
    const version = requireVersion(job.payload);
    // A6.1 — no requester, no identity to read under: refused, never guessed.
    if (job.requested_by === null || job.requested_by === '') {
      throw new Error('build_kiosk_package job has no requester (requested_by)');
    }
    const site = await deps.loadSite(job.org_id, siteId, job.requested_by);

    const context: BuildKioskPackageContext = {
      site,
      resolveKioskFiles: () => buildKioskTreeFromStore(site, deps.bundleStore),
      version,
      langs: langsFor(site),
      minRuntime: deps.minRuntime,
      packageSink: deps.packageSink,
      storagePathFor: deps.storagePathFor,
      ...(deps.recordPackage ? { recordPackage: deps.recordPackage } : {}),
    };

    return createBuildKioskPackageHandler(context)(job);
  };
}
