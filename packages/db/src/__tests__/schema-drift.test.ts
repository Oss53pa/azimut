import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DB = resolve(HERE, '..', '..');

/**
 * Trois descriptions du même schéma, qui doivent dire la même chose.
 *
 * Le dépôt décrit ses tables trois fois : en SQL dans les migrations, qui font
 * foi puisque c'est ce que la base exécute ; en TypeScript dans `schema/`, que
 * Drizzle emploie pour composer les requêtes ; et en types de ligne dans
 * `mapping/row-types.ts`, par où la donnée entre dans le modèle. Rien ne
 * vérifiait qu'elles concordent, et aucune base n'est disponible aux essais
 * pour trancher.
 *
 * J'ai créé deux fois le même défaut sur cette branche : une colonne `geom`
 * présente en SQL et chez Drizzle, absente du type de ligne et du modèle. Elle
 * était `NOT NULL` la première fois, ce qui rendait toute insertion impossible
 * — et rien ne le disait, parce que rien ne lit une base qui n'existe pas
 * pendant les essais. Deux fois de suite, par relecture seule.
 */

const AUDIT_COLUMNS = new Set(['created_at', 'updated_at']);

/**
 * Colonnes d'une table qu'un type de ligne ne porte pas, et pourquoi.
 *
 * Trois familles, et aucune n'est un oubli : la suppression logique, que le
 * chargeur emploie pour filtrer sans avoir à la rendre ; les colonnes JSON
 * qu'aucun moteur ne consomme encore ; et les colonnes d'avant la refonte
 * A5.6, que `schema/signage.ts` signale déjà une à une en commentaire.
 */
const COLUMNS_NOT_IN_ROW: Readonly<Record<string, string>> = {
  'site.deleted_at':
    'Suppression logique : le chargeur filtre dessus et n’a pas à la rendre au modèle.',
  'support.deleted_at':
    'Suppression logique, même raison que pour `site`.',
  'building.opening_hours':
    'Colonne JSON d’horaires qu’aucun moteur ne consomme encore.',
  'edge.availability':
    'Colonne JSON de disponibilité d’une arête, sans lecteur à ce jour.',
  'travel_profile.weights':
    'Pondérations de profil en JSON, que le calcul d’itinéraire ne lit pas encore.',
  'support_content_block.config':
    'Configuration de bloc en JSON ; A5.6 lui a substitué `binding` et `free_text`, que le type porte.',
  'support.kind':
    'Colonne d’avant la refonte A5.6, remplacée par `registry` et `context`. Le commentaire de `schema/signage.ts` la signale.',
  'support.typology_id':
    'Additif A5.6 (migration 0015) que le chargeur ne joint pas encore à la typologie.',
  'support.width_m':
    'Dimension d’avant A5.6, en mètres ; `width_mm` la remplace et le type la porte.',
  'support.height_m':
    'Dimension d’avant A5.6, en mètres ; `height_mm` la remplace et le type la porte.',
  'support_face.side':
    'Colonne préexistante, laissée en place par la migration 0016 ; la face s’identifie désormais par `face_index` et `template_key`.',
  'support_face.width_mm':
    'Dimensions de face d’avant A5.6 ; elles viennent maintenant du gabarit, non de la ligne.',
  'support_face.height_mm':
    'Dimensions de face d’avant A5.6, même raison que `width_mm`.',
};

/** Mots qui ouvrent une contrainte, non une colonne, dans un CREATE TABLE. */
const NOT_A_COLUMN = new Set([
  'CONSTRAINT', 'PRIMARY', 'UNIQUE', 'CHECK', 'FOREIGN', 'EXCLUDE', 'LIKE',
]);

function drizzleTables(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const dir = resolve(DB, 'src', 'schema');
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith('.ts')) continue;
    const body = readFileSync(resolve(dir, entry), 'utf-8');
    for (const table of body.matchAll(/azimut\.table\('(\w+)',\s*\{([\s\S]*?)\n\}/g)) {
      const columns = new Set<string>();
      for (const col of (table[2] ?? '').matchAll(/\b\w+:\s*\w+\('(\w+)'/g)) {
        columns.add(col[1] ?? '');
      }
      out.set(table[1] ?? '', columns);
    }
  }
  return out;
}

/** Rejoue les migrations dans l'ordre : créations, ajouts et retraits de colonne. */
function migratedTables(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const dir = resolve(DB, 'migrations');
  for (const entry of readdirSync(dir).filter(f => f.endsWith('.up.sql')).sort()) {
    const body = readFileSync(resolve(dir, entry), 'utf-8');

    for (const created of body.matchAll(
      /CREATE TABLE (?:IF NOT EXISTS )?azimut\.(\w+)\s*\(([\s\S]*?)\n\);/g,
    )) {
      const columns = new Set<string>();
      for (const raw of (created[2] ?? '').split('\n')) {
        const line = raw.trim();
        if (line === '' || line.startsWith('--')) continue;
        const word = /^([a-z_][a-z0-9_]*)\s/.exec(line);
        const name = word?.[1];
        if (name !== undefined && !NOT_A_COLUMN.has(name.toUpperCase())) columns.add(name);
      }
      out.set(created[1] ?? '', columns);
    }

    for (const altered of body.matchAll(/ALTER TABLE azimut\.(\w+)([\s\S]*?);/g)) {
      const table = out.get(altered[1] ?? '') ?? new Set<string>();
      for (const added of (altered[2] ?? '').matchAll(/ADD COLUMN ([a-z_][a-z0-9_]*)/g)) {
        table.add(added[1] ?? '');
      }
      for (const dropped of (altered[2] ?? '').matchAll(
        /DROP COLUMN (?:IF EXISTS )?([a-z_][a-z0-9_]*)/g,
      )) {
        table.delete(dropped[1] ?? '');
      }
      out.set(altered[1] ?? '', table);
    }

    for (const dropped of body.matchAll(/DROP TABLE (?:IF EXISTS )?azimut\.(\w+)/g)) {
      out.delete(dropped[1] ?? '');
    }
  }
  return out;
}

