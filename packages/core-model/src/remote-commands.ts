/**
 * S6.3 — appliquer une commande venue d'un autre poste.
 *
 * S-19 propage des commandes validées ; L4.4 pose « une concurrence optimiste
 * au niveau de l'objet » et veut que « les conflits réels [soient] arbitrés
 * par l'utilisateur avec les deux versions présentées ». Ce moteur en est la
 * part calculable : il applique, ou il constate un conflit. Il ne fusionne
 * jamais.
 *
 * Un conflit n'est pas une anomalie. La commande est bien formée — sa
 * construction l'a vérifié — mais l'objet n'est plus dans l'état sur lequel
 * elle a été validée. Le moteur rend alors un résultat de conflit, état
 * inchangé, qui porte l'état courant et la commande : les deux versions que
 * l'arbitrage présentera. Seule une commande d'une autre organisation est
 * refusée, et c'est le cloisonnement qui la refuse (A6.1).
 *
 * L'état `before` d'une commande sert de condition : chaque colonne qu'il
 * nomme doit avoir, dans l'état courant, la valeur qu'il lui donne. Aucune
 * colonne de version n'est nécessaire.
 *
 * Pur : ni horloge, ni base, ni réseau, ni tirage. Deux postes qui appliquent
 * les mêmes commandes dans le même ordre au même état obtiennent le même état
 * (A9). Les lignes sont rangées dans des `Map` : un identifiant reçu, même
 * `__proto__`, n'y est qu'une clé.
 */
import type { EntityCommand } from './site-commands.js';
import type { RowValues } from './row-values.js';
import type { Outcome } from './outcome.js';

/** Les lignes d'une organisation, par table puis par identifiant. */
export type RowStore = {
  readonly org_id: string;
  readonly tables: ReadonlyMap<string, ReadonlyMap<string, RowValues>>;
};

export function emptyRowStore(org_id: string): RowStore {
  return { org_id, tables: new Map() };
}

/** La ligne courante, ou null si elle n'existe pas. */
export function rowOf(store: RowStore, table: string, id: string): RowValues | null {
  return store.tables.get(table)?.get(id) ?? null;
}

/** Pourquoi la commande ne s'applique pas à l'état courant. */
export type ConflictReason =
  /** Création d'une ligne qui existe déjà. */
  | 'row_exists'
  /** Modification ou suppression d'une ligne qui n'existe plus. */
  | 'row_missing'
  /** Une colonne de `before` n'a plus la valeur que la commande attend. */
  | 'row_changed';

export type RemoteApplication =
  | { readonly kind: 'applied'; readonly store: RowStore }
  | {
    readonly kind: 'conflict';
    /** L'état d'entrée, inchangé. */
    readonly store: RowStore;
    readonly reason: ConflictReason;
    /** Les colonnes en désaccord, triées ; vide hors `row_changed`. */
    readonly columns: readonly string[];
    /** La version courante de la ligne, première des deux versions. */
    readonly current: RowValues | null;
    /** La commande reçue, seconde version. */
    readonly command: EntityCommand;
  };

/**
 * Applique une commande reçue.
 *
 * Création : la ligne ne doit pas exister. Modification : elle doit exister
 * et s'accorder avec `before` ; les colonnes de `after` remplacent les
 * siennes, les autres restent. Suppression : elle doit exister et s'accorder
 * avec `before`.
 */
export function applyRemoteCommand(
  store: RowStore,
  command: EntityCommand,
): Outcome<RemoteApplication> {
  if (command.org_id !== store.org_id) {
    return {
      ok: false,
      findings: [{
        code: 'EDIT.WRITE_REFUSED',
        severity: 'blocking',
        entity: { kind: 'command', id: command.id },
        params: { table: command.table, fault: 'other_organisation' },
        ruleRef: 'A6.1',
      }],
    };
  }

  const current = rowOf(store, command.table, command.id);
  const conflict = (reason: ConflictReason, columns: readonly string[] = []) =>
    applied({ kind: 'conflict', store, reason, columns, current, command });

  if (command.operation === 'create') {
    if (current !== null) return conflict('row_exists');
    return applied({ kind: 'applied', store: withRow(store, command, command.after) });
  }

  if (current === null) return conflict('row_missing');
  const changed = disagreeingColumns(current, command.before);
  if (changed.length > 0) return conflict('row_changed', changed);

  const next = command.operation === 'delete' ? null : { ...current, ...command.after };
  return applied({ kind: 'applied', store: withRow(store, command, next) });
}

function applied(value: RemoteApplication): Outcome<RemoteApplication> {
  return { ok: true, value, warnings: [] };
}

/**
 * Les colonnes que `before` nomme et dont la valeur courante diffère. Une
 * colonne absente de la ligne courante vaut une valeur différente : la
 * commande attendait quelque chose qui n'est plus là.
 */
function disagreeingColumns(current: RowValues, before: RowValues | null): readonly string[] {
  if (before === null) return [];
  return Object.keys(before)
    .filter(column => !Object.prototype.hasOwnProperty.call(current, column)
      || current[column] !== before[column])
    .sort();
}

/** Une copie de l'état où la ligne visée vaut `row`, ou disparaît si null. */
function withRow(store: RowStore, command: EntityCommand, row: RowValues | null): RowStore {
  const rows = new Map(store.tables.get(command.table) ?? []);
  if (row === null) rows.delete(command.id);
  else rows.set(command.id, row);

  const tables = new Map(store.tables);
  tables.set(command.table, rows);
  return { org_id: store.org_id, tables };
}
