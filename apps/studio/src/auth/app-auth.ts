/**
 * L'authentification de l'application, construite une fois depuis
 * l'environnement de compilation (A2.4 : aucune URL, aucune clé dans le code).
 *
 * Trois cas :
 *  - ni API ni service d'authentification : le studio sert les sites de
 *    référence, sans connexion, et le dit ;
 *  - l'API et le service d'authentification : connexion obligatoire ;
 *  - l'API sans le service : configuration incomplète, signalée. Le studio ne
 *    retombe pas en silence sur la clé publiable, qui ne voit rien.
 */
import { createAuthApi } from './auth-api.js';
import type { AuthApi } from './auth-api.js';
import { createAuthSession } from './auth-session.js';
import type { AuthSession, SessionStorageLike } from './auth-session.js';

export type AuthEnv = {
  readonly VITE_AZIMUT_API_URL?: string | undefined;
  readonly VITE_AZIMUT_API_KEY?: string | undefined;
  readonly VITE_AZIMUT_AUTH_URL?: string | undefined;
};

export type AuthMode =
  | { readonly kind: 'reference' }
  | { readonly kind: 'incomplete' }
  | { readonly kind: 'remote'; readonly api: AuthApi; readonly session: AuthSession };

function trimmed(value: string | undefined): string {
  return value === undefined ? '' : value.trim().replace(/\/+$/, '');
}

function tabStorage(): SessionStorageLike | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function authModeFor(env: AuthEnv, fetchImpl: typeof fetch = fetch): AuthMode {
  const apiUrl = trimmed(env.VITE_AZIMUT_API_URL);
  const apiKey = trimmed(env.VITE_AZIMUT_API_KEY);
  const authUrl = trimmed(env.VITE_AZIMUT_AUTH_URL);
  if (apiUrl === '' || apiKey === '') return { kind: 'reference' };
  if (authUrl === '') return { kind: 'incomplete' };
  const api = createAuthApi({ url: authUrl, apiKey }, fetchImpl);
  const session = createAuthSession(api, tabStorage(), {
    set: (run, delay) => setTimeout(run, delay),
    clear: handle => { clearTimeout(handle as ReturnType<typeof setTimeout>); },
  }, () => Date.now());
  return { kind: 'remote', api, session };
}

let mode: AuthMode | null = null;

/** Le mode d'authentification de l'application, construit au premier appel. */
export function appAuth(): AuthMode {
  mode ??= authModeFor(import.meta.env as AuthEnv);
  return mode;
}

/** Le jeton d'accès de la session ouverte, pour les requêtes à l'API. */
export function currentAccessToken(): string | undefined {
  const current = appAuth();
  return current.kind === 'remote' ? current.session.accessToken() : undefined;
}
