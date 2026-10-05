/**
 * Les colonnes booléennes du schéma, table par table, tirées du schéma Drizzle
 * déclaré (`schema/`), que l'essai de dérive tient d'accord avec les
 * migrations.
 *
 * Le chemin d'écriture en a besoin pour une raison précise : le client
 * `postgres` sérialise une valeur destinée à une colonne booléenne par
 * `x === true ? 't' : 'f'`. Toute autre valeur — la chaîne `'true'` comprise —
 * s'écrit donc « faux », sans erreur. Le dépôt ne peut pas laisser passer une
 * écriture qui change la valeur en silence.
 */
import { is } from 'drizzle-orm';
import { PgTable, getTableConfig } from 'drizzle-orm/pg-core';
import * as schema from './schema/index.js';

const BOOLEAN_COLUMNS: ReadonlyMap<string, ReadonlySet<string>> = (() => {
  const out = new Map<string, Set<string>>();
  for (const value of Object.values(schema)) {
    if (!is(value, PgTable)) continue;
    const config = getTableConfig(value);
    const booleans = config.columns.filter(c => c.columnType === 'PgBoolean').map(c => c.name);
    if (booleans.length > 0) out.set(config.name, new Set(booleans));
  }
  return out;
})();

/** Les colonnes booléennes d'une table ; vide si elle n'en a pas. */
export function booleanColumnsOf(table: string): ReadonlySet<string> {
  return BOOLEAN_COLUMNS.get(table) ?? new Set();
}
