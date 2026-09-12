import type { PostgresJsDatabase } from '@azimut/db';
import { insertDeliveryPackage } from '@azimut/db';

/**
 * D11 — the delivery archive metadata recorded as a `delivery_package` row,
 * everything except the org (supplied from the job).
 */
export type DeliveryRecord = {
  readonly site_id: string;
  readonly site_code: string;
  readonly building: string;
  readonly level: string;
  readonly version: number;
  readonly archive_name: string;
  readonly storage_path: string;
  readonly checksum: string;
  readonly file_count: number;
  readonly total_bytes: number;
  readonly total_supports: number;
  readonly total_faces: number;
  readonly cross_check_ok: boolean;
  readonly built_at: string;
};

export type DeliveryRecorder = (
  record: DeliveryRecord,
  orgId: string,
) => Promise<void>;

/** Adapt a live database into a delivery recorder. */
export function dbDeliveryRecorder(db: PostgresJsDatabase): DeliveryRecorder {
  return async (record: DeliveryRecord, orgId: string): Promise<void> => {
    await insertDeliveryPackage(db, { org_id: orgId, ...record });
  };
}
