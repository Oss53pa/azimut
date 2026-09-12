import { insertKioskPackage } from '@azimut/db';
import type { PostgresJsDatabase } from '@azimut/db';
import type { KioskPackageRecord } from './persist-kiosk-package.js';

/**
 * D10 — Adapter that records a persisted kiosk package as a `kiosk_package`
 * row. Bridges the storage-side {@link KioskPackageRecord} (produced by
 * persistKioskPackage) to the DB insert in @azimut/db, supplying the org from
 * the job. Injected into the build_kiosk_package handler as its `recordPackage`
 * port, so the compiler stays free of any live database handle at its core.
 */
export type PackageRecorder = (
  record: KioskPackageRecord,
  orgId: string,
) => Promise<void>;

export function dbKioskPackageRecorder(db: PostgresJsDatabase): PackageRecorder {
  return async (record: KioskPackageRecord, orgId: string): Promise<void> => {
    await insertKioskPackage(db, {
      org_id: orgId,
      site_id: record.site_id,
      version: record.version,
      storage_path: record.storage_path,
      checksum: record.checksum,
      content_hash: record.content_hash,
      built_at: record.built_at,
    });
  };
}
