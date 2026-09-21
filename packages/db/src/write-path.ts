/**
 * Le chemin d'écriture, et il n'y en a qu'un.
 *
 * A2 (module 12) : « L'atelier n'écrit jamais directement en base. Il appelle
 * les commandes du module propriétaire. C'est ce qui empêche la règle de
 * propriété unique d'être contournée par l'interface. »
 *
 * A6.1 : « Le cloisonnement s'applique en base, par politique de sécurité au
 * niveau des lignes, sur toutes les tables portant `org_id`. Jamais dans le
 * code applicatif. » La session pose donc l'identité de l'utilisateur agissant
 * avant toute écriture, et la base décide. Ce fichier ne filtre rien par
 * `org_id` : ce serait précisément le cloisonnement applicatif que A6.1
 * interdit.
 *
 * Vérifié sur une base réelle, note du préalable K4 nº 7 : sans identité posée,
 * rien n'est visible et rien ne s'écrit. Le défaut est fermé.
 */
import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { EntityCommand, Outcome, Finding, ColumnValue } from '@azimut/core-model';
import { changedColumns } from '@azimut/core-model';

/**
 * Ce que le chemin d'écriture attend d'une base : exécuter, et ouvrir une
 * transaction. Rien de plus.
 *
 * Décrire le besoin plutôt que d'importer le type complet de Drizzle rend la
 * fonction indépendante du schéma déclaré côté client, et laisse l'essai lui
 * passer une doublure sans truquer un type.
 */
export type Executor = {
  execute(query: SQL): Promise<unknown>;
};

export type TransactionalDb = Executor & {
  transaction<T>(fn: (tx: Executor) => Promise<T>): Promise<T>;
};

/** L'identité que la session pose avant d'écrire. */
export type WriteSession = {
  /** L'utilisateur agissant, tel que `azimut.current_user_id()` le lira. */
  readonly userId: string;
};

/** Ce qu'une commande appliquée rend à l'appelant. */
export type AppliedCommand = {
  readonly command: EntityCommand;
  /** Les colonnes réellement changées, pour la péremption (W8, partie N). */
  readonly changed: readonly string[];
};

/**
 * Applique une suite de commandes, toutes ou aucune.
 *
 * Une transaction, une identité, et la base tranche. Les commandes d'un même
 * geste arrivent ensemble et s'appliquent ensemble : c'est ce qui permet au
 * regroupement de E5.2 d'avoir un sens côté dépôt comme côté pile.
 */
export async function applyCommands(
  db: TransactionalDb,
  session: WriteSession,
  commands: readonly EntityCommand[],
): Promise<Outcome<readonly AppliedCommand[]>> {
  if (commands.length === 0) {
    return { ok: true, value: [], warnings: [] };
  }

  try {
    const applied = await db.transaction(async (tx) => {
      await setSessionIdentity(tx, session);
      const done: AppliedCommand[] = [];
      for (const command of commands) {
        await applyOne(tx, command);
        done.push({ command, changed: changedColumns(command) });
      }
      return done;
    });
    return { ok: true, value: applied, warnings: [] };
  } catch (error: unknown) {
    return { ok: false, findings: [writeFailure(commands, error)] };
  }
}

/**
 * Pose l'identité de l'utilisateur agissant pour la transaction en cours.
 *
 * `set_config(..., true)` est local à la transaction : l'identité ne fuit pas
 * d'une transaction à la suivante sur une connexion mutualisée, ce qui serait
 * le moyen le plus discret de franchir la frontière d'organisation.
 */
async function setSessionIdentity(
  tx: Executor,
  session: WriteSession,
): Promise<void> {
  // `set local role` vaut pour la transaction seule. Les politiques sont
  // toutes adressées à `authenticated` : une écriture exécutée sous un autre
  // rôle n'aurait aucune politique et, selon le rôle, écrirait tout ou rien.
  // Le prendre ici, plutôt que de le supposer posé par la connexion, garantit
  // qu'aucune écriture ne passe hors du rôle cloisonné.
  await tx.execute(sql`set local role authenticated`);
  await tx.execute(
    sql`select set_config('azimut.current_user_id', ${session.userId}, true)`,
  );
}

async function applyOne(tx: Executor, command: EntityCommand): Promise<void> {
  const table = qualifiedTable(command.table);

  if (command.operation === 'create') {
    const row = command.after ?? {};
    const names = Object.keys(row).sort();
    await tx.execute(sql`
      insert into ${table} (${columnList(names)})
      values (${valueList(names.map(n => row[n] ?? null))})
    `);
    return;
  }

  if (command.operation === 'delete') {
    await tx.execute(sql`delete from ${table} where id = ${command.id}`);
    return;
  }

  const changed = changedColumns(command);
  if (changed.length === 0) return;
  const after = command.after ?? {};
  await tx.execute(sql`
    update ${table}
    set ${assignments(changed, changed.map(n => after[n] ?? null))}
    where id = ${command.id}
  `);
}

/**
 * Le nom qualifié d'une table, en deux identifiants et non en un.
 *
 * `sql.identifier('azimut.site')` citerait le tout comme un seul nom, et
 * viserait une table appelée « azimut.site ». Le schéma et la table sont donc
 * cités séparément.
 *
 * Le nom est aussi revalidé ici. `buildCommand` l'a déjà contrôlé contre la
 * propriété du module (R1, partie L), mais le chemin d'écriture ne suppose pas
 * que son appelant soit passé par là : c'est la seule voie vers la base, elle
 * ne fait confiance à personne.
 */
const TABLE_NAME = /^[a-z][a-z0-9_]*$/;

function qualifiedTable(table: string) {
  if (!TABLE_NAME.test(table)) {
    throw new Error(`nom de table refusé : ${JSON.stringify(table)}`);
  }
  return sql`${sql.identifier('azimut')}.${sql.identifier(table)}`;
}

function columnList(names: readonly string[]) {
  return sql.join(names.map(n => sql.identifier(n)), sql`, `);
}

function valueList(values: readonly ColumnValue[]) {
  return sql.join(values.map(v => sql`${v}`), sql`, `);
}

function assignments(names: readonly string[], values: readonly ColumnValue[]) {
  return sql.join(
    names.map((n, i) => sql`${sql.identifier(n)} = ${values[i] ?? null}`),
    sql`, `,
  );
}

/**
 * Un refus de la base est rendu tel quel, sans être interprété.
 *
 * Une politique qui refuse une écriture hors organisation lève une erreur que
 * l'application n'a pas à traduire en « introuvable » ni en « interdit » : A6.1
 * demande qu'aucune ligne d'une autre organisation ne soit détectable, y
 * compris par message d'erreur. Le message de la base reste donc hors du
 * `Finding`, et seul le nombre de commandes refusées y figure.
 */
function writeFailure(commands: readonly EntityCommand[], error: unknown): Finding {
  const first = commands[0];
  return {
    code: 'EDIT.WRITE_REFUSED',
    severity: 'blocking',
    entity: first !== undefined ? { kind: 'command', id: first.id } : null,
    params: {
      commands: commands.length,
      recognised: error instanceof Error ? 1 : 0,
    },
    ruleRef: 'A6.1',
  };
}
