import { describe, it, expect } from 'vitest';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { insertKioskPackage } from '../kiosk-package-repo.js';

type Captured = { values?: Record<string, unknown> };

/**
 * Minimal stub of the drizzle insert chain used by insertKioskPackage:
 * db.insert(table).values(obj).returning(cols) → Promise<rows>. Lets us verify
 * the column mapping without a live Postgres.
 */
function stubDb(rows: Array<{ id: string }>, captured: Captured): PostgresJsDatabase {
  const chain = {
    values(obj: Record<string, unknown>) {
      captured.values = obj;
      return {
        returning() {
          return Promise.resolve(rows);
        },
      };
    },
  };
  const db = { insert: () => chain };
  return db as unknown as PostgresJsDatabase;
}

describe('insertKioskPackage', () => {
  it('maps the input to columns and returns the generated id', async () => {
    const captured: Captured = {};
    const db = stubDb([{ id: 'pkg-1' }], captured);

    const result = await insertKioskPackage(db, {
      org_id: 'org-1',
      site_id: 'site-1',
      version: 4,
      storage_path: 'sites/site-1/v4',
      checksum: 'sha256:aa',
      content_hash: 'sha256:bb',
      built_at: '2026-09-01T00:00:00Z',
    });

    expect(result).toEqual({ id: 'pkg-1' });
    expect(captured.values).toMatchObject({
      org_id: 'org-1',
      site_id: 'site-1',
      version: 4,
      storage_path: 'sites/site-1/v4',
      checksum: 'sha256:aa',
      content_hash: 'sha256:bb',
    });
    expect(captured.values?.['built_at']).toEqual(new Date('2026-09-01T00:00:00Z'));
  });

  it('omits built_at so the column default applies when absent', async () => {
    const captured: Captured = {};
    const db = stubDb([{ id: 'pkg-2' }], captured);

    await insertKioskPackage(db, {
      org_id: 'org-1',
      site_id: 'site-1',
      version: 1,
      storage_path: 'p',
      checksum: 'sha256:aa',
      content_hash: 'sha256:bb',
    });

    expect(captured.values && 'built_at' in captured.values).toBe(false);
  });

  it('throws when no row is returned', async () => {
    const db = stubDb([], {});
    await expect(
      insertKioskPackage(db, {
        org_id: 'o', site_id: 's', version: 1,
        storage_path: 'p', checksum: 'c', content_hash: 'h',
      }),
    ).rejects.toThrow('returned no row');
  });
});
