import type { z } from 'zod';
import type { RowValues } from '../row-values.js';
import { writeRowSchema } from './column-spec.js';
import { tableColumns } from './input-columns.js';
import { FIELD_BOUNDS } from './field-bounds.js';
import type { BoundedField } from './field-bounds.js';
import { textFault } from './text-input.js';

/**
 * Lot 4 de l'audit (A6.3) : ce que les valeurs d'une commande doivent être.
 *
 * Chaque colonne nommée existe dans la table, et porte une valeur de son type,
 * de son format et, pour une énumération, de sa liste (`writeRowSchema`, un
 * schéma `.strict()`). Un texte n'a ni caractère de contrôle, ni forçage de
 * direction, et il est sous forme NFC. Les champs que le cahier borne le sont.
 *
 * Rend les défauts sous la forme `{ column, fault }` ; `buildCommand` en fait
 * des anomalies `EDIT.COMMAND_SHAPE_INVALID`. La base tient les mêmes règles
 * (0082) : ce contrôle-ci sert l'ergonomie, celui de la base la sécurité.
 */
export type ValueFault = { readonly column: string; readonly fault: string };

const schemas = new Map<string, z.ZodType>();

function schemaFor(table: string): z.ZodType | undefined {
  const cached = schemas.get(table);
  if (cached !== undefined) return cached;
  const columns = tableColumns(table);
  if (columns === undefined) return undefined;
  const schema = writeRowSchema(columns);
  schemas.set(table, schema);
  return schema;
}

function isBounded(key: string): key is BoundedField {
  return Object.prototype.hasOwnProperty.call(FIELD_BOUNDS, key);
}

/**
 * Le motif d'un refus. Une union (un nombre, ou un texte JSON) rend
 * `invalid_union` ; le motif utile est celui que la branche texte a donné.
 */
function faultOf(issue: z.core.$ZodIssue): string {
  if (issue.code === 'custom') return issue.message;
  if (issue.code === 'invalid_union') {
    for (const branch of issue.errors) {
      const custom = branch.find(i => i.code === 'custom');
      if (custom !== undefined) return custom.message;
    }
  }
  return issue.code;
}

export function commandValueFaults(table: string, after: RowValues | null): readonly ValueFault[] {
  if (after === null) return [];
  const schema = schemaFor(table);
  if (schema === undefined) return [{ column: '*', fault: 'unknown_table' }];
  const faults: ValueFault[] = [];
  const parsed = schema.safeParse(after);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      if (issue.code === 'unrecognized_keys') {
        for (const key of issue.keys) faults.push({ column: key, fault: 'unknown_column' });
      } else {
        faults.push({ column: String(issue.path[0] ?? '*'), fault: faultOf(issue) });
      }
    }
  }
  for (const [column, value] of Object.entries(after)) {
    const key = `${table}.${column}`;
    if (!isBounded(key) || typeof value !== 'string') continue;
    const fault = textFault(value, FIELD_BOUNDS[key]);
    if (fault !== null) faults.push({ column, fault });
  }
  return faults;
}
