/**
 * Retrait d'un décor d'essai, dans l'ordre de dépendance.
 *
 * A5.11 — « Aucune clé étrangère vers `organization` ou vers `site` ne
 * supprime en cascade. » Un décor d'essai ne se retire donc plus en
 * supprimant son organisation : les tables filles se vident avant les tables
 * mères, faute de quoi la base refuse.
 *
 * L'ordre n'est pas écrit ici. Il se calcule depuis le graphe des clés
 * étrangères du schéma, ce qui le garde juste quand une table s'ajoute — et
 * une table s'ajoute à chaque tranche. Les ex aequo sont départagés par nom,
 * pour que deux exécutions rendent la même suite (A9).
 *
 * **Ce n'est pas la purge de fin de contrat d'O15.** Celle-là relève de la
 * plateforme, anonymise le journal d'audit, vide les tables en insertion seule
 * et délivre une attestation. Cette fonction-ci retire un décor d'essai, et
 * elle s'arrête devant les tables en insertion seule au lieu d'y toucher.
 */

/** Exécute une requête déjà formée. Un pilote quelconque s'y adapte. */
export type SqlRunner = (text: string) => Promise<unknown>;

/** Lit une requête et rend ses lignes. */
export type SqlReader = (text: string) => Promise<ReadonlyArray<Record<string, unknown>>>;

/**
 * A12.3 — les tables en insertion seule. Aucune suppression n'y est possible,
 * pour aucun rôle, et une cascade n'est pas une exception. Le retrait d'un
 * décor les laisse donc intactes et se plaint si elles portent encore des
 * lignes de l'organisation : c'est le comportement qu'O15 attend d'une purge,
 * « une table restée peuplée bloque la purge et se signale ».
 */
const INSERT_ONLY = ['audit_log', 'approval', 'graph_validation'] as const;

const ROOT = 'organization';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Vide, pour les organisations données, toutes les tables portant `org_id`.
 *
 * Rend la suite des tables visitées, dans l'ordre suivi : un essai peut ainsi
 * vérifier l'ordre lui-même plutôt que le supposer.
 */
export async function deleteOrgFixture(
  read: SqlReader,
  run: SqlRunner,
  orgIds: readonly string[],
): Promise<readonly string[]> {
  const ids = orgIds.map(id => {
    if (!UUID.test(id)) throw new Error(`identifiant d'organisation invalide : ${id}`);
    return `'${id}'`;
  }).join(',');
  if (ids === '') return [];

  const scoped = await orgScopedTables(read);
  const order = dependencyOrder(scoped, await foreignKeys(read));
  const toClear = order.filter(table => !isInsertOnly(table));

  await assertInsertOnlyEmpty(read, order, ids);

  // `organization` ne porte pas `org_id` : elle est la racine, et se retire en
  // dernier, une fois que plus rien ne la référence.
  const visited = [...toClear, ROOT];
  const forced = await forcedTables(read, visited);
  for (const table of forced) {
    await run(`alter table azimut.${table} no force row level security`);
  }
  try {
    for (const table of toClear) {
      await run(`delete from azimut.${table} where org_id in (${ids})`);
    }
    await run(`delete from azimut.${ROOT} where id in (${ids})`);
  } finally {
    for (const table of forced) {
      await run(`alter table azimut.${table} force row level security`);
    }
  }
  return visited;
}

function isInsertOnly(table: string): boolean {
  return (INSERT_ONLY as readonly string[]).includes(table);
}

async function assertInsertOnlyEmpty(
  read: SqlReader, order: readonly string[], ids: string,
): Promise<void> {
  for (const table of order) {
    if (!isInsertOnly(table)) continue;
    const rows = await read(
      `select count(*)::int as n from azimut.${table} where org_id in (${ids})`,
    );
    const n = rows[0]?.['n'];
    if (typeof n === 'number' && n > 0) {
      throw new Error(
        `azimut.${table} porte ${n} ligne(s) de ce décor. A12.3 en interdit la `
        + `suppression : seule la purge d'O15 les retire. Le décor doit employer `
        + `une organisation qui lui est propre.`,
      );
    }
  }
}

async function orgScopedTables(read: SqlReader): Promise<readonly string[]> {
  const rows = await read(`
    select table_name from information_schema.columns
    where table_schema = 'azimut' and column_name = 'org_id'
    order by table_name`);
  return rows.map(row => String(row['table_name']));
}

type Edge = { readonly child: string; readonly parent: string };

async function foreignKeys(read: SqlReader): Promise<readonly Edge[]> {
  const rows = await read(`
    select child.relname as child, parent.relname as parent
    from pg_constraint c
    join pg_class child on child.oid = c.conrelid
    join pg_class parent on parent.oid = c.confrelid
    join pg_namespace n on n.oid = child.relnamespace
    where c.contype = 'f' and n.nspname = 'azimut' and c.conrelid <> c.confrelid
    order by child.relname, parent.relname`);
  return rows.map(row => ({
    child: String(row['child']), parent: String(row['parent']),
  }));
}

/**
 * Range les tables de sorte qu'une fille précède sa mère.
 *
 * Tri topologique de Kahn sur le graphe « mère dépend de sa fille ». Une table
 * prise dans un cycle — le schéma n'en porte pas — resterait en fin de liste
 * plutôt que de disparaître silencieusement : la suppression échouerait alors
 * en le disant, ce qui vaut mieux qu'un décor à moitié retiré.
 */
export function dependencyOrder(
  tables: readonly string[], edges: readonly Edge[],
): readonly string[] {
  const inScope = new Set(tables);
  // Qui attend cette table : une mère attend que ses filles soient vidées.
  const waiting = new Map<string, Set<string>>(tables.map(t => [t, new Set()]));
  const pending = new Map<string, number>(tables.map(t => [t, 0]));

  for (const { child, parent } of edges) {
    if (!inScope.has(child) || !inScope.has(parent) || child === parent) continue;
    const set = waiting.get(child);
    if (set === undefined || set.has(parent)) continue;
    set.add(parent);
    pending.set(parent, (pending.get(parent) ?? 0) + 1);
  }

  // Les tables que personne ne référence partent les premières.
  const ready = tables.filter(t => (pending.get(t) ?? 0) === 0).sort();
  const order: string[] = [];
  while (ready.length > 0) {
    const table = ready.shift();
    if (table === undefined) break;
    order.push(table);
    for (const parent of [...(waiting.get(table) ?? [])].sort()) {
      const left = (pending.get(parent) ?? 0) - 1;
      pending.set(parent, left);
      if (left === 0) ready.push(parent);
    }
    ready.sort();
  }
  const seen = new Set(order);
  return [...order, ...tables.filter(t => !seen.has(t)).sort()];
}

async function forcedTables(
  read: SqlReader, tables: readonly string[],
): Promise<readonly string[]> {
  if (tables.length === 0) return [];
  const names = tables.map(t => `'${t}'`).join(',');
  const rows = await read(`
    select c.relname from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'azimut' and c.relforcerowsecurity and c.relname in (${names})
    order by c.relname`);
  return rows.map(row => String(row['relname']));
}
