import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { FIXTURE_ROLE, withFixtureRole } from '../fixture-role.js';

/**
 * A5.3 et A12.3 — `graph_validation`, insertion seule, sur une base réelle.
 *
 * « Toute tentative de modification ou de suppression échoue au niveau de la
 * base. » Un essai sur le texte des migrations dirait que les barrages sont
 * écrits ; seul un essai sur une base dit qu'ils tiennent. C'est ce que celui-
 * ci fait, et sous le rôle de décor du banc (`fixture-role.ts`) : il passe
 * outre le cloisonnement et porte tous les droits de données, ce qui en fait
 * le rôle le plus dangereux pour les lignes, pas le moins.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];
const ORG = 'a5300000-0000-0000-0000-0000000000a1';
const SITE = 'a5300000-0000-0000-0000-0000000000b1';

let client: postgres.Sql;
let db: ReturnType<typeof drizzle>;

beforeAll(async () => {
  if (URL === undefined || URL === '') {
    throw new Error(
      'AZIMUT_TEST_DATABASE_URL absente. Voir packages/db/migrations/ORDRE.md.',
    );
  }
  client = postgres(URL);
  db = drizzle(client);

  // L'amorçage ne supprime rien et se rejoue : un passage de validation ne se
  // supprime pas, et son organisation ne se supprime donc pas non plus. Voir
  // le dernier essai de ce fichier, qui en fait un constat plutôt qu'un
  // obstacle. Le décor s'écrit sous le rôle de décor du banc, comme un import
  // d'administration, sans que le schéma change de posture.
  await withFixtureRole(client, async tx => {
    await tx`insert into azimut.organization(id,name,slug) values (${ORG},'GV','gv-a53')
             on conflict (id) do nothing`;
    await tx`insert into azimut.site(id,org_id,name,country_code,timezone)
             values (${SITE},${ORG},'Site de validation','FR','Europe/Paris')
             on conflict (id) do nothing`;
  });
});

afterAll(async () => { await client.end(); });

type Exec = Pick<typeof db, 'execute'>;

/**
 * Sous le rôle de décor, dans une transaction à lui. Une instruction refusée
 * s'y éprouve dans un point de reprise (`refused`), pour que la transaction
 * survive au refus.
 */
async function asFixture<T>(run: (tx: Exec & Pick<typeof db, 'transaction'>) => Promise<T>): Promise<T> {
  return db.transaction(async tx => {
    await tx.execute(sql.raw(`set local role ${FIXTURE_ROLE}`));
    return run(tx);
  });
}

async function insertRun(on: Exec, hash: string, passed: boolean, blocking: number): Promise<void> {
  await on.execute(sql`
    insert into azimut.graph_validation
      (org_id, site_id, graph_hash, ran_at, passed, blocking_count, warning_count)
    values (${ORG}, ${SITE}, ${hash}, now(), ${passed}, ${blocking}, 0)`);
}

/** La suite se rejoue : les empreintes portent le numéro de l'exécution. */
const RUN = Date.now().toString(36);

/**
 * Le motif du refus, tel que la base le donne.
 *
 * Le pilote enveloppe l'erreur de PostgreSQL dans une erreur « Failed query »
 * dont le message ne porte pas le motif. Vérifier qu'une requête échoue ne
 * suffit pas ici : il faut vérifier **pourquoi**, sans quoi un refus de
 * contrainte étrangère passerait pour un refus d'insertion seule.
 */
async function refusalOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error: unknown) {
    const messages: string[] = [];
    let current: unknown = error;
    for (let depth = 0; depth < 5 && current instanceof Error; depth += 1) {
      messages.push(current.message);
      current = current.cause;
    }
    return messages.join(' | ');
  }
  throw new Error('la requête a réussi alors qu’elle devait être refusée');
}

describe('A5.3 — un passage de validation s’enregistre', () => {
  it('accepte un passage réussi', async () => {
    await asFixture(async tx => {
      await insertRun(tx, `sha256:aaa-${RUN}`, true, 0);
      const rows = await tx.execute(sql`
        select graph_hash from azimut.graph_validation where site_id = ${SITE}`);
      expect(rows.length).toBeGreaterThan(0);
    });
  });

  it('accepte un passage échoué, avec ses anomalies comptées', async () => {
    await asFixture(async tx => {
      const hash = `sha256:bbb-${RUN}`;
      await insertRun(tx, hash, false, 3);
      const rows = await tx.execute(sql`
        select blocking_count from azimut.graph_validation
        where site_id = ${SITE} and graph_hash = ${hash}`);
      expect(rows[0]?.['blocking_count']).toBe(3);
    });
  });

  /**
   * Laisser `passed` et `blocking_count` diverger permettrait d'enregistrer un
   * échec sans motif, ou une réussite démentie par ses propres anomalies.
   */
  it('refuse un passage réussi qui compte des anomalies bloquantes', async () => {
    await asFixture(async tx => {
      await expect(tx.transaction(sp => insertRun(sp, `sha256:ccc-${RUN}`, true, 2))).rejects.toThrow();
    });
  });

  it('refuse un passage échoué sans anomalie bloquante', async () => {
    await asFixture(async tx => {
      await expect(tx.transaction(sp => insertRun(sp, `sha256:ddd-${RUN}`, false, 0))).rejects.toThrow();
    });
  });
});

