import { z } from 'zod';
import { characterFault } from './text-input.js';

/**
 * Lot 4 de l'audit (A6.3) : la forme d'une colonne, telle que le catalogue de
 * la base la décrit, et les deux schémas qui en découlent.
 *
 * Une colonne s'écrit en une chaîne courte, que le catalogue déclaré
 * (`input-columns-*.ts`) porte pour chaque table :
 *
 *  - un genre : `uuid`, `text`, `char`, `int`, `num`, `bool`, `date`, `ts`,
 *    `json`, `text[]` ;
 *  - ou une énumération, `=a|b|c`, quand une contrainte de la base restreint
 *    la colonne à une liste de valeurs ;
 *  - précédé de `?` quand la colonne admet `NULL`.
 *
 * Le contrôle `input-catalogue.db.test.ts` confronte cette déclaration au
 * catalogue de la base migrée : une colonne ajoutée, retirée ou retypée sans
 * que la déclaration suive fait échouer les essais.
 */
export const COLUMN_KINDS = ['uuid', 'text', 'char', 'int', 'num', 'bool', 'date', 'ts', 'json', 'text[]'] as const;
export type ColumnKind = (typeof COLUMN_KINDS)[number];

export type ColumnSpec = {
  readonly kind: ColumnKind | 'enum';
  readonly nullable: boolean;
  readonly values: readonly string[];
};

export type TableColumns = Readonly<Record<string, string>>;

export function parseColumnSpec(spec: string): ColumnSpec {
  const nullable = spec.startsWith('?');
  const body = nullable ? spec.slice(1) : spec;
  if (body.startsWith('=')) {
    return { kind: 'enum', nullable, values: body.slice(1).split('|') };
  }
  if (!(COLUMN_KINDS as readonly string[]).includes(body)) {
    throw new Error(`forme de colonne inconnue : ${spec}`);
  }
  return { kind: body as ColumnKind, nullable, values: [] };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const INTEGER = /^-?\d+$/;
const DECIMAL = /^-?\d+(\.\d+)?$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}(:?\d{2})?)?$/;

/** Un texte stocké : caractères admis, forme NFC. Les fins de ligne restent permises. */
const storedText = z.string().check(ctx => {
  const fault = characterFault(ctx.value, true);
  if (fault !== null) ctx.issues.push({ code: 'custom', message: fault, input: ctx.value });
});

/** Toutes les chaînes d'une valeur JSON, clés comprises, passent le même contrôle. */
function jsonStrings(value: unknown, out: string[]): void {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const item of value) jsonStrings(item, out);
  else if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) { out.push(key); jsonStrings(item, out); }
  }
}

const jsonValue = z.unknown().check(ctx => {
  const strings: string[] = [];
  jsonStrings(ctx.value, strings);
  for (const s of strings) {
    const fault = characterFault(s, true);
    if (fault !== null) { ctx.issues.push({ code: 'custom', message: fault, input: s }); return; }
  }
});

/**
 * La valeur d'une colonne relue par l'API : le JSON que PostgREST rend pour ce
 * type. Une valeur inattendue est un refus, jamais une conversion (A6.3).
 */
function readValue(spec: ColumnSpec): z.ZodType {
  const base: z.ZodType = (() => {
    switch (spec.kind) {
      case 'uuid': return z.string().regex(UUID);
      case 'text': case 'char': return storedText;
      // Un `numeric` ou un `bigint` peut arriver en chiffres, pour rester exact
      // au-delà de ce qu'un nombre JavaScript représente ; le lecteur le
      // convertit ensuite, et refuse ce qu'il ne représente pas.
      case 'int': return z.union([z.number().int(), z.string().regex(INTEGER)]);
      case 'num': return z.union([z.number().finite(), z.string().regex(DECIMAL)]);
      case 'bool': return z.boolean();
      case 'date': return z.string().regex(DATE);
      case 'ts': return z.string().regex(TIMESTAMP);
      case 'json': return jsonValue;
      case 'text[]': return z.array(storedText);
      case 'enum': return z.enum(spec.values as [string, ...string[]]);
    }
  })();
  return spec.nullable ? base.nullable() : base;
}

/** Une structure `jsonb` voyageant en JSON : un texte JSON lisible, dont les chaînes passent le contrôle. */
const jsonText = z.string().check(ctx => {
  let parsed: unknown;
  try { parsed = JSON.parse(ctx.value); } catch {
    ctx.issues.push({ code: 'custom', message: 'json', input: ctx.value });
    return;
  }
  const inner = jsonValue.safeParse(parsed);
  const first = inner.success ? undefined : inner.error.issues[0];
  if (first !== undefined) ctx.issues.push({ code: 'custom', message: first.message, input: ctx.value });
});

/**
 * La valeur d'une colonne dans une commande (E5.1). `apply_commands` lit
 * chaque valeur en texte puis la convertit vers le type de la colonne : un
 * nombre peut donc voyager en chiffres, un scalaire JSON en nombre ou en
 * booléen, une structure en texte JSON, une liste dans l'encodage de sa
 * colonne.
 */
function writeValue(spec: ColumnSpec): z.ZodType {
  const base: z.ZodType = (() => {
    switch (spec.kind) {
      // Un identifiant n'est jamais saisi : la base refuse un UUID mal formé, et
      // le mode de démonstration emploie des identifiants lisibles.
      case 'uuid': return storedText.check(ctx => {
        if (ctx.value === '') ctx.issues.push({ code: 'custom', message: 'empty', input: ctx.value });
      });
      case 'json': return z.union([z.number().finite(), z.boolean(), jsonText]);
      case 'text[]': return z.string().regex(/^\{.*\}$/s).pipe(storedText);
      default: return readValue({ ...spec, nullable: false });
    }
  })();
  return spec.nullable ? base.nullable() : base;
}

/**
 * Le schéma strict d'une ligne relue.
 *
 * Avec `columns`, les colonnes choisies (`select=`) sont exigées, et elles
 * seules admises. Sans, chaque colonne de la table est admise et contrôlée,
 * aucune n'est exigée : la ligne vient d'une lecture sans choix de colonnes.
 * Dans les deux cas, une colonne inconnue est un refus.
 */
export function readRowSchema(table: TableColumns, columns?: readonly string[]): z.ZodType {
  const shape: Record<string, z.ZodType> = {};
  for (const name of columns ?? Object.keys(table)) {
    const spec = table[name];
    if (spec === undefined) throw new Error(`colonne inconnue : ${name}`);
    const value = readValue(parseColumnSpec(spec));
    shape[name] = columns === undefined ? value.optional() : value;
  }
  return z.object(shape).strict();
}

/**
 * Le schéma strict des valeurs d'une commande : chaque colonne nommée existe
 * et porte une valeur de son type. Les colonnes sont toutes facultatives, une
 * commande ne nommant que ce qu'elle écrit ; la base tient les obligatoires.
 */
export function writeRowSchema(table: TableColumns): z.ZodType {
  const shape: Record<string, z.ZodType> = {};
  for (const [name, spec] of Object.entries(table)) {
    shape[name] = writeValue(parseColumnSpec(spec)).optional();
  }
  return z.object(shape).strict();
}
