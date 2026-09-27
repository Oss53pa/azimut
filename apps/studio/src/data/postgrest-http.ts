/**
 * Les requêtes de l'adaptateur REST : `fetch` et rien d'autre (A3.3).
 *
 * Séparées de l'adaptateur pour que chaque registre lu à part — vocabulaire,
 * wayfinding — les emploie sans que le fichier de l'adaptateur grossisse.
 */
import { RepositoryError, failureForStatus } from './site-repository.js';

export type PostgrestConfig = {
  /** Racine de l'API REST, sans barre oblique finale. */
  readonly url: string;
  /** Clé publiable. Elle n'ouvre rien par elle-même : le cloisonnement est en base. */
  readonly apiKey: string;
  /** Schéma interrogé. */
  readonly schema: string;
};

/** Une requête en échec qu'aucun statut n'explique : réseau coupé, ou service injoignable. */
function transportError(detail: string): RepositoryError {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  return new RepositoryError(offline ? 'offline' : 'request_failed', detail);
}

export async function query<Row>(
  config: PostgrestConfig,
  table: string,
  search: string,
): Promise<readonly Row[]> {
  const url = `${config.url}/${table}?${search}`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${config.apiKey}`,
        'Accept-Profile': config.schema,
        Accept: 'application/json',
      },
    });
  } catch (cause) {
    throw transportError(`${table}: ${String(cause)}`);
  }

  if (!response.ok) {
    throw new RepositoryError(
      failureForStatus(response.status),
      `${table}: ${String(response.status)} ${response.statusText}`,
    );
  }

  try {
    return await response.json() as readonly Row[];
  } catch (cause) {
    throw new RepositoryError('request_failed', `${table}: ${String(cause)}`);
  }
}

/** Filtre `in.(a,b,c)` de PostgREST. Une liste vide ne déclenche aucune requête. */
function inList(column: string, ids: readonly string[]): string {
  return `${column}=in.(${ids.join(',')})`;
}

export async function queryIn<Row>(
  config: PostgrestConfig,
  table: string,
  column: string,
  ids: readonly string[],
): Promise<readonly Row[]> {
  if (ids.length === 0) return [];
  return query<Row>(config, table, inList(column, ids));
}

