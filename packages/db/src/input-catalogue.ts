/**
 * Lot 4 de l'audit (A6.3) : la forme des colonnes, lue sur la base migrée.
 *
 * Rend, pour chaque table du schéma, la forme de chaque colonne dans la
 * notation de `@azimut/core-model` (`column-spec.ts`) : son genre, `?` quand
 * elle admet `NULL`, et la liste des valeurs quand une contrainte d'une seule
 * colonne la restreint par `= ANY (ARRAY[...])`. C'est ce que le catalogue
 * déclaré du modèle doit reproduire à l'identique.
 */
import type { SqlReader } from './fixture-cleanup.js';

const COLUMNS = `
  select c.relname as table_name, a.attname as column_name, a.attnum,
         format_type(a.atttypid, a.atttypmod) as type, not a.attnotnull as nullable
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'azimut' and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped
    and c.relname not like '\\_%'
  order by c.relname, a.attnum`;

const ENUM_CHECKS = `
  select c.relname as table_name, a.attname as column_name, pg_get_constraintdef(k.oid) as def
  from pg_constraint k
  join pg_class c on c.oid = k.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum = k.conkey[1]
  where n.nspname = 'azimut' and k.contype = 'c' and cardinality(k.conkey) = 1
  order by c.relname, a.attname, k.conname`;

const KINDS: Readonly<Record<string, string>> = {
  'uuid': 'uuid',
  'text': 'text',
  'character(2)': 'char',
  'character(3)': 'char',
  'integer': 'int',
  'bigint': 'int',
  'smallint': 'int',
  'numeric': 'num',
  'boolean': 'bool',
  'date': 'date',
  'timestamp with time zone': 'ts',
  'timestamp without time zone': 'ts',
  'jsonb': 'json',
  'text[]': 'text[]',
};

/** `CHECK ((col = ANY (ARRAY['a'::text, 'b'::text])))`, et cette forme seule. */
function enumValues(column: string, def: string): readonly string[] | null {
  const m = /^CHECK \(\((\w+) = ANY \(ARRAY\[(.*)\]\)\)\)$/.exec(def);
  if (m === null || m[1] !== column) return null;
  const values: string[] = [];
  for (const item of (m[2] ?? '').split(', ')) {
    const v = /^'([^']*)'::text$/.exec(item);
    if (v === null) return null;
    values.push(v[1] ?? '');
  }
  return values;
}

/**
 * Les tables du schéma sans la garde de 0082 (`guard_input`). `audit_log` en
 * est exceptée : elle recopie des lignes déjà gardées, et le lot 9 la traite.
 */
const GUARD_GAPS = `
  select c.relname as gap from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'azimut' and c.relkind = 'r'
    and c.relname not like '\\_%' and c.relname <> 'audit_log'
    and not exists (select 1 from pg_trigger g where g.tgrelid = c.oid and g.tgname = 'guard_input'
                    and not g.tgisinternal and g.tgenabled <> 'D')
  order by 1`;

export async function inputGuardGaps(read: SqlReader): Promise<readonly string[]> {
  return (await read(GUARD_GAPS)).map(row => String(row['gap']));
}

export type DeclaredColumns = Readonly<Record<string, Readonly<Record<string, string>>>>;

export async function inputCatalogue(read: SqlReader): Promise<DeclaredColumns> {
  const enums = new Map<string, readonly string[]>();
  for (const row of await read(ENUM_CHECKS)) {
    const key = `${String(row['table_name'])}.${String(row['column_name'])}`;
    const values = enumValues(String(row['column_name']), String(row['def']));
    if (values !== null && !enums.has(key)) enums.set(key, values);
  }
  const out: Record<string, Record<string, string>> = {};
  for (const row of await read(COLUMNS)) {
    const table = String(row['table_name']);
    const column = String(row['column_name']);
    const type = String(row['type']);
    const kind = KINDS[type];
    if (kind === undefined) throw new Error(`${table}.${column} : type sans forme déclarée (${type})`);
    const values = enums.get(`${table}.${column}`);
    const body = values !== undefined && kind === 'text' ? `=${values.join('|')}` : kind;
    (out[table] ??= {})[column] = `${row['nullable'] === true ? '?' : ''}${body}`;
  }
  return out;
}

/** Le texte des fichiers déclarés, pour régénérer la déclaration après une migration. */
export function declarationFiles(catalogue: DeclaredColumns, perFile: number): readonly string[] {
  const tables = Object.keys(catalogue).sort();
  const files: string[] = [];
  for (let i = 0; i < tables.length; i += perFile) {
    const n = String(files.length + 1).padStart(2, '0');
    const lines = tables.slice(i, i + perFile).map(t => {
      const cols = Object.entries(catalogue[t] ?? {}).map(([c, s]) => `${c}: '${s}'`).join(', ');
      return `  ${t}: { ${cols} },`;
    });
    files.push([
      `// Lot 4 de l'audit (A6.3) : catalogue des colonnes, partie ${n}.`,
      '// Reproduit le catalogue de la base migrée ; `input-catalogue.db.test.ts`',
      '// le vérifie et sait le réécrire (AZIMUT_WRITE_INPUT_CATALOGUE).',
      `import type { TableColumns } from './column-spec.js';`,
      '',
      `export const INPUT_COLUMNS_${n}: Readonly<Record<string, TableColumns>> = {`,
      ...lines,
      '};',
      '',
    ].join('\n'));
  }
  return files;
}
