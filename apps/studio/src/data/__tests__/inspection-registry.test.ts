import { describe, it, expect, vi, afterEach } from 'vitest';
import { createReferenceRepository, createPostgrestRepository, isRepositoryError } from '../index.js';
import { REFERENCE_INSPECTION } from '../reference-inspection.js';
import { findingCounts, syncFindings } from '../../views/operations/rounds.js';

afterEach(() => { vi.unstubAllGlobals(); });

const config = { url: 'https://exemple.test/rest/v1', apiKey: 'clef', schema: 'azimut' };

/** Répond par table ; toute table non nommée rend une liste vide. */
function stubTables(bodies: Readonly<Record<string, unknown[]>>): void {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    const table = /\/rest\/v1\/([a-z_]+)\?/.exec(url)?.[1] ?? '';
    return Promise.resolve(new Response(JSON.stringify(bodies[table] ?? []), { status: 200 }));
  }));
}

describe('I5.6 : tournées, sites de référence', () => {
  it('sert le jeu de démonstration, que les écrans signalent', async () => {
    expect(await createReferenceRepository().loadInspectionRegistry('ref-multilevel')).toBe(REFERENCE_INSPECTION);
  });

  it('compte les constats par tournée au lieu de les stocker', () => {
    const counts = findingCounts(REFERENCE_INSPECTION.findings);
    expect([counts.get('ir-0142'), counts.get('ir-0143'), counts.get('ir-0144')]).toEqual([2, 1, 1]);
    expect(syncFindings(REFERENCE_INSPECTION.rounds).map(f => f.entity?.id)).toEqual(['ir-0143', 'ir-0144']);
  });
});

describe('I5.6 : tournées, API REST', () => {
  it('lit tournées et constats du site', async () => {
    stubTables({
      site: [{ id: 'aaaa0005-0000-4000-8000-000000000001' }],
      inspection_round: [{ id: 'aaaa0005-0000-4000-8000-000000000003', zone_label: 'Z', surveyor_id: null, surveyed_on: null, sync_state: 'pending' }],
      inspection_finding: [{ id: 'aaaa0005-0000-4000-8000-000000000002', round_id: 'aaaa0005-0000-4000-8000-000000000003', support_id: 'aaaa0005-0000-4000-8000-000000000004', nature_key: 'k', severity: 'warning', photo_path: null }],
    });
    const registry = await createPostgrestRepository(config).loadInspectionRegistry('aaaa0005-0000-4000-8000-000000000001');
    expect(registry.rounds.map(r => r.id)).toEqual(['aaaa0005-0000-4000-8000-000000000003']);
    expect(registry.findings.map(f => f.severity)).toEqual(['warning']);
  });

  it('échoue sur une sévérité hors liste, au lieu d’écarter le constat', async () => {
    stubTables({
      site: [{ id: 'aaaa0005-0000-4000-8000-000000000001' }],
      inspection_round: [{ id: 'aaaa0005-0000-4000-8000-000000000003', zone_label: 'Z', surveyor_id: null, surveyed_on: null, sync_state: 'pending' }],
      inspection_finding: [{ id: 'aaaa0005-0000-4000-8000-000000000002', round_id: 'aaaa0005-0000-4000-8000-000000000003', support_id: 'aaaa0005-0000-4000-8000-000000000004', nature_key: 'k', severity: 'info', photo_path: null }],
    });
    const error: unknown = await createPostgrestRepository(config).loadInspectionRegistry('aaaa0005-0000-4000-8000-000000000001').catch((e: unknown) => e);
    expect(isRepositoryError(error) && error.failure === 'request_failed').toBe(true);
  });

  it('refuse un site absent', async () => {
    stubTables({});
    const error: unknown = await createPostgrestRepository(config).loadInspectionRegistry('aaaa0005-0000-4000-8000-000000000001').catch((e: unknown) => e);
    expect(isRepositoryError(error) && error.failure === 'not_found').toBe(true);
  });
});
