import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createRepository, createReferenceRepository, createPostgrestRepository,
  errorCodeForStatus, isRepositoryError, DEFAULT_SCHEMA,
} from '../index.js';

afterEach(() => { vi.unstubAllGlobals(); });

describe('Choix de la source de données', () => {
  it('sert les sites de référence sans configuration', () => {
    expect(createRepository({}).kind).toBe('reference');
  });

  it('retombe sur les sites de référence si la clé manque', () => {
    expect(createRepository({ VITE_AZIMUT_API_URL: 'https://x/rest/v1' }).kind).toBe('reference');
  });

  it('retombe sur les sites de référence si l’URL manque', () => {
    expect(createRepository({ VITE_AZIMUT_API_KEY: 'clef' }).kind).toBe('reference');
  });

  it('retient le dépôt quand URL et clé sont présentes', () => {
    const repo = createRepository({
      VITE_AZIMUT_API_URL: 'https://exemple.test/rest/v1/',
      VITE_AZIMUT_API_KEY: 'clef',
    });
    expect(repo.kind).toBe('postgrest');
    // La barre oblique finale est retirée : les URL construites ne doublent pas.
    expect(repo.origin).toContain('https://exemple.test/rest/v1 ');
    expect(repo.origin).toContain(DEFAULT_SCHEMA);
  });
});

describe('Dépôt des sites de référence', () => {
  const repo = createReferenceRepository();

  it('liste les sites de référence, triés par nom', async () => {
    const sites = await repo.listSites();
    expect(sites.length).toBeGreaterThan(0);
    const names = sites.map(s => s.name);
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
  });

  it('charge un site par sa clé', async () => {
    const site = await repo.loadSite('ref-multilevel');
    expect(site.site.name.length).toBeGreaterThan(0);
  });

  it('refuse une clé inconnue avec NET.NOT_FOUND', async () => {
    await expect(repo.loadSite('inexistant')).rejects.toSatisfy(
      (e: unknown) => isRepositoryError(e) && e.code === 'NET.NOT_FOUND',
    );
  });
});

describe('Codes d’erreur d’accès', () => {
  it('traduit les statuts HTTP en codes du catalogue', () => {
    expect(errorCodeForStatus(401)).toBe('NET.UNAUTHORIZED');
    expect(errorCodeForStatus(403)).toBe('NET.FORBIDDEN');
    expect(errorCodeForStatus(404)).toBe('NET.NOT_FOUND');
    expect(errorCodeForStatus(500)).toBe('NET.REQUEST_FAILED');
    expect(errorCodeForStatus(418)).toBe('NET.REQUEST_FAILED');
  });
});

describe('Dépôt lu par l’API REST', () => {
  const config = { url: 'https://exemple.test/rest/v1', apiKey: 'clef', schema: 'azimut' };

  it('nomme le schéma et porte la clé sur chaque requête', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await createPostgrestRepository(config).listSites();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('https://exemple.test/rest/v1/site?');
    const headers = init.headers as Record<string, string>;
    expect(headers['Accept-Profile']).toBe('azimut');
    expect(headers.apikey).toBe('clef');
  });

  it('remonte un droit refusé en NET.FORBIDDEN', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('', { status: 403, statusText: 'Forbidden' }),
    ));
    await expect(createPostgrestRepository(config).listSites()).rejects.toSatisfy(
      (e: unknown) => isRepositoryError(e) && e.code === 'NET.FORBIDDEN',
    );
  });

  it('remonte une coupure réseau en NET.REQUEST_FAILED', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connexion refusée')));
    await expect(createPostgrestRepository(config).listSites()).rejects.toSatisfy(
      (e: unknown) => isRepositoryError(e) && e.code === 'NET.REQUEST_FAILED',
    );
  });

  it('refuse un site absent avec NET.NOT_FOUND plutôt qu’un site vide', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }),
    ));
    await expect(createPostgrestRepository(config).loadSite('abc')).rejects.toSatisfy(
      (e: unknown) => isRepositoryError(e) && e.code === 'NET.NOT_FOUND',
    );
  });
});

describe('Vocabulaire du site', () => {
  const config = { url: 'https://exemple.test/rest/v1', apiKey: 'clef', schema: 'azimut' };

  it('rend un registre vide pour un site de référence qui n’en déclare pas', async () => {
    const vocabulary = await createReferenceRepository().loadVocabulary('ref-minimal');
    expect(vocabulary.lexicon ?? []).toEqual([]);
    expect(vocabulary.facts ?? []).toEqual([]);
  });

  it('rend le vocabulaire du site multi-niveaux', async () => {
    const vocabulary = await createReferenceRepository().loadVocabulary('ref-multilevel');
    expect((vocabulary.lexicon ?? []).length).toBeGreaterThan(0);
    expect((vocabulary.facts ?? [])[0]?.key).toBe('parking_gratuit');
    // Deux affirmations divergentes : c'est l'écart du complément.
    expect((vocabulary.claims ?? []).map(c => c.value)).toEqual(['3', '2']);
  });

  it('refuse un site inconnu plutôt que de rendre un registre vide', async () => {
    // Un vide rendu ici se lirait comme « ce site ne déclare rien ».
    await expect(createReferenceRepository().loadVocabulary('ref-absent')).rejects.toSatisfy(
      (e: unknown) => isRepositoryError(e) && e.code === 'NET.NOT_FOUND',
    );
  });

  it('lit le lexique par identifiant de charte, sans filtre sur ressource imbriquée', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      calls.push(url);
      const body = url.includes('/charter?') ? '[{"id":"ch-1"}]' : '[]';
      return Promise.resolve(new Response(body, { status: 200 }));
    }));

    await createPostgrestRepository(config).loadVocabulary('site-1');

    expect(calls.some(u => u.includes('/charter?select=id&site_id=eq.site-1'))).toBe(true);
    expect(calls.some(u => u.includes('/lexicon_term?charter_id=in.(ch-1)'))).toBe(true);
    // La forme imbriquée exigerait la ressource dans le `select` ; on ne s'y fie pas.
    expect(calls.some(u => u.includes('charter.site_id'))).toBe(false);
  });

  it('remonte l’échec de lecture du vocabulaire au lieu de rendre un vide', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('', { status: 403, statusText: 'Forbidden' }),
    ));
    await expect(createPostgrestRepository(config).loadVocabulary('site-1')).rejects.toSatisfy(
      (e: unknown) => isRepositoryError(e) && e.code === 'NET.FORBIDDEN',
    );
  });

  it('ne requête pas les mots interdits quand aucun fait n’est déclaré', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      calls.push(url);
      return Promise.resolve(new Response('[]', { status: 200 }));
    }));

    await createPostgrestRepository(config).loadVocabulary('site-1');
    expect(calls.some(u => u.includes('site_fact_forbidden_word'))).toBe(false);
  });
});