/**
 * Les barrages de modification et de suppression sont des déclencheurs par
 * ligne : ils ne répondent qu'à un rôle qui voit les lignes et détient le
 * droit. A12.3 interdit ce droit à tout rôle autre que le propriétaire, et le
 * propriétaire ne voit aucune ligne sous `FORCE ROW LEVEL SECURITY`.
 *
 * Le droit est donc accordé au rôle de décor dans une transaction toujours
 * annulée : aucune autre session ne le voit jamais, et rien n'en reste. Le
 * motif du refus est lu avant l'annulation.
 */
async function withRowRights(run: (on: Exec) => Promise<string>): Promise<string> {
  const rolledBack = new Error('annulation voulue');
  let motif = '';
  await db.transaction(async tx => {
    await tx.execute(sql.raw(`grant update, delete on azimut.graph_validation to ${FIXTURE_ROLE}`));
    await tx.execute(sql.raw(`set local role ${FIXTURE_ROLE}`));
    motif = await run(tx);
    throw rolledBack;
  }).catch((e: unknown) => { if (e !== rolledBack) throw e; });
  return motif;
}

/**
 * A12.3 — l'insertion seule, éprouvée sous le rôle de décor du banc. C'est le
 * rôle qui contourne les politiques et porte tous les droits de données ; si
 * les barrages tiennent sous lui, ils tiennent sous les autres.
 */
describe('A12.3 — graph_validation est en insertion seule', () => {
  it('refuse la modification', async () => {
    const motif = await withRowRights(on => refusalOf(() => on.execute(sql`
      update azimut.graph_validation set passed = false where site_id = ${SITE}`)));
    expect(motif).toMatch(/insert-only/);
  });

  it('refuse la suppression', async () => {
    const motif = await withRowRights(on => refusalOf(() => on.execute(sql`
      delete from azimut.graph_validation where site_id = ${SITE}`)));
    expect(motif).toMatch(/insert-only/);
  });

  /**
   * TRUNCATE ne déclenche aucun déclencheur par ligne. Sans déclencheur
   * d'instruction, la table se viderait — c'est ce qui s'était produit sur
   * `approval` avant que le barrage ne soit posé.
   *
   * Sous le rôle propriétaire : TRUNCATE ignore le cloisonnement, et seul le
   * propriétaire en porte le droit. C'est le déclencheur qui doit répondre.
   */
  it('refuse le vidage', async () => {
    const motif = await refusalOf(
      () => db.execute(sql`truncate azimut.graph_validation`));
    expect(motif).toMatch(/cannot be truncated/);
  });

  /**
   * Un déclencheur se désarme. Les droits, non : le rôle applicatif n'a ni
   * modification ni suppression sur cette table. Les deux barrages sont
   * voulus, l'un ne remplace pas l'autre.
   */
  it('n’accorde au rôle applicatif ni modification ni suppression', async () => {
    const rows = await db.execute(sql`
      select privilege_type from information_schema.role_table_grants
      where table_schema = 'azimut' and table_name = 'graph_validation'
        and grantee = 'authenticated'`);
    const granted = rows.map(r => String(r['privilege_type'])).sort();
    expect(granted).toEqual(['INSERT', 'SELECT']);
  });

  /** A6.1 : la politique existe, elle est forcée, et elle n'est pas FOR ALL. */
  it('porte deux politiques distinctes, en lecture et en insertion', async () => {
    const rows = await db.execute(sql`
      select cmd from pg_policies
      where schemaname = 'azimut' and tablename = 'graph_validation'`);
    expect(rows.map(r => String(r['cmd'])).sort()).toEqual(['INSERT', 'SELECT']);

    const forced = await db.execute(sql`
      select relforcerowsecurity from pg_class
      where oid = 'azimut.graph_validation'::regclass`);
    expect(forced[0]?.['relforcerowsecurity']).toBe(true);
  });

  /**
   * A5.11, version 7 — la clé étrangère refuse la suppression du parent.
   *
   * La table a d'abord porté `ON DELETE CASCADE` vers `site` et vers
   * `organization`, ce qui opposait A5.3 à l'insertion seule d'A12.3 : la
   * cascade est une suppression, le déclencheur la refusait, et le refus
   * paraissait venir de la table fille pour une raison que la clé ne disait
   * pas. A5.11 tranche — aucune cascade vers `organization` ni vers `site`,
   * et les tables en insertion seule refusent la suppression de leur parent.
   *
   * L'essai vérifie donc d'où vient le refus, et pas seulement qu'il a lieu :
   * c'est la clé qui parle, avant que le déclencheur n'ait à le faire. La
   * suppression reste possible par la seule voie qu'A12.3 nomme, la purge de
   * fin de contrat d'O15, qui vide les tables dans l'ordre de dépendance.
   */
  it('refuse la suppression de son site, par la clé étrangère', async () => {
    const motif = await asFixture(tx => refusalOf(
      () => tx.transaction(sp => sp.execute(sql`delete from azimut.site where id = ${SITE}`))));
    expect(motif).toMatch(/graph_validation_site_id_fkey/);
    expect(motif).toMatch(/violates foreign key constraint/);
  });
});
