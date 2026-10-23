/**
 * Contrôle des politiques par rôle d'A6.2 (0075), lu sur la base et non sur le
 * texte des migrations.
 *
 * Toute table du schéma `azimut` portant `org_id`, sauf `membership` qui a les
 * siennes, doit porter les politiques restrictives `role_read` et
 * `role_insert`, et, hors des tables en insertion seule d'A12.3, `role_update`
 * et `role_delete`. Une table qui en manque est rendue, une ligne par politique
 * absente, dans un ordre stable (A9).
 */
import type { SqlReader } from './fixture-cleanup.js';

const INSERT_ONLY = ['audit_log', 'approval', 'graph_validation', 'message_schedule_approval'];
const ALWAYS = ['role_insert', 'role_read'];
const MUTABLE = ['role_delete', 'role_update'];

export async function missingRolePolicies(read: SqlReader): Promise<readonly string[]> {
  const tables = await read(`
    select c.relname as name from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'org_id' and not a.attisdropped
    where n.nspname = 'azimut' and c.relkind in ('r','p') and c.relname <> 'membership'`);
  const policies = await read(`
    select c.relname as name, p.polname as policy from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'azimut' and not p.polpermissive`);
  const present = new Set(policies.map(r => `${String(r['name'])} ${String(r['policy'])}`));

  const missing: string[] = [];
  for (const row of tables) {
    const table = String(row['name']);
    const expected = INSERT_ONLY.includes(table) ? ALWAYS : [...ALWAYS, ...MUTABLE];
    for (const policy of expected) {
      if (!present.has(`${table} ${policy}`)) missing.push(`${table} ${policy}`);
    }
  }
  return missing.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
