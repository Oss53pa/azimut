/**
 * S6.8, décision Q3 d'Oss53pa — « La pile d'annulation est conservée.
 * Annuler émet la commande inverse, propagée comme les autres ; si l'objet a
 * changé ailleurs, c'est un conflit présenté par S6.3. »
 *
 * La base juge : elle compare chaque colonne de `before` dans le type de la
 * colonne (0078) et refuse en 409. Ce module ne décide rien ; il dit, après
 * le refus et sur le site relu, quel objet a changé et en quoi, en rejouant
 * les commandes refusées par le moteur S6.3 (`applyRemoteCommand`).
 *
 * Les deux côtés ne s'écrivent pas pareil : une commande porte des textes
 * (`"1.4"`, `'{"x_m":0,"y_m":0}'`, un horodatage en `Z`), le site relu des
 * nombres, des objets et des horodatages en `+00:00`. Comparés tels quels,
 * tout différerait. Chaque valeur est donc ramenée à une forme commune avant
 * d'entrer dans S6.3, comme la base les ramène au type de la colonne. Cette
 * forme ne sert qu'à situer le conflit, jamais à écrire.
 *
 * Pur : ni horloge, ni réseau, ni tirage (A9).
 */
import { applyRemoteCommand } from '@azimut/core-model';
import type {
  ColumnValue, ConflictReason, EntityCommand, RowStore, RowValues,
} from '@azimut/core-model';
import type { SessionState } from './session-store.js';

export type UndoSide = 'undo' | 'redo';

/** Ce que la présentation montre d'une colonne : les deux versions. */
export type ConflictColumn = {
  readonly column: string;
  /** La valeur que porte le site relu. */
  readonly current: unknown;
  /** Celle que l'annulation, ou le rétablissement, aurait écrite. */
  readonly wanted: unknown;
};

export type UndoConflict = {
  readonly side: UndoSide;
  /**
   * `unlocated` : la base a refusé, mais le site relu ne dit pas où. Une
   * ligne liée écrite ailleurs (clé étrangère), ou un site qui n'a pas pu
   * être relu.
   */
  readonly reason: ConflictReason | 'unlocated';
  readonly table: string | null;
  readonly id: string | null;
  readonly columns: readonly ConflictColumn[];
};

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}(:?\d{2})?)$/;

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, inner]) => `${JSON.stringify(key)}:${canonicalJson(inner)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** La forme commune d'une valeur, de commande ou de site relu. */
export function comparable(value: unknown): ColumnValue {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return canonicalJson(value);
  if (ISO_INSTANT.test(value)) {
    const instant = Date.parse(value);
    if (!Number.isNaN(instant)) return `instant:${instant}`;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'string') return canonicalJson(parsed);
  } catch {
    // Un texte ordinaire reste lui-même.
  }
  return value;
}

function comparableRow(values: Readonly<Record<string, unknown>> | null): RowValues | null {
  if (values === null) return null;
  const row: Record<string, ColumnValue> = {};
  for (const [column, value] of Object.entries(values)) row[column] = comparable(value);
  return row;
}

function storeOf(state: SessionState, orgId: string): RowStore {
  const tables = new Map<string, Map<string, RowValues>>();
  for (const row of state.rows) {
    const rows = tables.get(row.table) ?? new Map<string, RowValues>();
    rows.set(row.id, comparableRow(row.values) ?? {});
    tables.set(row.table, rows);
  }
  return { org_id: orgId, tables };
}

function rawRow(state: SessionState, table: string, id: string): Readonly<Record<string, unknown>> | null {
  return state.rows.find(r => r.table === table && r.id === id)?.values ?? null;
}

const UNLOCATED = (side: UndoSide): UndoConflict =>
  ({ side, reason: 'unlocated', table: null, id: null, columns: [] });

/**
 * Le premier conflit des commandes refusées, rejouées dans leur ordre sur le
 * site relu. `unlocated` si toutes s'y appliquent.
 */
export function locateConflict(
  state: SessionState,
  side: UndoSide,
  refused: readonly EntityCommand[],
): UndoConflict {
  const first = refused[0];
  if (first === undefined) return UNLOCATED(side);
  let store = storeOf(state, first.org_id);
  for (const command of refused) {
    const outcome = applyRemoteCommand(store, {
      ...command,
      before: comparableRow(command.before),
      after: comparableRow(command.after),
    });
    if (!outcome.ok) return UNLOCATED(side);
    if (outcome.value.kind === 'applied') { store = outcome.value.store; continue; }
    const current = rawRow(state, command.table, command.id);
    const names = outcome.value.reason === 'row_changed'
      ? outcome.value.columns
      : Object.keys(command.after ?? command.before ?? {}).sort();
    return {
      side,
      reason: outcome.value.reason,
      table: command.table,
      id: command.id,
      columns: names.map(column => ({
        column,
        current: current?.[column] ?? null,
        wanted: command.after?.[column] ?? null,
      })),
    };
  }
  return UNLOCATED(side);
}

/** Le refus que la base a rendu dit-il un objet changé ailleurs ? */
export function isStaleRefusal(findings: readonly { readonly params: Readonly<Record<string, unknown>> }[]): boolean {
  return findings.some(f => f.params['cause'] === '409');
}
