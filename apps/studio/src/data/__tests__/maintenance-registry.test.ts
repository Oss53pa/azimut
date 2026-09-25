import { describe, it, expect, vi, afterEach } from 'vitest';
import { EMPTY_MAINTENANCE_REGISTRY } from '@azimut/core-model';
import { createReferenceRepository, createPostgrestRepository, isRepositoryError } from '../index.js';

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
  support: [{ id: 'sup-1' }, { id: 'sup-2' }],
  installed_support: [
    { id: 'i2', support_id: 'sup-1', installed_at: '2026-05-01T00:00:00Z', photo_path: null, installer_notes: null },
    { id: 'i1', support_id: 'sup-1', installed_at: '2026-02-01T00:00:00Z', photo_path: 'p.jpg', installer_notes: 'posé' },
  ],
};

describe('A5.7 — parc posé, sites de référence', () => {
  const repository = createReferenceRepository();

  it('rend un registre vide : aucun site de référence n’a de parc posé', async () => {
    expect(await repository.loadMaintenanceRegistry('ref-multilevel')).toEqual(EMPTY_MAINTENANCE_REGISTRY);
  });

  it('refuse un site inconnu plutôt que de rendre un registre vide', async () => {
    const error: unknown = await repository.loadMaintenanceRegistry('inconnu').catch((e: unknown) => e);
    expect(isRepositoryError(error) && error.failure === 'not_found').toBe(true);
  });
});

describe('A5.7 — parc posé, API REST', () => {
  it('vérifie le site avant de lire les tables, et refuse un site absent', async () => {
    const calls = stubTables({});
    const error: unknown = await createPostgrestRepository(config).loadMaintenanceRegistry('site-1')
      .catch((e: unknown) => e);
    expect(calls[0]).toContain('/site?select=id&id=eq.site-1');
    expect(isRepositoryError(error) && error.failure === 'not_found').toBe(true);
  });

  it('lit les poses, les divergences et les ordres, dans un ordre stable', async () => {
    stubTables({
      ...BASE,
      divergence: [
        { id: 'd1', installed_support_id: 'i1', kind: 'damaged', detected_at: '2026-03-01T00:00:00Z', resolved_at: null, notes: null },
        { id: 'd2', installed_support_id: 'i2', kind: 'wrong_orientation', detected_at: '2026-06-01T00:00:00Z', resolved_at: '2026-06-02T00:00:00Z', notes: 'repris' },
      ],
      work_order: [
        { id: 'w1', scope: { supports: ['sup-1'] }, estimated_cost: 1250.5, currency: 'XOF', state: 'issued', created_at: '2026-03-02T00:00:00Z', closed_at: null },
        { id: 'w2', scope: null, estimated_cost: null, currency: 'EUR', state: 'draft', created_at: '2026-07-01T00:00:00Z', closed_at: null },
      ],
    });

    const registry = await createPostgrestRepository(config).loadMaintenanceRegistry('site-1');
    expect(registry.installed.map(i => i.id)).toEqual(['i1', 'i2']);
    expect(registry.divergences.map(d => d.id)).toEqual(['d2', 'd1']);
    expect(registry.work_orders.map(w => w.id)).toEqual(['w2', 'w1']);
    expect(registry.work_orders[1]?.estimated_cost).toBe('1250.5');
    expect(registry.work_orders[0]?.estimated_cost).toBeNull();
  });

  it('échoue sur une nature de divergence hors liste, au lieu d’écarter la ligne', async () => {
    stubTables({
      ...BASE,
      divergence: [{ id: 'd1', installed_support_id: 'i1', kind: 'inconnue', detected_at: '2026-03-01T00:00:00Z', resolved_at: null, notes: null }],
    });
    const error: unknown = await createPostgrestRepository(config).loadMaintenanceRegistry('site-1')
      .catch((e: unknown) => e);
    expect(isRepositoryError(error) && error.failure === 'request_failed').toBe(true);
  });

  it('échoue sur un état d’ordre de travaux hors liste', async () => {
    stubTables({
      ...BASE,
      work_order: [{ id: 'w1', scope: null, estimated_cost: null, currency: 'EUR', state: 'archived', created_at: '2026-03-02T00:00:00Z', closed_at: null }],
    });
    const error: unknown = await createPostgrestRepository(config).loadMaintenanceRegistry('site-1')
      .catch((e: unknown) => e);
    expect(isRepositoryError(error) && error.failure === 'request_failed').toBe(true);
  });
});
