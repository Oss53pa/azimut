import { describe, it, expect } from 'vitest';
import { mapSupportRow } from '../load-site-data.js';
import { support } from '../schema/signage.js';

type SupportRow = typeof support.$inferSelect;

function row(overrides: Partial<SupportRow>): SupportRow {
  return {
    id: 'sup-1',
    org_id: 'org-1',
    site_id: 'site-1',
    node_id: 'node-1',
    kind: 'directional',
    azimuth_deg: '90',
    height_m: null,
    width_m: null,
    reading_distance_m: '4.5',
    registry: 'wayfinding',
    context: 'interior',
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    deleted_at: null,
    ...overrides,
  } as SupportRow;
}

describe('mapSupportRow (A5.6)', () => {
  it('maps a complete row to the model', () => {
    const s = mapSupportRow(row({}));
    expect(s).toStrictEqual({
      id: 'sup-1', org_id: 'org-1', site_id: 'site-1', node_id: 'node-1',
      registry: 'wayfinding', context: 'interior',
      reading_distance_m: 4.5, azimuth_deg: 90,
    });
  });

  it('keeps the safety registry', () => {
    expect(mapSupportRow(row({ registry: 'safety' })).registry).toBe('safety');
  });

  it('keeps the exterior context', () => {
    expect(mapSupportRow(row({ context: 'exterior' })).context).toBe('exterior');
  });

  it('falls back to wayfinding when the registry column is null', () => {
    expect(mapSupportRow(row({ registry: null })).registry).toBe('wayfinding');
  });

  it('falls back to interior when the context column is null', () => {
    expect(mapSupportRow(row({ context: null })).context).toBe('interior');
  });

  it('falls back to a zero reading distance when the column is null', () => {
    expect(mapSupportRow(row({ reading_distance_m: null })).reading_distance_m).toBe(0);
  });

  it('does not read an unexpected registry value as safety', () => {
    // Any value other than the exact literals resolves to the permissive default.
    expect(mapSupportRow(row({ registry: 'other' })).registry).toBe('wayfinding');
    expect(mapSupportRow(row({ context: 'other' })).context).toBe('interior');
  });
});
