import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { kioskPackage } from './schema/kiosks.js';

/**
 * D10 — Insert input for a built kiosk package, mirroring the `kiosk_package`
 * table. `built_at` is an ISO-8601 string (the manifest's builtAt); omit it to
 * let the column default to now(). `content_hash` is the deterministic package
 * identity; `checksum` is the byte integrity of the stored artifact.
 */
export type KioskPackageInsert = {
  readonly org_id: string;
  readonly site_id: string;
  readonly version: number;
  readonly storage_path: string;
  readonly checksum: string;
  readonly content_hash: string;
  readonly built_at?: string;
};

/**
 * Insert a `kiosk_package` row and return its generated id. The caller owns the
 * transaction boundary; this performs a single insert.
 */
export async function insertKioskPackage(
  db: PostgresJsDatabase,
  input: KioskPackageInsert,
): Promise<{ id: string }> {
  const [row] = await db
    .insert(kioskPackage)
    .values({
      org_id: input.org_id,
      site_id: input.site_id,
      version: input.version,
      storage_path: input.storage_path,
      checksum: input.checksum,
      content_hash: input.content_hash,
      ...(input.built_at !== undefined
        ? { built_at: new Date(input.built_at) }
        : {}),
    })
    .returning({ id: kioskPackage.id });

  if (!row) {
    throw new Error('insert kiosk_package returned no row');
  }
  return { id: row.id };
}
