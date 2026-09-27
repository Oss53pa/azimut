import { describe, it, expect, vi, afterEach } from 'vitest';
import { createReferenceRepository, createPostgrestRepository, isRepositoryError } from '../index.js';
import { REFERENCE_WORKSITE } from '../reference-worksite.js';

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

describe('H6 — chantier, sites de référence', () => {
  const repository = createReferenceRepository();

  it('sert le jeu de démonstration, que les écrans signalent', async () => {
    expect(await repository.loadWorksiteRegistry('ref-multilevel')).toBe(REFERENCE_WORKSITE);
  });

  it('refuse un site inconnu', async () => {
    const error: unknown = await repository.loadWorksiteRegistry('inconnu').catch((e: unknown) => e);
    expect(isRepositoryError(error) && error.failure === 'not_found').toBe(true);
  });
});

describe('H6 — chantier, API REST', () => {
  it('vérifie le site avant de lire les tables, et refuse un site absent', async () => {
    const calls = stubTables({});
    const error: unknown = await createPostgrestRepository(config).loadWorksiteRegistry('site-1')
      .catch((e: unknown) => e);
    expect(calls[0]).toContain('/site?select=id&id=eq.site-1');
    expect(isRepositoryError(error) && error.failure === 'not_found').toBe(true);
  });

  it('replie les liaisons sur leur lot et leur créneau, sans compte stocké', async () => {
    stubTables({
      site: [{ id: 'site-1' }],
      fabrication_lot: [
        { id: 'l2', code: 'B', manufacturer_name: 'F2', state: 'ordered' },
        { id: 'l1', code: 'A', manufacturer_name: 'F1', state: 'delivered' },
      ],
      lot_support: [{ lot_id: 'l1', support_id: 's2' }, { lot_id: 'l1', support_id: 's1' }],
      install_slot: [
        { id: 'k2', zone_label: 'Z2', planned_on: null, night_work: false },
        { id: 'k1', zone_label: 'Z1', planned_on: '2026-10-01', night_work: true },
      ],
      slot_support: [{ slot_id: 'k1', support_id: 's1' }],
      install_reserve: [{
        id: 'r1', support_id: 's1', lot_id: 'l1', observation_key: 'x', observed_by: 'o',
        observed_at: '2026-09-01T00:00:00Z', lifted_at: null, photo_path: null,
      }],
    });
    const registry = await createPostgrestRepository(config).loadWorksiteRegistry('site-1');
    expect(registry.lots.map(l => [l.code, l.support_ids])).toEqual([['A', ['s1', 's2']], ['B', []]]);
    expect(registry.slots.map(s => [s.id, s.support_ids.length])).toEqual([['k1', 1], ['k2', 0]]);
    expect(registry.reserves).toHaveLength(1);
  });

  it('échoue sur un état de lot hors liste, au lieu d’écarter la ligne', async () => {
    stubTables({
      site: [{ id: 'site-1' }],
      fabrication_lot: [{ id: 'l1', code: 'A', manufacturer_name: 'F', state: 'perdu' }],
    });
    const error: unknown = await createPostgrestRepository(config).loadWorksiteRegistry('site-1')
      .catch((e: unknown) => e);
    expect(isRepositoryError(error) && error.failure === 'request_failed').toBe(true);
  });
});
