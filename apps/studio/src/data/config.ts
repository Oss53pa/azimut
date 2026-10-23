/**
 * Choix de la source de données, par l'environnement.
 *
 * Aucune clé, aucune URL n'est écrite dans le code : tout vient de
 * l'environnement de compilation (A2.4). Sans configuration, l'application
 * sert les sites de référence et le dit — elle ne prétend jamais lire un
 * dépôt qu'elle n'a pas.
 */
import { createReferenceRepository } from './reference-repository.js';
import { createPostgrestRepository } from './postgrest-repository.js';
import type { SiteRepository } from './site-repository.js';
import { currentAccessToken } from '../auth/app-auth.js';
import type { PostgrestConfig } from './postgrest-http.js';

export type DataSourceEnv = {
  readonly VITE_AZIMUT_API_URL?: string | undefined;
  readonly VITE_AZIMUT_API_KEY?: string | undefined;
  readonly VITE_AZIMUT_DB_SCHEMA?: string | undefined;
};

/** Schéma par défaut du produit. Le nom de schéma n'est pas un secret. */
export const DEFAULT_SCHEMA = 'azimut';

function trimmed(value: string | undefined): string {
  return value === undefined ? '' : value.trim();
}

/**
 * Construit le dépôt à servir. L'API REST n'est retenue que si l'URL **et**
 * la clé sont présentes : une configuration à moitié faite retombe sur les
 * sites de référence plutôt que d'échouer à chaque écran.
 */
export function createRepository(env: DataSourceEnv): SiteRepository {
  const config = postgrestConfigFor(env);
  return config === null ? createReferenceRepository() : createPostgrestRepository(config);
}

/**
 * La configuration de l'API REST, ou `null` sans URL ou sans clé. Les
 * requêtes portent le jeton de la session ouverte, lu à chaque envoi.
 */
export function postgrestConfigFor(env: DataSourceEnv): PostgrestConfig | null {
  const url = trimmed(env.VITE_AZIMUT_API_URL).replace(/\/+$/, '');
  const apiKey = trimmed(env.VITE_AZIMUT_API_KEY);
  if (url === '' || apiKey === '') return null;
  return {
    url,
    apiKey,
    schema: trimmed(env.VITE_AZIMUT_DB_SCHEMA) === ''
      ? DEFAULT_SCHEMA
      : trimmed(env.VITE_AZIMUT_DB_SCHEMA),
    accessToken: currentAccessToken,
  };
}

/** La configuration de l'API REST de l'application. */
export function appPostgrestConfig(): PostgrestConfig | null {
  return postgrestConfigFor(import.meta.env as DataSourceEnv);
}

/** Dépôt de l'application, construit une fois depuis l'environnement de build. */
export function appRepository(): SiteRepository {
  return createRepository(import.meta.env as DataSourceEnv);
}
