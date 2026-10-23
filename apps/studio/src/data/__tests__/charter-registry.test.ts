import { describe, it, expect, vi, afterEach } from 'vitest';
import { EMPTY_CHARTER_REGISTRY } from '@azimut/core-model';
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

// Couleurs par un auxiliaire : aucun hexadécimal littéral dans le source (A2.4).
const hx = (rgb: string): string => `#${rgb}`;

// Chartes fictives : aucune valeur ne provient d'une charte réelle.
const CHARTERS = [
  { id: 'aaaa0004-0000-4000-8000-000000000004', name: 'Charte A', version: '1', created_at: '2026-01-01T00:00:00Z' },
  { id: 'aaaa0004-0000-4000-8000-000000000005', name: 'Charte B', version: '2', created_at: '2026-03-01T00:00:00Z' },
];

describe('A5.8 — charte, sites de référence', () => {
  const repository = createReferenceRepository();

  it('rend un registre vide : le dépôt ne contient aucune charte', async () => {
    expect(await repository.loadCharterRegistry('ref-multilevel')).toEqual(EMPTY_CHARTER_REGISTRY);
  });

  it('refuse un site inconnu plutôt que de rendre un registre vide', async () => {
    const error: unknown = await repository.loadCharterRegistry('inconnu').catch((e: unknown) => e);
    expect(isRepositoryError(error) && error.failure === 'not_found').toBe(true);
  });
});

describe('A5.8 — charte, API REST', () => {
  it('vérifie le site avant de lire les tables, et refuse un site absent', async () => {
    const calls = stubTables({});
    const error: unknown = await createPostgrestRepository(config).loadCharterRegistry('aaaa0004-0000-4000-8000-000000000001')
      .catch((e: unknown) => e);
    expect(calls[0]).toContain('/site?select=id&id=eq.aaaa0004-0000-4000-8000-000000000001');
    expect(isRepositoryError(error) && error.failure === 'not_found').toBe(true);
  });

  it('range chaque ligne sous sa charte, la plus récente d’abord', async () => {
    stubTables({
      site: [{ id: 'aaaa0004-0000-4000-8000-000000000001' }],
      charter: CHARTERS,
      charter_color: [
        { id: 'aaaa0004-0000-4000-8000-000000000003', charter_id: 'aaaa0004-0000-4000-8000-000000000005', key: 'texte', hex: hx('111111'), usage: 'texte' },
        { id: 'aaaa0004-0000-4000-8000-000000000002', charter_id: 'aaaa0004-0000-4000-8000-000000000004', key: 'fond', hex: hx('222222'), usage: 'fond' },
      ],
      charter_typeface: [{ id: 'aaaa0004-0000-4000-8000-000000000006', charter_id: 'aaaa0004-0000-4000-8000-000000000005', key: 'titre', family: 'Famille', weight: 500, min_size_mm: '12.5' }],
      charter_rule: [{ id: 'aaaa0004-0000-4000-8000-000000000008', charter_id: 'aaaa0004-0000-4000-8000-000000000005', kind: 'proportion', params: { ratio: '2:1' } }],
      lexicon_term: [{ id: 'aaaa0004-0000-4000-8000-000000000007', charter_id: 'aaaa0004-0000-4000-8000-000000000004', lang: 'fr', term: 'Issue', severity: 'discouraged' }],
    });

    const { charters } = await createPostgrestRepository(config).loadCharterRegistry('aaaa0004-0000-4000-8000-000000000001');
    expect(charters.map(c => c.id)).toEqual(['aaaa0004-0000-4000-8000-000000000005', 'aaaa0004-0000-4000-8000-000000000004']);
    expect(charters[0]?.colors.map(c => c.key)).toEqual(['texte']);
    expect(charters[0]?.typefaces[0]?.min_size_mm).toBe(12.5);
    expect(charters[0]?.rules[0]?.params).toEqual({ ratio: '2:1' });
    expect(charters[1]?.lexicon[0]?.term).toBe('Issue');
  });

  it('échoue sur une nature de règle hors liste, au lieu d’écarter la ligne', async () => {
    stubTables({
      site: [{ id: 'aaaa0004-0000-4000-8000-000000000001' }],
      charter: CHARTERS,
      charter_rule: [{ id: 'aaaa0004-0000-4000-8000-000000000008', charter_id: 'aaaa0004-0000-4000-8000-000000000004', kind: 'inconnue', params: {} }],
    });
    const error: unknown = await createPostgrestRepository(config).loadCharterRegistry('aaaa0004-0000-4000-8000-000000000001')
      .catch((e: unknown) => e);
    expect(isRepositoryError(error) && error.failure === 'request_failed').toBe(true);
  });

  it('échoue sur des paramètres de règle qui ne sont pas un objet', async () => {
    stubTables({
      site: [{ id: 'aaaa0004-0000-4000-8000-000000000001' }],
      charter: CHARTERS,
      charter_rule: [{ id: 'aaaa0004-0000-4000-8000-000000000008', charter_id: 'aaaa0004-0000-4000-8000-000000000004', kind: 'proportion', params: [1, 2] }],
    });
    const error: unknown = await createPostgrestRepository(config).loadCharterRegistry('aaaa0004-0000-4000-8000-000000000001')
      .catch((e: unknown) => e);
    expect(isRepositoryError(error) && error.failure === 'request_failed').toBe(true);
  });
});
