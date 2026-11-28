import type postgres from 'postgres';
import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

/**
 * Le rôle de décor du banc d'essai — question 6 de la matrice, décision
 * d'Oss53pa du 28 novembre 2026.
 *
 * Un décor d'essai (organisation, premier membre, lignes de départ, retrait)
 * s'écrit hors du cloisonnement : aucun membre n'existe encore pour l'écrire,
 * et un retrait vide plusieurs organisations. Le décor levait pour cela
 * `FORCE ROW LEVEL SECURITY` sous le rôle propriétaire. Le schéma changeait
 * alors de posture pour toutes les suites qui tournaient en même temps.
 *
 * Il bascule désormais, le temps d'une instruction, vers `azimut_fixture` :
 * un rôle `BYPASSRLS` sans aucun droit de structure, que le montage du banc
 * crée (`scripts/role-decor.sh`) et qu'aucune migration ne crée. Il n'existe
 * dans aucune installation de production ; un banc qui ne l'a pas monté
 * échoue à la première bascule, au lieu de poser un décor autrement.
 *
 * La bascule est `SET LOCAL` : elle ne survit ni à la transaction, ni à un
 * point de reprise annulé, et ne laisse jamais une connexion de la réserve
 * sous le rôle de décor. Ce n'est pas un parcours applicatif ; rien hors des
 * essais ne l'appelle.
 */
export const FIXTURE_ROLE = 'azimut_fixture';

const SWITCH = `set local role ${FIXTURE_ROLE}`;
const BACK = 'reset role';

/**
 * Une ou plusieurs instructions de décor, sous le rôle de décor, en une seule
 * chaîne. Hors transaction, la chaîne forme une transaction implicite : un
 * échec au milieu annule tout, bascule comprise. Dans une transaction, le
 * retour au rôle propriétaire est explicite.
 *
 * Les instructions sont formées par l'appelant, sans valeur saisie : seuls
 * des identifiants vérifiés y entrent.
 */
export function asFixture(statements: string): string {
  return `${SWITCH}; ${statements}; ${BACK}`;
}

/** Un décor sous le rôle de décor, dans une transaction à lui. */
export async function withFixtureRole<T>(
  client: postgres.Sql,
  work: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  const out = await client.begin(async tx => {
    await tx.unsafe(SWITCH);
    return work(tx);
  });
  return out as T;
}

/**
 * Un décor sous le rôle de décor, dans la transaction de l'essai : le décor
 * s'annule avec elle. Le rôle propriétaire revient à la sortie ; si le décor
 * échoue, la transaction est perdue et la bascule avec elle.
 */
export async function inFixtureRole<T>(
  tx: postgres.TransactionSql,
  work: () => Promise<T>,
): Promise<T> {
  await tx.unsafe(SWITCH);
  const out = await work();
  await tx.unsafe(BACK);
  return out;
}

/**
 * Un décor écrit et lu dans une transaction toujours annulée, sous le rôle de
 * décor : ce que `work` rend est rendu, rien de ce qu'il a écrit ne reste.
 */
export async function inRolledBackFixture<T>(
  db: PostgresJsDatabase,
  work: (tx: Parameters<Parameters<PostgresJsDatabase['transaction']>[0]>[0]) => Promise<T>,
): Promise<T> {
  const rolledBack = new Error('annulation voulue');
  let out: { readonly value: T } | null = null;
  await db.transaction(async tx => {
    await tx.execute(sql.raw(SWITCH));
    out = { value: await work(tx) };
    throw rolledBack;
  }).catch((e: unknown) => { if (e !== rolledBack) throw e; });
  if (out === null) throw new Error('décor annulé sans résultat');
  return (out as { readonly value: T }).value;
}
