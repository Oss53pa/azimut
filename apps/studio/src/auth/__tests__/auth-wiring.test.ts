import { describe, it, expect, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { query } from '../../data/postgrest-http.js';
import { authModeFor } from '../app-auth.js';
import { SignInPanel } from '../SignInPanel.js';
import { createAuthApi } from '../auth-api.js';
import { createAuthSession } from '../auth-session.js';
import { I18nProvider } from '../../i18n/index.js';
import { orgOfSession, setSessionMembership, REFERENCE_ORG } from '../../app/session-identity.js';

afterEach(() => { vi.unstubAllGlobals(); setSessionMembership(null); });

describe('A6.3 : chaque requête porte le jeton de la session, à défaut la clé publiable', () => {
  it('le jeton est lu à chaque requête', async () => {
    const seen: string[] = [];
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      seen.push((init.headers as Record<string, string>)['Authorization'] ?? '');
      return new Response('[]', { status: 200 });
    });
    let current: string | undefined = undefined;
    const config = { url: 'https://api.example.test', apiKey: 'cle', schema: 'azimut', accessToken: () => current };
    await query(config, 'site', 'select=id');
    current = 'jeton-de-session';
    await query(config, 'site', 'select=id');
    expect(seen).toEqual(['Bearer cle', 'Bearer jeton-de-session']);
  });
});

describe('A2.4 : le mode d’authentification se lit dans l’environnement', () => {
  it('sans API, les sites de référence ; API sans service, configuration incomplète ; sinon, connexion', () => {
    expect(authModeFor({}).kind).toBe('reference');
    expect(authModeFor({ VITE_AZIMUT_API_URL: 'https://x/rest/v1', VITE_AZIMUT_API_KEY: 'clef' }).kind).toBe('incomplete');
    expect(authModeFor({
      VITE_AZIMUT_API_URL: 'https://x/rest/v1', VITE_AZIMUT_API_KEY: 'clef', VITE_AZIMUT_AUTH_URL: 'https://x/auth/v1',
    }).kind).toBe('remote');
  });
});

describe('l’identité de session', () => {
  it('suit l’inscription posée par la garde, et retombe sur la référence à la déconnexion', () => {
    expect(orgOfSession()).toBe(REFERENCE_ORG);
    setSessionMembership({ orgId: '0a000000-0000-4000-8000-000000000001', role: 'admin' });
    expect(orgOfSession()).toBe('0a000000-0000-4000-8000-000000000001');
    setSessionMembership(null);
    expect(orgOfSession()).toBe(REFERENCE_ORG);
  });
});

describe('A6.3 : l’écran de connexion', () => {
  it('masque le mot de passe et le signale au gestionnaire du navigateur', () => {
    const api = createAuthApi({ url: 'https://x/auth/v1', apiKey: 'clef' });
    const session = createAuthSession(api, null, { set: () => 0, clear: () => undefined }, () => 0);
    const html = renderToStaticMarkup(
      createElement(I18nProvider, { defaultLang: 'fr', children: createElement(SignInPanel, { api, session }) }));
    expect(html).toContain('type="password"');
    expect(html).toContain('autoComplete="current-password"');
    expect(html).toContain('type="email"');
    expect(html).toContain('Connexion');
  });
});
