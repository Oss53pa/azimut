import { describe, it, expect } from 'vitest';
import type { PostgresJsDatabase } from '@azimut/db';
import { dbKioskPackageRecorder } from '../db-package-recorder.js';
import type { KioskPackageRecord } from '../persist-kiosk-package.js';

type Captured = { values?: Record<string, unknown>; identityStatements?: number; inTransaction?: boolean };

/** A database whose transaction runs the callback on a recording stand-in. */
function stubDb(captured: Captured): PostgresJsDatabase {
  const chain = {
    values(obj: Record<string, unknown>) {
      captured.values = obj;
      return { returning: () => Promise.resolve([{ id: 'pkg-1' }]) };
    },
  };
  const tx = {
    execute: () => {
      captured.identityStatements = (captured.identityStatements ?? 0) + 1;
      return Promise.resolve([]);
    },
    insert: () => {
      captured.inTransaction = true;
      return chain;
    },
  };
  return {
    transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  } as unknown as PostgresJsDatabase;
}

const record: KioskPackageRecord = {
  site_id: 'site-1',
  version: 9,
  storage_path: 'sites/site-1/v9',
  checksum: 'sha256:aa',
  content_hash: 'sha256:bb',
  built_at: '2026-09-01T00:00:00Z',
};

describe('dbKioskPackageRecorder', () => {
  it('inserts a row combining the record with the supplied org', async () => {
    const captured: Captured = {};
    const recorder = dbKioskPackageRecorder(stubDb(captured));

    await recorder(record, 'org-42', 'user-42');

    // A6.1 — role and identity set inside the transaction, then the insert.
    expect(captured.identityStatements).toBe(2);
    expect(captured.inTransaction).toBe(true);

    expect(captured.values).toMatchObject({
      org_id: 'org-42',
      site_id: 'site-1',
      version: 9,
      storage_path: 'sites/site-1/v9',
      checksum: 'sha256:aa',
      content_hash: 'sha256:bb',
    });
    expect(captured.values?.['built_at']).toEqual(new Date('2026-09-01T00:00:00Z'));
  });
});
