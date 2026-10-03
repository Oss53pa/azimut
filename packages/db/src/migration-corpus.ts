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
 * Les tables du schéma `azimut` que le corpus laisse en place, et pour chacune
 * si le corps de sa définition porte une colonne `org_id`.
 *
 * Le corpus se rejoue migration par migration, et non d'un seul bloc : une
 * table supprimée sort de la carte, et une table recréée plus tard y revient
 * avec sa nouvelle définition. Lire la seule concaténation ferait dire au
 * corpus qu'une table supprimée existe encore — c'est-à-dire décrire un
 * schéma que la base n'a plus, et réclamer pour elle une politique, un
 * propriétaire ou une infraction déclarée.
 *
 * La définition s'arrête à la parenthèse fermante de premier niveau, ce qui
 * suffit ici : aucune `CREATE TABLE` du corpus n'imbrique de sous-requête.
 */
export function createdTables(): ReadonlyMap<string, boolean> {
  const found = new Map<string, boolean>();

  for (const migration of upMigrations()) {
    const sql = migration.sql;
    for (const match of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?azimut\.([a-z_]+)\s*\(/g)) {
      const table = match[1];
      if (table === undefined) continue;
      const bodyStart = match.index + match[0].length;
      found.set(table, bodyOf(sql, bodyStart).includes('org_id'));
    }
    for (const table of droppedIn(sql)) found.delete(table);
  }
  return found;
}

/** Les tables du schéma `azimut` qu'une migration supprime. */
function droppedIn(sql: string): readonly string[] {
  const names: string[] = [];
  for (const m of sql.matchAll(/DROP TABLE (?:IF EXISTS )?azimut\.([a-z_]+)/g)) {
    if (m[1] !== undefined) names.push(m[1]);
  }
  return names;
}

/**
 * Retire d'un ensemble les tables que le corpus ne laisse pas en place.
 *
 * Une politique, un `ENABLE` ou un `FORCE` posés sur une table depuis
 * supprimée ne disent plus rien du schéma : la ligne de migration subsiste
 * dans le corpus, l'objet non.
 */
function stillCreated(names: Iterable<string>): ReadonlySet<string> {
  const alive = createdTables();
  return new Set([...names].filter(name => alive.has(name)));
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
  return stillCreated(named);
}

/** Les tables sur lesquelles le corpus active la sécurité par ligne. */
export function tablesWithRlsEnabled(): ReadonlySet<string> {
  const direct = tablesMatching(/ALTER TABLE azimut\.([a-z_]+)\s+ENABLE ROW LEVEL SECURITY/g);
  return stillCreated([...direct, ...namesInArray('enabled_tables')]);
}

/**
 * Les tables sur lesquelles le corpus force la sécurité par ligne.
 *
 * `FORCE` est ce qui rend le cloisonnement opposable au propriétaire des
 * tables. Sans lui, la connexion applicative, qui possède le schéma, voit tout.
 */
export function tablesWithRlsForced(): ReadonlySet<string> {
  const direct = tablesMatching(/ALTER TABLE azimut\.([a-z_]+)\s+FORCE ROW LEVEL SECURITY/g);
  return stillCreated([...direct, ...namesInArray('forced_tables')]);
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
