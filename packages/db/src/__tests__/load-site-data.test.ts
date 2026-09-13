import { describe, it, expect } from 'vitest';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { loadSiteData, mapSupportRow, mapSupportTypologyRow } from '../load-site-data.js';
import { support, supportTypology } from '../schema/signage.js';
import { organization } from '../schema/org.js';
import { site, building, level } from '../schema/site.js';
import { node } from '../schema/graph.js';

type SupportRow = typeof support.$inferSelect;

/**
 * A drizzle stub that dispatches `db.select().from(table).where(...)` to the
 * rows registered for that table, so the full loadSiteData path (queries →
 * assemble → map) runs without a live Postgres. Tables with no entry return [].
 */
function stubDb(byTable: Map<object, unknown[]>): PostgresJsDatabase {
  const db = {
    select() {
      return {
        from(table: object) {
          const rows = byTable.get(table) ?? [];
          const result = { where: () => Promise.resolve(rows) };
          // Some queries await `.from(t)` with a `.where`; all go through where.
          return result;
        },
      };
    },
  };
  return db as unknown as PostgresJsDatabase;
}

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
    width_mm: null,
    height_mm: null,
    dimensions_source: null,
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

  it('maps instance dimensions and their source when present (A5.6)', () => {
    const s = mapSupportRow(row({
      width_mm: 800, height_mm: 560, dimensions_source: 'overridden',
    }));
    expect(s.width_mm).toBe(800);
    expect(s.height_mm).toBe(560);
    expect(s.dimensions_source).toBe('overridden');
  });

  it('omits instance dimensions when the columns are null', () => {
    const s = mapSupportRow(row({ width_mm: null, height_mm: null, dimensions_source: null }));
    expect(s.width_mm).toBeUndefined();
    expect(s.height_mm).toBeUndefined();
    expect(s.dimensions_source).toBeUndefined();
  });

  it('ignores an unexpected dimensions_source value', () => {
    expect(mapSupportRow(row({ dimensions_source: 'guessed' })).dimensions_source).toBeUndefined();
  });
});

describe('mapSupportTypologyRow (A5.6)', () => {
  const typRow = (overrides: Partial<typeof supportTypology.$inferSelect> = {}) => ({
    id: 'typ-1', org_id: 'org-1', key: 'directional', name: 'Directionnel',
    face_count: 1, template_key: 'ftpl-dir', ...overrides,
  } as typeof supportTypology.$inferSelect);

  it('maps a typology row, template_key included, with no default faces', () => {
    const t = mapSupportTypologyRow(typRow());
    expect(t).toStrictEqual({
      id: 'typ-1', org_id: 'org-1', key: 'directional', name: 'Directionnel',
      face_count: 1, template_key: 'ftpl-dir', faces: [],
    });
  });

  it('omits template_key when the column is null', () => {
    expect(mapSupportTypologyRow(typRow({ template_key: null })).template_key).toBeUndefined();
  });
});

describe('loadSiteData (full path, stubbed db)', () => {
  it('assembles a site and loads its supports from the support table', async () => {
    const byTable = new Map<object, unknown[]>([
      [organization, [{ id: 'org-1', name: 'Org', slug: 'org' }]],
      [site, [{
        id: 'site-1', org_id: 'org-1', name: 'Site', country_code: 'FR',
        rules_pack_id: 'rp-1',
      }]],
      [building, [{
        id: 'b-1', org_id: 'org-1', site_id: 'site-1', name: 'B', independent_access: true,
      }]],
      [level, [{
        id: 'l-1', org_id: 'org-1', building_id: 'b-1', name: 'RDC', ordinal: 0,
        elevation_m: '0',
      }]],
      [node, [{
        id: 'n-1', org_id: 'org-1', level_id: 'l-1', kind: 'decision',
        position: { x: 0, y: 0, z: 0 }, label: 'hall',
      }]],
      [support, [row({
        id: 'sup-1', site_id: 'site-1', node_id: 'n-1',
        registry: 'safety', context: 'exterior', reading_distance_m: '8',
        width_mm: 500, height_mm: 700, dimensions_source: 'overridden',
      })]],
      [supportTypology, [{
        id: 'typ-1', org_id: 'org-1', key: 'directional', name: 'Dir',
        face_count: 1, template_key: 'ftpl-dir',
      }]],
    ]);

    const result = await loadSiteData(stubDb(byTable), 'org-1', 'site-1');

    expect(result.site.id).toBe('site-1');
    expect(result.site.rules_pack_id).toBe('rp-1');
    expect(result.support_types).toHaveLength(1);
    expect(result.support_types[0]?.key).toBe('directional');
    expect(result.support_types[0]?.template_key).toBe('ftpl-dir');
    expect(result.supports).toHaveLength(1);
    const s = result.supports[0];
    expect(s?.id).toBe('sup-1');
    expect(s?.registry).toBe('safety');
    expect(s?.context).toBe('exterior');
    expect(s?.reading_distance_m).toBe(8);
    expect(s?.width_mm).toBe(500);
    expect(s?.dimensions_source).toBe('overridden');
  });

  it('returns an empty supports list when the site has no supports', async () => {
    const byTable = new Map<object, unknown[]>([
      [organization, [{ id: 'org-1', name: 'Org', slug: 'org' }]],
      [site, [{
        id: 'site-1', org_id: 'org-1', name: 'Site', country_code: 'FR', rules_pack_id: null,
      }]],
    ]);
    const result = await loadSiteData(stubDb(byTable), 'org-1', 'site-1');
    expect(result.supports).toEqual([]);
    expect(result.buildings).toEqual([]);
  });
});
