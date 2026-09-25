import { describe, it, expect, vi, afterEach } from 'vitest';
import { EMPTY_WAYFINDING_REGISTRY } from '@azimut/core-model';
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

describe('N2.2 — registre du wayfinding, sites de référence', () => {
  const repository = createReferenceRepository();

  it('rend un registre vide : aucun site de référence n’en déclare', async () => {
    expect(await repository.loadWayfindingRegistry('ref-multilevel')).toEqual(EMPTY_WAYFINDING_REGISTRY);
  });

  it('refuse un site inconnu plutôt que de rendre un registre vide', async () => {
    const error: unknown = await repository.loadWayfindingRegistry('inconnu').catch((e: unknown) => e);
    expect(isRepositoryError(error) && error.failure === 'not_found').toBe(true);
  });
});

describe('N2.2 — registre du wayfinding, API REST', () => {
  it('vérifie le site avant de lire les tables, et refuse un site absent', async () => {
    const calls = stubTables({});
    const error: unknown = await createPostgrestRepository(config).loadWayfindingRegistry('site-1')
      .catch((e: unknown) => e);
    expect(calls[0]).toContain('/site?select=id,org_id&id=eq.site-1');
    expect(isRepositoryError(error) && error.failure === 'not_found').toBe(true);
  });

  it('lit zones, règles et niveaux, et rattache chaque niveau à la clé de sa typologie', async () => {
    const calls = stubTables({
      site: [{ id: 'site-1', org_id: 'org-1' }],
      orientation_zone: [{
        id: 'z1', code: 'Z-G', name_fr: 'Galerie', name_en: 'Mall', kind: 'mall', footprint_ids: ['fp-1'],
      }],
      naming_rule: [{ id: 'r1', target: 'level', pattern: 'R{n}', max_length: 4, uniqueness_scope: 'building' }],
      support_typology: [{ id: 't1', key: 'totem' }, { id: 't2', key: 'drapeau' }],
      information_level: [{ typology_id: 't1', level: 2 }, { typology_id: 't2', level: 3 }, { typology_id: 't1', level: 1 }],
    });

    const registry = await createPostgrestRepository(config).loadWayfindingRegistry('site-1');
    expect(registry.zones).toEqual([
      { id: 'z1', code: 'Z-G', name_fr: 'Galerie', name_en: 'Mall', kind: 'mall', footprint_ids: ['fp-1'] },
    ]);
    expect(registry.naming_rules[0]?.uniqueness_scope).toBe('building');
    expect(registry.information_levels).toEqual([
      { typology_key: 'drapeau', level: 3 },
      { typology_key: 'totem', level: 1 },
      { typology_key: 'totem', level: 2 },
    ]);
    // Typologies de l'organisation du site, niveaux par identifiant de typologie.
    expect(calls.some(u => u.includes('/support_typology?select=id,key&org_id=eq.org-1'))).toBe(true);
    expect(calls.some(u => u.includes('/information_level?typology_id=in.(t1,t2)'))).toBe(true);
  });

  it('échoue sur une valeur hors énuméré au lieu d’écarter la ligne en silence', async () => {
    stubTables({
      site: [{ id: 'site-1', org_id: 'org-1' }],
      orientation_zone: [{ id: 'z1', code: 'Z', name_fr: 'a', name_en: 'b', kind: 'atrium', footprint_ids: [] }],
    });
    const error: unknown = await createPostgrestRepository(config).loadWayfindingRegistry('site-1')
      .catch((e: unknown) => e);
    expect(isRepositoryError(error) && error.failure === 'request_failed').toBe(true);
  });

  it('ne requête pas les niveaux quand l’organisation n’a aucune typologie', async () => {
    const calls = stubTables({ site: [{ id: 'site-1', org_id: 'org-1' }] });
    const registry = await createPostgrestRepository(config).loadWayfindingRegistry('site-1');
    expect(registry.information_levels).toHaveLength(0);
    expect(calls.some(u => u.includes('/information_level?'))).toBe(false);
  });
});
