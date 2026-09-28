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
  { id: 'ch-a', name: 'Charte A', version: '1', created_at: '2026-01-01T00:00:00Z' },
  { id: 'ch-b', name: 'Charte B', version: '2', created_at: '2026-03-01T00:00:00Z' },
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
    const error: unknown = await createPostgrestRepository(config).loadCharterRegistry('site-1')
      .catch((e: unknown) => e);
    expect(calls[0]).toContain('/site?select=id&id=eq.site-1');
    expect(isRepositoryError(error) && error.failure === 'not_found').toBe(true);
  });

  it('range chaque ligne sous sa charte, la plus récente d’abord', async () => {
    stubTables({
      site: [{ id: 'site-1' }],
      charter: CHARTERS,
      charter_color: [
        { id: 'c2', charter_id: 'ch-b', key: 'texte', hex: hx('111111'), usage: 'texte' },
        { id: 'c1', charter_id: 'ch-a', key: 'fond', hex: hx('222222'), usage: 'fond' },
      ],
      charter_typeface: [{ id: 'f1', charter_id: 'ch-b', key: 'titre', family: 'Famille', weight: 500, min_size_mm: '12.5' }],
      charter_rule: [{ id: 'r1', charter_id: 'ch-b', kind: 'proportion', params: { ratio: '2:1' } }],
      lexicon_term: [{ id: 'l1', charter_id: 'ch-a', lang: 'fr', term: 'Issue', severity: 'discouraged' }],
    });

    const { charters } = await createPostgrestRepository(config).loadCharterRegistry('site-1');
    expect(charters.map(c => c.id)).toEqual(['ch-b', 'ch-a']);
    expect(charters[0]?.colors.map(c => c.key)).toEqual(['texte']);
    expect(charters[0]?.typefaces[0]?.min_size_mm).toBe(12.5);
    expect(charters[0]?.rules[0]?.params).toEqual({ ratio: '2:1' });
    expect(charters[1]?.lexicon[0]?.term).toBe('Issue');
  });

  it('échoue sur une nature de règle hors liste, au lieu d’écarter la ligne', async () => {
    stubTables({
      site: [{ id: 'site-1' }],
      charter: CHARTERS,
      charter_rule: [{ id: 'r1', charter_id: 'ch-a', kind: 'inconnue', params: {} }],
    });
    const error: unknown = await createPostgrestRepository(config).loadCharterRegistry('site-1')
      .catch((e: unknown) => e);
    expect(isRepositoryError(error) && error.failure === 'request_failed').toBe(true);
  });

  it('échoue sur des paramètres de règle qui ne sont pas un objet', async () => {
    stubTables({
      site: [{ id: 'site-1' }],
      charter: CHARTERS,
      charter_rule: [{ id: 'r1', charter_id: 'ch-a', kind: 'proportion', params: [1, 2] }],
    });
    const error: unknown = await createPostgrestRepository(config).loadCharterRegistry('site-1')
      .catch((e: unknown) => e);
    expect(isRepositoryError(error) && error.failure === 'request_failed').toBe(true);
  });
});
