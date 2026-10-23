import { describe, it, expect, vi, afterEach } from 'vitest';
import { createReferenceRepository, createPostgrestRepository, isRepositoryError } from '../index.js';
import { REFERENCE_BUDGET } from '../reference-budget.js';

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

const SITE = { site: [{ id: 'aaaa0003-0000-4000-8000-000000000001', org_id: 'aaaa0003-0000-4000-8000-000000000002' }] };

describe('H8 : budget, sites de référence', () => {
  it('sert le jeu de démonstration, que les écrans signalent', async () => {
    expect(await createReferenceRepository().loadBudgetRegistry('ref-multilevel')).toBe(REFERENCE_BUDGET);
  });
});

describe('H8: budget, API REST', () => {
  it('lit les coûts par organisation et les lignes par site', async () => {
    const calls = stubTables({
      ...SITE,
      cost_reference: [{ id: 'aaaa0003-0000-4000-8000-000000000004', typology_key: 't', substrate_key: 's', manufacturer_name: null, unit_cost_minor: 124000, currency: 'XOF', since: null }],
      budget_line: [{ id: 'aaaa0003-0000-4000-8000-000000000003', phase_key: 'p', lot_id: null, estimated_minor: '500', quoted_minor: null, actual_minor: null, currency: 'EUR' }],
    });
    const registry = await createPostgrestRepository(config).loadBudgetRegistry('aaaa0003-0000-4000-8000-000000000001');
    expect(calls.some(c => c.includes('/cost_reference?') && c.includes('org_id=eq.aaaa0003-0000-4000-8000-000000000002'))).toBe(true);
    expect(calls.some(c => c.includes('/budget_line?') && c.includes('site_id=eq.aaaa0003-0000-4000-8000-000000000001'))).toBe(true);
    expect(registry.cost_references[0]?.unit_cost).toEqual({ minor: 124000, currency: 'XOF' });
    expect(registry.budget_lines[0]?.estimated).toEqual({ minor: 500, currency: 'EUR' });
    expect(registry.budget_lines[0]?.quoted).toBeNull();
  });

  it('refuse un montant que JavaScript ne représente pas exactement', async () => {
    stubTables({
      ...SITE,
      budget_line: [{ id: 'aaaa0003-0000-4000-8000-000000000003', phase_key: 'p', lot_id: null, estimated_minor: '9007199254740993', quoted_minor: null, actual_minor: null, currency: 'EUR' }],
    });
    const error: unknown = await createPostgrestRepository(config).loadBudgetRegistry('aaaa0003-0000-4000-8000-000000000001').catch((e: unknown) => e);
    expect(isRepositoryError(error) && error.failure === 'request_failed').toBe(true);
  });

  it('refuse un site absent', async () => {
    stubTables({});
    const error: unknown = await createPostgrestRepository(config).loadBudgetRegistry('aaaa0003-0000-4000-8000-000000000001').catch((e: unknown) => e);
    expect(isRepositoryError(error) && error.failure === 'not_found').toBe(true);
  });
});
