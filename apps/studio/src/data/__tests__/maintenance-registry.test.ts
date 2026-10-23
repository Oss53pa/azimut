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
  site: [{ id: 'aaaa0006-0000-4000-8000-000000000001' }],
  support: [{ id: 'aaaa0006-0000-4000-8000-000000000009' }, { id: 'aaaa0006-0000-4000-8000-000000000010' }],
  building: [{ id: 'aaaa0006-0000-4000-8000-000000000002' }],
  level: [{ id: 'aaaa0006-0000-4000-8000-000000000007' }],
  node: [{ id: 'aaaa0006-0000-4000-8000-000000000008' }],
  installed_support: [
    { id: 'aaaa0006-0000-4000-8000-000000000006', support_id: 'aaaa0006-0000-4000-8000-000000000009', installed_at: '2026-05-01T00:00:00Z', photo_path: null, installer_notes: null, installed_version: 2, condition: 'worn', surveyed_by: null, surveyed_at: '2026-06-01T00:00:00Z' },
    { id: 'aaaa0006-0000-4000-8000-000000000005', support_id: 'aaaa0006-0000-4000-8000-000000000009', installed_at: '2026-02-01T00:00:00Z', photo_path: 'p.jpg', installer_notes: 'posé', installed_version: null, condition: null, surveyed_by: null, surveyed_at: null },
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
    const error: unknown = await createPostgrestRepository(config).loadMaintenanceRegistry('aaaa0006-0000-4000-8000-000000000001')
      .catch((e: unknown) => e);
    expect(calls[0]).toContain('/site?select=id&id=eq.aaaa0006-0000-4000-8000-000000000001');
    expect(isRepositoryError(error) && error.failure === 'not_found').toBe(true);
  });

  it('lit les poses, les divergences et les ordres, dans un ordre stable', async () => {
    stubTables({
      ...BASE,
      divergence: [
        { id: 'aaaa0006-0000-4000-8000-000000000003', support_id: 'aaaa0006-0000-4000-8000-000000000009', node_id: null, installed_support_id: 'aaaa0006-0000-4000-8000-000000000005', kind: 'damaged', detected_at: '2026-03-01T00:00:00Z', resolved_at: null, detail: { notes: 'Rayure' } },
        { id: 'aaaa0006-0000-4000-8000-000000000004', support_id: null, node_id: 'aaaa0006-0000-4000-8000-000000000008', installed_support_id: null, kind: 'missing', detected_at: '2026-06-01T00:00:00Z', resolved_at: null, detail: null },
      ],
      work_order: [
        { id: 'aaaa0006-0000-4000-8000-000000000011', scope: { supports: ['aaaa0006-0000-4000-8000-000000000009'] }, estimated_cost_minor: 125050, currency: 'EUR', state: 'issued', created_at: '2026-03-02T00:00:00Z', closed_at: null },
        { id: 'aaaa0006-0000-4000-8000-000000000012', scope: null, estimated_cost_minor: null, currency: 'EUR', state: 'draft', created_at: '2026-07-01T00:00:00Z', closed_at: null },
      ],
    });

    const registry = await createPostgrestRepository(config).loadMaintenanceRegistry('aaaa0006-0000-4000-8000-000000000001');
    expect(registry.installed.map(i => i.id)).toEqual(['aaaa0006-0000-4000-8000-000000000005', 'aaaa0006-0000-4000-8000-000000000006']);
    expect(registry.installed[1]?.condition).toBe('worn');
    // Le stub rend la table entière aux deux lectures, par support et par
    // nœud : chaque divergence n'est gardée qu'une fois.
    expect(registry.divergences.map(d => d.id)).toEqual(['aaaa0006-0000-4000-8000-000000000004', 'aaaa0006-0000-4000-8000-000000000003']);
    expect(registry.divergences[0]?.node_id).toBe('aaaa0006-0000-4000-8000-000000000008');
    expect(registry.divergences[1]?.detail).toEqual({ notes: 'Rayure' });
    expect(registry.work_orders.map(w => w.id)).toEqual(['aaaa0006-0000-4000-8000-000000000012', 'aaaa0006-0000-4000-8000-000000000011']);
    expect(registry.work_orders[1]?.estimated_cost).toEqual({ minor: 125050, currency: 'EUR' });
    expect(registry.work_orders[0]?.estimated_cost).toBeNull();
  });

  it('échoue sur une nature de divergence hors liste, au lieu d’écarter la ligne', async () => {
    stubTables({
      ...BASE,
      divergence: [{ id: 'aaaa0006-0000-4000-8000-000000000003', support_id: 'aaaa0006-0000-4000-8000-000000000009', node_id: null, installed_support_id: null, kind: 'inconnue', detected_at: '2026-03-01T00:00:00Z', resolved_at: null, detail: null }],
    });
    const error: unknown = await createPostgrestRepository(config).loadMaintenanceRegistry('aaaa0006-0000-4000-8000-000000000001')
      .catch((e: unknown) => e);
    expect(isRepositoryError(error) && error.failure === 'request_failed').toBe(true);
  });

  it('échoue sur un détail de divergence qui n’est pas un objet', async () => {
    stubTables({
      ...BASE,
      divergence: [{ id: 'aaaa0006-0000-4000-8000-000000000003', support_id: 'aaaa0006-0000-4000-8000-000000000009', node_id: null, installed_support_id: null, kind: 'damaged', detected_at: '2026-03-01T00:00:00Z', resolved_at: null, detail: 'texte' }],
    });
    const error: unknown = await createPostgrestRepository(config).loadMaintenanceRegistry('aaaa0006-0000-4000-8000-000000000001')
      .catch((e: unknown) => e);
    expect(isRepositoryError(error) && error.failure === 'request_failed').toBe(true);
  });

  it('échoue sur un état d’ordre de travaux hors liste', async () => {
    stubTables({
      ...BASE,
      work_order: [{ id: 'aaaa0006-0000-4000-8000-000000000011', scope: null, estimated_cost_minor: null, currency: 'EUR', state: 'archived', created_at: '2026-03-02T00:00:00Z', closed_at: null }],
    });
    const error: unknown = await createPostgrestRepository(config).loadMaintenanceRegistry('aaaa0006-0000-4000-8000-000000000001')
      .catch((e: unknown) => e);
    expect(isRepositoryError(error) && error.failure === 'request_failed').toBe(true);
  });
});
