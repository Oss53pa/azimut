/**
 * Lecture du corpus de migrations comme d'une donnée.
 *
 * Aucune base n'est disponible pendant les essais. Le seul texte qui fasse foi
 * sur l'état du schéma est donc la suite des migrations elle-même, et c'est
 * sur elle que portent les contrôles de A6.1.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION_DIR = resolve(HERE, '..', 'migrations');

export type Migration = {
  readonly name: string;
  readonly sql: string;
};

/** Corps SQL sans les commentaires : un commentaire n'exécute rien. */
export function statementsOf(sql: string): string {
  return sql
    .split('\n')
    .filter(line => !line.trimStart().startsWith('--'))
    .join('\n');
}

/** Les migrations montantes, dans l'ordre lexicographique de leur nom. */
export function upMigrations(): readonly Migration[] {
  return readdirSync(MIGRATION_DIR)
    .filter(f => f.endsWith('.up.sql'))
    .sort()
    .map(name => ({
      name,
      sql: statementsOf(readFileSync(resolve(MIGRATION_DIR, name), 'utf8')),
    }));
}

/** Tout le SQL montant concaténé, commentaires retirés. */
export function allUpSql(): string {
  return upMigrations().map(m => m.sql).join('\n');
}

/**
 * Les tables du schéma `azimut` créées par le corpus, et pour chacune si le
 * corps de sa définition porte une colonne `org_id`.
 *
 * La définition s'arrête à la parenthèse fermante de premier niveau, ce qui
 * suffit ici : aucune `CREATE TABLE` du corpus n'imbrique de sous-requête.
 */
export function createdTables(): ReadonlyMap<string, boolean> {
  const sql = allUpSql();
  const found = new Map<string, boolean>();
  const pattern = /CREATE TABLE (?:IF NOT EXISTS )?azimut\.([a-z_]+)\s*\(/g;

  for (const match of sql.matchAll(pattern)) {
    const table = match[1];
    if (table === undefined) continue;
    const bodyStart = match.index + match[0].length;
    found.set(table, bodyOf(sql, bodyStart).includes('org_id'));
  }
  return found;
}

/** Le corps d'une définition de table, de `start` à sa parenthèse fermante. */
function bodyOf(sql: string, start: number): string {
  let depth = 1;
  for (let i = start; i < sql.length; i += 1) {
    const c = sql[i];
    if (c === '(') depth += 1;
    else if (c === ')') {
      depth -= 1;
      if (depth === 0) return sql.slice(start, i);
    }
  }
  return sql.slice(start);
}

/**
 * Les tables que le corpus munit d'une politique de sécurité par ligne, que ce
 * soit par un `CREATE POLICY` écrit en toutes lettres ou par un nom figurant
 * dans le tableau d'une boucle `FOREACH`.
 */
export function tablesWithPolicy(): ReadonlySet<string> {
  const sql = allUpSql();
  const named = new Set<string>();

  for (const m of sql.matchAll(/CREATE POLICY\s+\S+\s+ON\s+azimut\.([a-z_]+)/g)) {
    if (m[1] !== undefined) named.add(m[1]);
  }
  for (const name of namesInArray('tables')) named.add(name);
  return named;
}

/** Les tables sur lesquelles le corpus active la sécurité par ligne. */
export function tablesWithRlsEnabled(): ReadonlySet<string> {
  const direct = tablesMatching(/ALTER TABLE azimut\.([a-z_]+)\s+ENABLE ROW LEVEL SECURITY/g);
  return new Set([...direct, ...namesInArray('enabled_tables')]);
}

/**
 * Les tables sur lesquelles le corpus force la sécurité par ligne.
 *
 * `FORCE` est ce qui rend le cloisonnement opposable au propriétaire des
 * tables. Sans lui, la connexion applicative, qui possède le schéma, voit tout.
 */
export function tablesWithRlsForced(): ReadonlySet<string> {
  const direct = tablesMatching(/ALTER TABLE azimut\.([a-z_]+)\s+FORCE ROW LEVEL SECURITY/g);
  return new Set([...direct, ...namesInArray('forced_tables')]);
}

function tablesMatching(pattern: RegExp): ReadonlySet<string> {
  const found = new Set<string>();
  for (const m of allUpSql().matchAll(pattern)) {
    if (m[1] !== undefined) found.add(m[1]);
  }
  return found;
}

/** Les noms cités dans le tableau d'une boucle `FOREACH ... IN ARRAY <nom>`. */
function namesInArray(variable: string): ReadonlySet<string> {
  const found = new Set<string>();
  const declaration = new RegExp(`${variable}\\s+text\\[\\]\\s*:=\\s*ARRAY\\[([^\\]]*)\\]`, 'g');
  for (const m of allUpSql().matchAll(declaration)) {
    for (const q of (m[1] ?? '').matchAll(/'([a-z_]+)'/g)) {
      if (q[1] !== undefined) found.add(q[1]);
    }
  }
  return found;
}