/** `ParkingSpace` → `parking_space`. */
function snakeCase(name: string): string {
  return name.replace(/(?<!^)(?=[A-Z])/g, '_').toLowerCase();
}

function rowTypes(): Map<string, Set<string>> {
  const body = readFileSync(resolve(DB, 'src', 'mapping', 'row-types.ts'), 'utf-8');
  const out = new Map<string, Set<string>>();
  for (const type of body.matchAll(/export type (\w+)Row = \{([\s\S]*?)\n\};/g)) {
    const fields = new Set<string>();
    for (const field of (type[2] ?? '').matchAll(/readonly (\w+)\??:/g)) {
      fields.add(field[1] ?? '');
    }
    out.set(snakeCase(type[1] ?? ''), fields);
  }
  return out;
}

const drizzle = drizzleTables();
const migrated = migratedTables();
const rows = rowTypes();

describe('le schéma dit la même chose en SQL, chez Drizzle et au type de ligne', () => {
  it('les trois lectures trouvent quelque chose', () => {
    expect(drizzle.size).toBeGreaterThan(40);
    expect(migrated.size).toBe(drizzle.size);
    expect(rows.size).toBeGreaterThan(15);
  });

  it('les migrations et Drizzle décrivent les mêmes tables', () => {
    const onlySql = [...migrated.keys()].filter(t => !drizzle.has(t)).sort();
    const onlyTs = [...drizzle.keys()].filter(t => !migrated.has(t)).sort();
    expect(onlySql, `Tables créées en SQL et absentes de schema/ :\n${onlySql.join('\n')}`)
      .toHaveLength(0);
    expect(onlyTs, `Tables déclarées chez Drizzle et jamais créées en SQL :\n${onlyTs.join('\n')}`)
      .toHaveLength(0);
  });

  it('les migrations et Drizzle décrivent les mêmes colonnes, sans exception', () => {
    // Aucune liste d'exemptions ici, et c'est voulu : une colonne que la base
    // porte et que Drizzle ignore ne se lit pas, une colonne que Drizzle
    // invente casse la requête. Ni l'une ni l'autre n'a de raison d'exister.
    const drift: string[] = [];
    for (const [table, sqlColumns] of migrated) {
      const tsColumns = drizzle.get(table) ?? new Set<string>();
      for (const c of [...sqlColumns].sort()) {
        if (!tsColumns.has(c)) drift.push(`${table}.${c} : en base, absente de schema/`);
      }
      for (const c of [...tsColumns].sort()) {
        if (!sqlColumns.has(c)) drift.push(`${table}.${c} : chez Drizzle, jamais créée en SQL`);
      }
    }
    expect(drift, `Dérive entre les migrations et schema/ :\n${drift.join('\n')}`).toHaveLength(0);
  });

  it('un type de ligne ne réclame aucune colonne qui n’existe pas', () => {
    const ghosts: string[] = [];
    for (const [table, fields] of rows) {
      const columns = drizzle.get(table);
      if (columns === undefined) {
        ghosts.push(`${table} : type de ligne sans table homonyme`);
        continue;
      }
      for (const f of [...fields].sort()) {
        if (!columns.has(f)) ghosts.push(`${table}.${f} : réclamée par le type, absente de la table`);
      }
    }
    expect(ghosts, `Champs fantômes :\n${ghosts.join('\n')}`).toHaveLength(0);
  });

  it('une colonne qu’un type de ligne laisse de côté est inscrite et motivée', () => {
    // C'est le défaut que j'ai commis deux fois : une colonne que la base
    // porte, que le modèle ignore, et que personne ne peut donc écrire.
    const unexplained: string[] = [];
    for (const [table, fields] of rows) {
      for (const c of [...(drizzle.get(table) ?? [])].sort()) {
        if (AUDIT_COLUMNS.has(c) || fields.has(c)) continue;
        if (`${table}.${c}` in COLUMNS_NOT_IN_ROW) continue;
        unexplained.push(`${table}.${c}`);
      }
    }
    expect(
      unexplained,
      'Colonnes que la base porte et qu’aucun type de ligne ne lit :\n' + unexplained.join('\n') +
      '\n\nAjoutez-les au type de ligne et au modèle, ou inscrivez-les dans ' +
      'COLUMNS_NOT_IN_ROW avec la raison.',
    ).toHaveLength(0);
  });

  it('la liste ne vieillit pas : rien n’y reste une fois la colonne lue', () => {
    const stale = Object.keys(COLUMNS_NOT_IN_ROW).filter((key) => {
      const [table, column] = key.split('.');
      if (table === undefined || column === undefined) return true;
      const fields = rows.get(table);
      if (fields === undefined) return true;
      return fields.has(column) || !(drizzle.get(table)?.has(column) ?? false);
    }).sort();
    expect(
      stale,
      'Ces colonnes sont désormais lues, ou ont disparu, et doivent sortir de ' +
      'COLUMNS_NOT_IN_ROW :\n' + stale.join('\n'),
    ).toHaveLength(0);
  });

  it('chaque raison inscrite dit quelque chose', () => {
    const thin = Object.entries(COLUMNS_NOT_IN_ROW)
      .filter(([, why]) => why.trim().length < 40)
      .map(([key]) => key);
    expect(thin, `Raisons trop courtes :\n${thin.join('\n')}`).toHaveLength(0);
  });
});
