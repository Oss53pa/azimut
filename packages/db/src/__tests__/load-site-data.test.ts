import { describe, it, expect } from 'vitest';
import { loadSiteData } from '../load-site-data.js';
import { stubDb } from './stub-db.js';
import {
  mapSupportRow, mapSupportTypologyRow,
  mapSupportFaceRow, mapContentBlockRow, mapSupportVersionRow,
} from '../mapping/index.js';
import {
  support, supportTypology, supportFace, supportContentBlock, supportVersion,
} from '../schema/signage.js';
import { organization } from '../schema/org.js';
import { site, building, level } from '../schema/site.js';
import { node } from '../schema/graph.js';

type SupportRow = typeof support.$inferSelect;

function row(overrides: Partial<SupportRow>): SupportRow {
  return {
    id: 'sup-1',
    org_id: 'org-1',
    site_id: 'site-1',
    code: null,
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

describe('mapSupportFaceRow (A5.6)', () => {
  const faceRow = (o: Partial<typeof supportFace.$inferSelect> = {}) => ({
    id: 'sf-1', org_id: 'org-1', support_id: 'sup-1', side: 'front',
    width_mm: null, height_mm: null,
    face_index: 0, template_key: 'ftpl-dir', langs: ['fr', 'en'],
    created_at: new Date(), updated_at: new Date(), ...o,
  } as typeof supportFace.$inferSelect);

  it('maps a face row with template_key and langs', () => {
    const f = mapSupportFaceRow(faceRow());
    expect(f).toStrictEqual({
      id: 'sf-1', org_id: 'org-1', support_id: 'sup-1', face_index: 0,
      template_key: 'ftpl-dir', langs: ['fr', 'en'],
    });
  });

  it('defaults face_index to 0 and omits optionals when null', () => {
    const f = mapSupportFaceRow(faceRow({ face_index: null, template_key: null, langs: null }));
    expect(f.face_index).toBe(0);
    expect(f.template_key).toBeUndefined();
    expect(f.langs).toBeUndefined();
  });

  it('keeps only string entries in langs', () => {
    const f = mapSupportFaceRow(faceRow({ langs: ['fr', 2, null] as unknown }));
    expect(f.langs).toEqual(['fr']);
  });
});

describe('mapContentBlockRow (A5.6)', () => {
  const blockRow = (o: Partial<typeof supportContentBlock.$inferSelect> = {}) => ({
    id: 'cb-1', org_id: 'org-1', face_id: 'sf-1', kind: 'resolved', ordinal: 2,
    config: {}, block_index: 5, binding: { ref: 'x' }, free_text: { fr: 'Libre' }, ...o,
  } as typeof supportContentBlock.$inferSelect);

  it('maps a block row with binding and free_text', () => {
    expect(mapContentBlockRow(blockRow())).toStrictEqual({
      id: 'cb-1', org_id: 'org-1', face_id: 'sf-1', block_index: 5, kind: 'resolved',
      binding: { ref: 'x' }, free_text: { fr: 'Libre' },
    });
  });

  it('falls back to ordinal when block_index is null and omits null json', () => {
    const b = mapContentBlockRow(blockRow({ block_index: null, binding: null, free_text: null }));
    expect(b.block_index).toBe(2);
    expect(b.binding).toBeUndefined();
    expect(b.free_text).toBeUndefined();
  });
});

describe('mapSupportVersionRow (A5.6)', () => {
  const verRow = (o: Partial<typeof supportVersion.$inferSelect> = {}) => ({
    id: 'sv-1', org_id: 'org-1', support_id: 'sup-1', version: 3, state: 'approved',
    artwork_path: 'a/b.pdf', content_hash: 'sha256:aa',
    created_at: new Date('2026-01-02T00:00:00Z'), created_by: 'u-1', ...o,
  } as typeof supportVersion.$inferSelect);

  it('maps a version row', () => {
    expect(mapSupportVersionRow(verRow())).toStrictEqual({
      id: 'sv-1', org_id: 'org-1', support_id: 'sup-1', version: 3, state: 'approved',
      artwork_path: 'a/b.pdf', content_hash: 'sha256:aa',
      created_at: '2026-01-02T00:00:00.000Z', created_by: 'u-1',
    });
  });

  it('falls back to draft for an unexpected state and omits null optionals', () => {
    const v = mapSupportVersionRow(verRow({
      state: 'weird', artwork_path: null, content_hash: null, created_by: null,
    }));
    expect(v.state).toBe('draft');
    expect(v.artwork_path).toBeUndefined();
    expect(v.created_by).toBeUndefined();
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
      [supportFace, [{
        id: 'sf-1', org_id: 'org-1', support_id: 'sup-1', side: 'front',
        width_mm: null, height_mm: null, face_index: 0, template_key: 'ftpl-dir',
        langs: ['fr'], created_at: new Date(), updated_at: new Date(),
      }]],
      [supportContentBlock, [{
        id: 'cb-1', org_id: 'org-1', face_id: 'sf-1', kind: 'resolved', ordinal: 0,
        config: {}, block_index: 0, binding: { ref: 'header' }, free_text: null,
      }]],
      [supportVersion, [{
        id: 'sv-1', org_id: 'org-1', support_id: 'sup-1', version: 1, state: 'draft',
        artwork_path: null, content_hash: null, created_at: new Date(), created_by: null,
      }]],
    ]);

    const result = await loadSiteData(stubDb(byTable), 'org-1', 'site-1');

    expect(result.site.id).toBe('site-1');
    expect(result.site.rules_pack_id).toBe('rp-1');
    expect(result.support_types).toHaveLength(1);
    expect(result.support_types[0]?.key).toBe('directional');
    expect(result.support_types[0]?.template_key).toBe('ftpl-dir');
    expect(result.support_faces).toHaveLength(1);
    expect(result.support_faces[0]?.template_key).toBe('ftpl-dir');
    expect(result.content_blocks).toHaveLength(1);
    expect(result.content_blocks[0]?.binding).toEqual({ ref: 'header' });
    expect(result.support_versions).toHaveLength(1);
    expect(result.support_versions[0]?.state).toBe('draft');
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
