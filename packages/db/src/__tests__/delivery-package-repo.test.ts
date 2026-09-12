import { describe, it, expect } from 'vitest';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { insertDeliveryPackage } from '../delivery-package-repo.js';

type Captured = { values?: Record<string, unknown> };

function stubDb(rows: Array<{ id: string }>, captured: Captured): PostgresJsDatabase {
  const chain = {
    values(obj: Record<string, unknown>) {
      captured.values = obj;
      return { returning: () => Promise.resolve(rows) };
    },
  };
  return { insert: () => chain } as unknown as PostgresJsDatabase;
}

const base = {
  org_id: 'org-1',
  site_id: 'site-1',
  site_code: 'CPL',
  building: 'A',
  level: 'R1',
  version: 3,
  archive_name: 'CPL_A_R1_V3.ZIP',
  storage_path: 'deliveries/CPL_A_R1_V3.ZIP',
  checksum: 'sha256:aa',
  file_count: 2,
  total_bytes: 4096,
  total_supports: 2,
  total_faces: 2,
  cross_check_ok: true,
};

describe('insertDeliveryPackage', () => {
  it('maps the input to columns and returns the id', async () => {
    const captured: Captured = {};
    const result = await insertDeliveryPackage(
      stubDb([{ id: 'dp-1' }], captured),
      { ...base, built_at: '2026-09-01T00:00:00Z' },
    );
    expect(result).toEqual({ id: 'dp-1' });
    expect(captured.values).toMatchObject({
      org_id: 'org-1', site_id: 'site-1', site_code: 'CPL',
      archive_name: 'CPL_A_R1_V3.ZIP', file_count: 2, total_bytes: 4096,
      total_supports: 2, total_faces: 2, cross_check_ok: true,
    });
    expect(captured.values?.['built_at']).toEqual(new Date('2026-09-01T00:00:00Z'));
  });

  it('omits built_at so the column default applies when absent', async () => {
    const captured: Captured = {};
    await insertDeliveryPackage(stubDb([{ id: 'dp-2' }], captured), base);
    expect(captured.values && 'built_at' in captured.values).toBe(false);
  });

  it('throws when no row is returned', async () => {
    await expect(
      insertDeliveryPackage(stubDb([], {}), base),
    ).rejects.toThrow('returned no row');
  });
});
