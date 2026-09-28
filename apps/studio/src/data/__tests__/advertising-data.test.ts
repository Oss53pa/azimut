import { describe, it, expect, vi, afterEach } from 'vitest';
import { createReferenceRepository, createPostgrestRepository, isRepositoryError } from '../index.js';
import { REFERENCE_ADVERTISING } from '../reference-advertising.js';

afterEach(() => { vi.unstubAllGlobals(); });

const config = { url: 'https://exemple.test/rest/v1', apiKey: 'clef', schema: 'azimut' };

/** Répond par table ; toute table non nommée rend une liste vide. */
function stubTables(bodies: Readonly<Record<string, unknown[]>>): string[] {
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    calls.push(url);
    const table = /\/rest\/v1\/([a-z_]+)\?/.exec(url)?.[1] ?? '';
    return Promise.resolve(new Response(JSON.stringify(bodies[table] ?? []), { status: 200 }));
  }));
  return calls;
}

const BASE = {
  site: [{ id: 'site-1' }],
  ad_placement: [{ id: 'p1', code: 'AP-1', level_id: 'l1', node_id: null, typology_key: 'caisson', area_m2: '2.5' }],
};

describe('H4 — régie, sites de référence', () => {
  it('sert le jeu de démonstration, file de réception et fiche technique comprises', async () => {
    const data = await createReferenceRepository().loadAdvertisingData('ref-multilevel');
    expect(data).toBe(REFERENCE_ADVERTISING);
    expect(data.reception.length).toBeGreaterThan(0);
    expect(data.creative_spec).not.toBeNull();
  });
});

describe('H4 — régie, API REST', () => {
  it('lit les emplacements actifs et ce qui en pend, sans file de réception ni fiche inventées', async () => {
    const calls = stubTables({
      ...BASE,
      ad_booking: [
        { id: 'b1', placement_id: 'p1', state: 'reserved', from_date: '2026-10-01', to_date: '2026-11-30', advertiser_name: 'A' },
        { id: 'b2', placement_id: 'p1', state: 'reserved', from_date: '2026-11-01', to_date: '2027-01-31', advertiser_name: 'B' },
      ],
      ad_creative: [{
        id: 'c1', placement_id: 'p1', format: 'pdf', resolution_dpi: 300, safe_zone_mm: 10, color_profile: 'CMYK',
        weight_bytes: '1000', storage_path: null, sanitation: 'deferred', verdict: 'human_review', received_at: '2026-09-01T00:00:00Z',
      }],
    });
    const data = await createPostgrestRepository(config).loadAdvertisingData('site-1');
    expect(calls.some(c => c.includes('/ad_placement?') && c.includes('deleted_at=is.null'))).toBe(true);
    expect(data.registry.placements[0]?.area_m2).toBe(2.5);
    // Le chevauchement s'est enregistré : c'est le garde qui le relèvera.
    expect(data.registry.bookings).toHaveLength(2);
    expect(data.registry.creatives[0]?.weight_bytes).toBe(1000);
    expect(data.reception).toEqual([]);
    expect(data.creative_spec).toBeNull();
  });

  it('échoue sur un état de réservation hors liste, au lieu d’écarter la ligne', async () => {
    stubTables({
      ...BASE,
      ad_booking: [{ id: 'b1', placement_id: 'p1', state: 'free', from_date: '2026-10-01', to_date: '2026-11-30', advertiser_name: null }],
    });
    const error: unknown = await createPostgrestRepository(config).loadAdvertisingData('site-1').catch((e: unknown) => e);
    expect(isRepositoryError(error) && error.failure === 'request_failed').toBe(true);
  });

  it('refuse un site absent', async () => {
    stubTables({});
    const error: unknown = await createPostgrestRepository(config).loadAdvertisingData('site-1').catch((e: unknown) => e);
    expect(isRepositoryError(error) && error.failure === 'not_found').toBe(true);
  });
});
