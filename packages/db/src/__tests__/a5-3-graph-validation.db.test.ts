import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';

/**
 * A5.3 et A12.3 — `graph_validation`, insertion seule, sur une base réelle.
 *
 * « Toute tentative de modification ou de suppression échoue au niveau de la
 * base. » Un essai sur le texte des migrations dirait que les barrages sont
 * écrits ; seul un essai sur une base dit qu'ils tiennent. C'est ce que celui-
 * ci fait, et sous le rôle propriétaire du schéma, qui est le rôle le plus
 * dangereux, pas le moins.
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
  // obstacle. Le contournement des politiques est celui d'un import
  // d'administration, et il est rétabli aussitôt.
  for (const table of ['site', 'organization']) {
    await db.execute(sql`alter table azimut.${sql.identifier(table)} no force row level security`);
  }
  await db.execute(sql`
    insert into azimut.organization(id,name,slug) values (${ORG},'GV','gv-a53')
    on conflict (id) do nothing`);
  await db.execute(sql`
    insert into azimut.site(id,org_id,name,country_code,timezone)
    values (${SITE},${ORG},'Site de validation','FR','Europe/Paris')
    on conflict (id) do nothing`);
  for (const table of ['site', 'organization']) {
    await db.execute(sql`alter table azimut.${sql.identifier(table)} force row level security`);
  }
});

afterAll(async () => { await client.end(); });

async function asOwner<T>(run: () => Promise<T>): Promise<T> {
  await db.execute(sql`alter table azimut.graph_validation no force row level security`);
  try {
    return await run();
  } finally {
    await db.execute(sql`alter table azimut.graph_validation force row level security`);
  }
}

async function insertRun(hash: string, passed: boolean, blocking: number): Promise<void> {
  await db.execute(sql`
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
    await asOwner(async () => {
      await insertRun(`sha256:aaa-${RUN}`, true, 0);
      const rows = await db.execute(sql`
        select graph_hash from azimut.graph_validation where site_id = ${SITE}`);
      expect(rows.length).toBeGreaterThan(0);
    });
  });

  it('accepte un passage échoué, avec ses anomalies comptées', async () => {
    await asOwner(async () => {
      const hash = `sha256:bbb-${RUN}`;
      await insertRun(hash, false, 3);
      const rows = await db.execute(sql`
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
    await asOwner(async () => {
      await expect(insertRun(`sha256:ccc-${RUN}`, true, 2)).rejects.toThrow();
    });
  });

  it('refuse un passage échoué sans anomalie bloquante', async () => {
    await asOwner(async () => {
      await expect(insertRun(`sha256:ddd-${RUN}`, false, 0)).rejects.toThrow();
    });
  });
});

/**
 * A12.3 — l'insertion seule, éprouvée sous le rôle propriétaire du schéma.
 * C'est le rôle qui contourne les politiques ; si les barrages tiennent sous
 * lui, ils tiennent sous les autres.
 */
describe('A12.3 — graph_validation est en insertion seule', () => {
  it('refuse la modification', async () => {
    const motif = await asOwner(() => refusalOf(() => db.execute(sql`
      update azimut.graph_validation set passed = false where site_id = ${SITE}`)));
    expect(motif).toMatch(/insert-only/);
  });

  it('refuse la suppression', async () => {
    const motif = await asOwner(() => refusalOf(() => db.execute(sql`
      delete from azimut.graph_validation where site_id = ${SITE}`)));
    expect(motif).toMatch(/insert-only/);
  });

  /**
   * TRUNCATE ne déclenche aucun déclencheur par ligne. Sans déclencheur
   * d'instruction, la table se viderait — c'est ce qui s'était produit sur
   * `approval` avant que le barrage ne soit posé.
   */
  it('refuse le vidage', async () => {
    const motif = await asOwner(() => refusalOf(
      () => db.execute(sql`truncate azimut.graph_validation`)));
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
    await db.execute(sql`alter table azimut.site no force row level security`);
    try {
      const motif = await refusalOf(
        () => db.execute(sql`delete from azimut.site where id = ${SITE}`));
      expect(motif).toMatch(/graph_validation_site_id_fkey/);
      expect(motif).toMatch(/violates foreign key constraint/);
    } finally {
      await db.execute(sql`alter table azimut.site force row level security`);
    }
  });
});
