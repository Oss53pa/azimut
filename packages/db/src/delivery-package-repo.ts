import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { deliveryPackage } from './schema/deliveries.js';

/**
 * D11 — Insert input for a produced delivery archive, mirroring the
 * `delivery_package` table. `built_at` is an ISO-8601 string; omit it to let the
 * column default to now().
 */
export type DeliveryPackageInsert = {
  readonly org_id: string;
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
  readonly built_at?: string;
};

/**
 * Insert a `delivery_package` row and return its generated id. The caller owns
 * the transaction boundary; this performs a single insert.
 */
export async function insertDeliveryPackage(
  db: PostgresJsDatabase,
  input: DeliveryPackageInsert,
): Promise<{ id: string }> {
  const [row] = await db
    .insert(deliveryPackage)
    .values({
      org_id: input.org_id,
      site_id: input.site_id,
      site_code: input.site_code,
      building: input.building,
      level: input.level,
      version: input.version,
      archive_name: input.archive_name,
      storage_path: input.storage_path,
      checksum: input.checksum,
      file_count: input.file_count,
      total_bytes: input.total_bytes,
      total_supports: input.total_supports,
      total_faces: input.total_faces,
      cross_check_ok: input.cross_check_ok,
      ...(input.built_at !== undefined
        ? { built_at: new Date(input.built_at) }
        : {}),
    })
    .returning({ id: deliveryPackage.id });

  if (!row) {
    throw new Error('insert delivery_package returned no row');
  }
  return { id: row.id };
}
