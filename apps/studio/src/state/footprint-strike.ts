import type { EntityCommand } from '@azimut/core-model';
import { buildCommand, codePointCompare } from '@azimut/core-model';
import type { ColumnValue } from '@azimut/core-model';
import type { StoredRow } from './session-store.js';

/**
 * J1.2 (partie J) — « Trait barrant une forme : suppression de la forme »,
 * dans l'atelier des empreintes.
 *
 * La suppression est une commande, annulable d'une frappe (E5.1) : `before`
 * porte la ligne, colonne par colonne, pour que l'annulation la rétablisse.
 *
 * Une empreinte que d'autres lignes citent — volume, destination, et tout ce
 * qui porte son `footprint_id` — n'est pas supprimée. La base les emporterait
 * par ses clés étrangères, et l'annulation ne rétablirait que l'empreinte :
 * c'est la règle de la suppression d'un niveau peuplé, appliquée au barré.
 */
export type StrikeOutcome =
  | { readonly kind: 'deleted'; readonly commands: readonly EntityCommand[] }
  | { readonly kind: 'referenced'; readonly footprintId: string; readonly unitCode: string; readonly dependents: number }
  | { readonly kind: 'refused' };

/** Les colonnes de `footprint` que l'annulation doit rétablir (A5.2). */
const FOOTPRINT_COLUMNS = ['id', 'org_id', 'level_id', 'geometry', 'kind', 'unit_code'] as const;

function column(value: unknown): ColumnValue {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return JSON.stringify(value);
}

/** Les lignes de la session qui citent cette empreinte. */
export function footprintDependents(rows: readonly StoredRow[], footprintId: string): number {
  return rows.filter(r => r.table !== 'footprint' && r.values['footprint_id'] === footprintId).length;
}

export function strikeFootprints(
  rows: readonly StoredRow[],
  footprintIds: readonly string[],
  write: { readonly orgId: string; readonly timestamp: string },
): StrikeOutcome {
  const ids = [...footprintIds].sort(codePointCompare);
  for (const id of ids) {
    const dependents = footprintDependents(rows, id);
    if (dependents > 0) {
      const row = rows.find(r => r.table === 'footprint' && r.id === id);
      const code = row?.values['unit_code'];
      return { kind: 'referenced', footprintId: id, unitCode: typeof code === 'string' ? code : '', dependents };
    }
  }
  const commands: EntityCommand[] = [];
  for (const id of ids) {
    const row = rows.find(r => r.table === 'footprint' && r.id === id);
    if (row === undefined) return { kind: 'refused' };
    const before: Record<string, ColumnValue> = {};
    for (const name of FOOTPRINT_COLUMNS) before[name] = column(name === 'id' ? row.id : row.values[name]);
    const built = buildCommand({
      operation: 'delete', module: '01-socle', table: 'footprint', id,
      org_id: write.orgId, timestamp: write.timestamp, groupKey: `strike:${ids.join(',')}`,
      before,
    });
    if (!built.ok) return { kind: 'refused' };
    commands.push(built.value);
  }
  return { kind: 'deleted', commands };
}
