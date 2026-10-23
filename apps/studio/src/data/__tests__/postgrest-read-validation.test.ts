import { describe, it, expect, vi, afterEach } from 'vitest';
import { query, queryIn, idEq } from '../postgrest-http.js';
import { isRepositoryError } from '../index.js';

/**
 * Lot 4 de l'audit (A6.3) : ce que l'API rend est validé avant d'être lu, et
 * un identifiant n'entre dans une requête que s'il est un UUID.
 */
afterEach(() => { vi.unstubAllGlobals(); });

const config = { url: 'https://exemple.test/rest/v1', apiKey: 'clef', schema: 'azimut' };
const ID = 'b4000000-0000-4000-8000-000000000001';
const ORG = 'b4000000-0000-4000-8000-000000000002';
const RLO = String.fromCodePoint(0x202e);

function answer(rows: unknown): string[] {
  const urls: string[] = [];
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    urls.push(url);
    return Promise.resolve(new Response(JSON.stringify(rows), { status: 200 }));
  }));
  return urls;
}

async function failure(attempt: Promise<unknown>): Promise<string> {
  const error: unknown = await attempt.then(() => null, (e: unknown) => e);
  return isRepositoryError(error) ? `${error.failure} ${error.detail}` : 'accepté';
}

describe('lot 4 : la relecture suit la forme déclarée de la table', () => {
  const read = (rows: unknown) => {
    answer(rows);
    return query(config, 'support_version', `select=id,org_id,state&${idEq('id', ID)}`);
  };

  it('rend une ligne bien formée', async () => {
    expect(await read([{ id: ID, org_id: ORG, state: 'draft' }])).toHaveLength(1);
  });

  it.each([
    ['un état hors de l’énumération', [{ id: ID, org_id: ORG, state: 'publie' }], 'state invalid_value'],
    ['une colonne non demandée', [{ id: ID, org_id: ORG, state: 'draft', secret: 1 }], 'unrecognized_keys'],
    ['une colonne demandée absente', [{ id: ID, org_id: ORG }], 'state invalid_value'],
    ['un identifiant mal formé', [{ id: 'x', org_id: ORG, state: 'draft' }], 'id invalid_format'],
  ])('échoue sur %s, au lieu de convertir', async (_label, rows, where) => {
    expect(await failure(read(rows))).toContain(where);
  });

  it('échoue sur un texte stocké avec un forçage de direction', async () => {
    answer([{ id: ID, name: `Centre${RLO}` }]);
    expect(await failure(query(config, 'site', 'select=id,name'))).toContain('request_failed');
  });

  it('échoue sur une réponse qui n’est pas une liste, et sur une table sans forme déclarée', async () => {
    answer({ id: ID });
    expect(await failure(query(config, 'site', 'select=id'))).toContain('request_failed');
    answer([]);
    expect(await failure(query(config, 'table_inconnue', 'select=id'))).toContain('table sans forme déclarée');
    expect(await failure(query(config, 'site', 'select=id,mot_de_passe'))).toContain('colonne demandée inconnue');
  });
});

describe('lot 4 : un identifiant n’entre dans une requête que s’il est un UUID', () => {
  it.each([
    ['un identifiant lisible', 'site-1'],
    ['un second filtre glissé dans l’adresse', `${ID}&org_id=neq.${ORG}`],
    ['un opérateur glissé', `not.is.null`],
    ['une liste refermée', `${ID})`],
  ])('refuse %s', (_label, id) => {
    expect(() => idEq('id', id)).toThrow(/identifiant mal formé/);
  });

  it('refuse une liste dont un élément n’est pas un UUID, sans rien demander', async () => {
    const urls = answer([]);
    expect(await failure(queryIn(config, 'site', 'id', [ID, `${ORG}),or=(id.neq.0`]))).toContain('not_found');
    expect(urls).toHaveLength(0);
  });

  it('laisse passer un UUID', () => {
    expect(idEq('site_id', ID)).toBe(`site_id=eq.${ID}`);
  });
});
