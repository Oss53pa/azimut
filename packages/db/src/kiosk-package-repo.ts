import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { kioskPackage } from './schema/kiosks.js';
import { setSessionIdentity } from './write-path.js';

type PackageWriter<TSchema extends Record<string, unknown>> = Pick<PostgresJsDatabase<TSchema>, 'insert'>;

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
export async function insertKioskPackage<TSchema extends Record<string, unknown> = Record<string, never>>(
  db: PackageWriter<TSchema>,
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

/**
 * A6.1 — enregistre le paquet sous l'identité du demandeur du travail.
 *
 * Sous `FORCE ROW LEVEL SECURITY`, une insertion sans identité est refusée :
 * le service de compilation écrit ce que son demandeur aurait pu écrire, dans
 * une transaction qui pose l'identité et la retire.
 */
export async function insertKioskPackageAs<TSchema extends Record<string, unknown> = Record<string, never>>(
  db: PostgresJsDatabase<TSchema>,
  userId: string,
  input: KioskPackageInsert,
): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    await setSessionIdentity(tx, { userId });
    return insertKioskPackage(tx, input);
  });
}
