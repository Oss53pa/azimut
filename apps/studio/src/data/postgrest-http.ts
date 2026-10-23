/**
 * Les requêtes de l'adaptateur REST : `fetch` et rien d'autre (A3.3).
 *
 * Séparées de l'adaptateur pour que chaque registre lu à part (vocabulaire,
 * wayfinding) les emploie sans que le fichier de l'adaptateur grossisse.
 */
import type { z } from 'zod';
import { readRowSchema, tableColumns } from '@azimut/core-model';
import { RepositoryError, failureForStatus } from './site-repository.js';

export type PostgrestConfig = {
  /** Racine de l'API REST, sans barre oblique finale. */
  readonly url: string;
  /** Clé publiable. Elle n'ouvre rien par elle-même : le cloisonnement est en base. */
  readonly apiKey: string;
  /** Schéma interrogé. */
  readonly schema: string;
  /**
   * Le jeton de la session ouverte (A6.3). Lu à chaque requête, pour qu'un
   * jeton rafraîchi serve aussitôt. Sans session, la clé publiable, qui ne
   * voit rien.
   */
  readonly accessToken?: (() => string | undefined) | undefined;
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
        Authorization: `Bearer ${config.accessToken?.() ?? config.apiKey}`,
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

  let body: unknown;
  try {
    body = await response.json();
  } catch (cause) {
    throw new RepositoryError('request_failed', `${table}: ${String(cause)}`);
  }
  return checkedRows<Row>(table, search, body);
}

/** Les colonnes que `select=` demande ; toutes, sans `select=` ou avec `*`. */
function selectedColumns(search: string): readonly string[] | undefined {
  const select = new URLSearchParams(search).get('select');
  if (select === null || select === '*') return undefined;
  return select.split(',');
}

const ROW_SCHEMAS = new Map<string, z.ZodType>();

/**
 * Lot 4 de l'audit (A6.3) : une ligne relue est validée avant d'être lue.
 *
 * Chaque ligne suit la forme que le catalogue déclare pour sa table : aucune
 * colonne inattendue, chaque valeur de son type, de son format et de son
 * énumération. Une ligne qui s'en écarte fait échouer la lecture, comme un
 * statut en erreur : elle n'est jamais convertie en silence. Une fonction
 * (`rpc/...`) rend sa propre forme, que son appelant valide.
 */
function checkedRows<Row>(table: string, search: string, body: unknown): readonly Row[] {
  if (!Array.isArray(body)) throw new RepositoryError('request_failed', `${table}: réponse qui n'est pas une liste`);
  if (table.startsWith('rpc/')) return body as readonly Row[];
  const columns = tableColumns(table);
  if (columns === undefined) throw new RepositoryError('request_failed', `${table}: table sans forme déclarée`);
  const selected = selectedColumns(search);
  const key = `${table}?${selected?.join(',') ?? '*'}`;
  let schema = ROW_SCHEMAS.get(key);
  if (schema === undefined) {
    if (selected?.some(c => !Object.prototype.hasOwnProperty.call(columns, c)) === true) {
      throw new RepositoryError('request_failed', `${table}: colonne demandée inconnue`);
    }
    schema = readRowSchema(columns, selected);
    ROW_SCHEMAS.set(key, schema);
  }
  for (const row of body) {
    const parsed = schema.safeParse(row);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const where = issue === undefined ? '' : `${String(issue.path[0] ?? '*')} ${issue.code}`;
      throw new RepositoryError('request_failed', `${table}: ligne relue hors de sa forme (${where})`);
    }
  }
  return body as readonly Row[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lot 4 de l'audit : le filtre `colonne=eq.<id>` d'une requête. L'identifiant
 * vient souvent de l'adresse de la page ; il n'entre dans la requête que s'il
 * est un UUID, sans quoi la lecture échoue comme une ligne introuvable.
 */
export function idEq(column: string, id: string): string {
  if (!UUID.test(id)) throw new RepositoryError('not_found', `${column}: identifiant mal formé`);
  return `${column}=eq.${id}`;
}

/** Filtre `in.(a,b,c)` de PostgREST. Une liste vide ne déclenche aucune requête. */
function inList(column: string, ids: readonly string[]): string {
  if (!ids.every(id => UUID.test(id))) throw new RepositoryError('not_found', `${column}: identifiant mal formé`);
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

