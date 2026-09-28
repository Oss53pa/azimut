import { describe, it, expect, vi, afterEach } from 'vitest';
import { createReferenceRepository, createPostgrestRepository, isRepositoryError } from '../index.js';

afterEach(() => { vi.unstubAllGlobals(); });

const config = { url: 'https://exemple.test/rest/v1', apiKey: 'clef', schema: 'azimut' };

/** Répond par table ; toute table non nommée rend une liste vide. */
function stubTables(bodies: Readonly<Record<string, unknown[]>>): void {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    const table = /\/rest\/v1\/([a-z_]+)\?/.exec(url)?.[1] ?? '';
    return Promise.resolve(new Response(JSON.stringify(bodies[table] ?? []), { status: 200 }));
  }));
}

const REGULATION = {
  id: 'r1', effective_from: '2026-01-01', max_height_mm: 900, max_overhang_mm: null,
  allowed_materials: ['laiton'], allowed_lighting: [], forbidden_features: ['neon_nu'],
};
const DOSSIER = {
  id: 'd1', destination_id: 'dest-1', state: 'instructing', submitted_on: '2026-09-11',
  height_mm: 1120, overhang_mm: 95, material: 'plexiglas', lighting: 'indirect', features: ['neon_nu'],
};

describe('H5 — enseignes, sites de référence', () => {
  it('rattache le jeu de démonstration aux destinations du site ouvert', async () => {
    const registry = await createReferenceRepository().loadTenantRegistry('ref-multilevel');
    expect(registry.dossiers.length).toBeGreaterThan(0);
    expect(registry.regulations).toHaveLength(1);
  });

  it('refuse un site inconnu', async () => {
    const error: unknown = await createReferenceRepository().loadTenantRegistry('inconnu').catch((e: unknown) => e);
    expect(isRepositoryError(error) && error.failure === 'not_found').toBe(true);
  });
});

describe('H5 — enseignes, API REST', () => {
  it('lit versions, dossiers et pièces, pièces triées sous leur dossier', async () => {
    stubTables({
      site: [{ id: 'site-1' }],
      tenant_sign_regulation: [REGULATION],
      tenant_sign_dossier: [DOSSIER],
      tenant_sign_part: [
        { dossier_id: 'd1', key: 'section', provided: false, storage_path: null },
        { dossier_id: 'd1', key: 'elevation', provided: true, storage_path: 'p.pdf' },
      ],
    });
    const registry = await createPostgrestRepository(config).loadTenantRegistry('site-1');
    expect(registry.regulations[0]?.forbidden_features).toEqual(['neon_nu']);
    expect(registry.dossiers[0]?.parts.map(p => p.key)).toEqual(['elevation', 'section']);
  });

  it('échoue sur une liste JSON qui n’est pas une liste de chaînes', async () => {
    stubTables({
      site: [{ id: 'site-1' }],
      tenant_sign_regulation: [{ ...REGULATION, allowed_materials: { laiton: true } }],
    });
    const error: unknown = await createPostgrestRepository(config).loadTenantRegistry('site-1').catch((e: unknown) => e);
    expect(isRepositoryError(error) && error.failure === 'request_failed').toBe(true);
  });

  it('échoue sur un état de dossier hors liste', async () => {
    stubTables({ site: [{ id: 'site-1' }], tenant_sign_dossier: [{ ...DOSSIER, state: 'archived' }] });
    const error: unknown = await createPostgrestRepository(config).loadTenantRegistry('site-1').catch((e: unknown) => e);
    expect(isRepositoryError(error) && error.failure === 'request_failed').toBe(true);
  });
});
