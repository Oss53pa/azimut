import { describe, it, expect } from 'vitest';
import { createAuthApi } from '../auth-api.js';

type Call = { readonly url: string; readonly init: RequestInit };

function fakeFetch(responses: readonly (Response | Error)[]): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  let i = 0;
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses[i++];
    if (next === undefined) throw new Error('aucune réponse prévue');
    if (next instanceof Error) throw next;
    return next;
  }) as unknown as typeof fetch;
  return { fetch: impl, calls };
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const TOKENS = { access_token: 'a.b.c', refresh_token: 'r', expires_in: 3600, token_type: 'bearer' };
const CONFIG = { url: 'https://auth.example.test/auth/v1', apiKey: 'cle-publiable' };

describe('A6.3 : le client d’authentification par appels HTTP directs', () => {
  it('ouvre une session et envoie la clé publiable, jamais un jeton qu’il n’a pas', async () => {
    const { fetch, calls } = fakeFetch([json(TOKENS)]);
    const out = await createAuthApi(CONFIG, fetch).signIn('a@example.test', 'secret');
    expect(out).toEqual({ ok: true, value: { access_token: 'a.b.c', refresh_token: 'r', expires_in: 3600 } });
    expect(calls[0]?.url).toBe(`${CONFIG.url}/token?grant_type=password`);
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers['apikey']).toBe('cle-publiable');
    expect(headers['Authorization']).toBeUndefined();
  });

  it('un refus du service est « refused », sans dire pourquoi', async () => {
    const { fetch } = fakeFetch([json({ error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400)]);
    expect(await createAuthApi(CONFIG, fetch).signIn('a@example.test', 'faux')).toEqual({ ok: false, reason: 'refused' });
  });

  it('un service en panne ou injoignable est « unavailable »', async () => {
    const { fetch } = fakeFetch([json({}, 503), new TypeError('réseau coupé')]);
    const api = createAuthApi(CONFIG, fetch);
    expect(await api.signIn('a@example.test', 'x')).toEqual({ ok: false, reason: 'unavailable' });
    expect(await api.signIn('a@example.test', 'x')).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('une réponse qui n’a pas la forme attendue est refusée, pas devinée', async () => {
    const { fetch } = fakeFetch([json({ access_token: '', refresh_token: 'r', expires_in: 3600 })]);
    expect(await createAuthApi(CONFIG, fetch).signIn('a@example.test', 'x')).toEqual({ ok: false, reason: 'malformed' });
  });

  it('vérifie un code par un défi puis une vérification, sous le jeton de la session', async () => {
    const { fetch, calls } = fakeFetch([json({ id: 'defi-1', expires_at: 1 }), json(TOKENS)]);
    const out = await createAuthApi(CONFIG, fetch).verifyTotp('jeton', 'facteur/1', '123456');
    expect(out.ok).toBe(true);
    expect(calls.map(c => c.url)).toEqual([
      `${CONFIG.url}/factors/facteur%2F1/challenge`,
      `${CONFIG.url}/factors/facteur%2F1/verify`,
    ]);
    expect(JSON.parse(String(calls[1]?.init.body))).toEqual({ challenge_id: 'defi-1', code: '123456' });
    expect((calls[1]?.init.headers as Record<string, string>)['Authorization']).toBe('Bearer jeton');
  });

  it('un code refusé est « invalid_code »', async () => {
    const { fetch } = fakeFetch([json({ id: 'defi-1' }), json({ error: 'invalid code' }, 422)]);
    expect(await createAuthApi(CONFIG, fetch).verifyTotp('jeton', 'f', '000000')).toEqual({ ok: false, reason: 'invalid_code' });
  });

  it('lit les facteurs de l’utilisateur, absents ou présents', async () => {
    const id = '0a000000-0000-4000-8000-0000000000a1';
    const { fetch } = fakeFetch([
      json({ id, factors: null }),
      json({ id, factors: [{ id: 'f1', factor_type: 'totp', status: 'verified' }] }),
    ]);
    const api = createAuthApi(CONFIG, fetch);
    expect(await api.user('jeton')).toEqual({ ok: true, value: { id, factors: [] } });
    expect(await api.user('jeton')).toEqual({
      ok: true, value: { id, factors: [{ id: 'f1', factor_type: 'totp', status: 'verified' }] },
    });
  });

  it('ferme la session sur ce poste ou sur tous les appareils', async () => {
    const { fetch, calls } = fakeFetch([new Response(null, { status: 204 }), new Response(null, { status: 204 })]);
    const api = createAuthApi(CONFIG, fetch);
    await api.signOut('jeton', 'local');
    await api.signOut('jeton', 'global');
    expect(calls.map(c => c.url)).toEqual([`${CONFIG.url}/logout?scope=local`, `${CONFIG.url}/logout?scope=global`]);
  });
});
