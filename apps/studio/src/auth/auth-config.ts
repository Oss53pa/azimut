/**
 * AUTH.3 — le client du service d'authentification, construit depuis
 * l'environnement de build.
 *
 * Décision QA1 d'Oss53pa (21 novembre 2026) : `@supabase/auth-js`, inscrit au
 * registre des dépendances. Sans URL du service, il n'y a pas de client, et
 * l'atelier reste ce qu'il est sans base : le mode local de M8 (partie M) critère 3, que
 * les essais de bout en bout parcourent.
 *
 * La session se garde dans le stockage de l'onglet et non dans le stockage
 * durable : elle meurt avec l'onglet, et un jeton laissé sur un poste partagé
 * ne survit pas à sa fermeture.
 */
import { GoTrueClient } from '@supabase/auth-js';
import type { SupportedStorage } from '@supabase/auth-js';

export type AuthEnv = {
  readonly VITE_AZIMUT_AUTH_URL?: string | undefined;
  readonly VITE_AZIMUT_API_KEY?: string | undefined;
};

export type AuthConfig = {
  /** Racine du service d'authentification, sans barre oblique finale. */
  readonly url: string;
  /** Clé publiable, que le service attend en en-tête `apikey`. */
  readonly apiKey: string;
};

/** Clé du stockage de session. Le nom n'est pas un secret. */
export const AUTH_STORAGE_KEY = 'azimut.auth';

function trimmed(value: string | undefined): string {
  return value === undefined ? '' : value.trim();
}

/** La configuration, ou `null` si l'URL ou la clé manque. */
export function authConfigFrom(env: AuthEnv): AuthConfig | null {
  const url = trimmed(env.VITE_AZIMUT_AUTH_URL).replace(/\/+$/, '');
  const apiKey = trimmed(env.VITE_AZIMUT_API_KEY);
  if (url === '' || apiKey === '') return null;
  return { url, apiKey };
}

export function createAuthClient(
  config: AuthConfig,
  storage: SupportedStorage | null,
  fetchImpl?: typeof fetch,
): GoTrueClient {
  return new GoTrueClient({
    url: config.url,
    headers: { apikey: config.apiKey },
    storageKey: AUTH_STORAGE_KEY,
    ...(storage === null ? { persistSession: false } : { storage, persistSession: true }),
    autoRefreshToken: true,
    detectSessionInUrl: false,
    ...(fetchImpl === undefined ? {} : { fetch: fetchImpl }),
  });
}

/** Le client de l'application, ou `null` sans service configuré. */
export function appAuthClient(): GoTrueClient | null {
  const config = authConfigFrom(import.meta.env as AuthEnv);
  if (config === null) return null;
  const storage = typeof sessionStorage === 'undefined' ? null : sessionStorage;
  return createAuthClient(config, storage);
}
