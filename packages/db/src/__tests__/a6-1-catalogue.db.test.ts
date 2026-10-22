import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { partitioningGaps } from '../partitioning-catalogue.js';

/**
 * A6.1 et T-0.6 : le contrôle de catalogue, sur la base migrée.
 *
 * « Ajouter une table sans politique fait échouer la CI, démontré par un test
 * qui vérifie l'échec. » Le premier essai dit que la base n'a aucun écart ;
 * les suivants créent, dans une transaction annulée, chacun des écarts que le
 * contrôle doit voir, et constatent qu'il les voit.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];

let sql: postgres.Sql;

beforeAll(() => {
  if (URL === undefined || URL === '') {
    throw new Error('AZIMUT_TEST_DATABASE_URL absente. Voir packages/db/migrations/ORDRE.md.');
  }
  sql = postgres(URL, { onnotice: () => undefined });
});

afterAll(async () => { await sql.end(); });

/** Les écarts constatés après `setup`, dans une transaction annulée. */
async function gapsAfter(setup: (tx: postgres.TransactionSql) => Promise<void>): Promise<readonly string[]> {
  const done = new Error('annulation voulue');
  let found: readonly string[] = [];
  await sql.begin(async tx => {
    await setup(tx);
    found = await partitioningGaps(text => tx.unsafe(text));
    throw done;
  }).catch((e: unknown) => { if (e !== done) throw e; });
  return found;
}

describe('A6.1 : le catalogue de la base migrée', () => {
  it('ne présente aucun écart', async () => {
    expect(await partitioningGaps(text => sql.unsafe(text))).toEqual([]);
  });
});

describe('T-0.6 : le contrôle échoue sur chaque écart', () => {
  it('une table portant org_id sans sécurité par ligne ni politique', async () => {
    const gaps = await gapsAfter(async tx => {
      await tx.unsafe('create table azimut.zz_t06_nue (id uuid primary key, org_id uuid not null)');
    });
    expect(gaps).toEqual(['zz_t06_nue force', 'zz_t06_nue policy', 'zz_t06_nue rls']);
  });

  it('une colonne org_id ajoutée après coup, par ALTER', async () => {
    const gaps = await gapsAfter(async tx => {
      await tx.unsafe('create table azimut.zz_t06_tardive (id uuid primary key)');
      await tx.unsafe('alter table azimut.zz_t06_tardive add column org_id uuid');
    });
    expect(gaps).toContain('zz_t06_tardive policy');
  });

  it('une politique ouverte à tous', async () => {
    const gaps = await gapsAfter(async tx => {
      await tx.unsafe('create table azimut.zz_t06_ouverte (id uuid primary key, org_id uuid not null)');
      await tx.unsafe('alter table azimut.zz_t06_ouverte enable row level security');
      await tx.unsafe('alter table azimut.zz_t06_ouverte force row level security');
      await tx.unsafe('create policy tout on azimut.zz_t06_ouverte for all to authenticated using (true)');
    });
    expect(gaps).toEqual(['zz_t06_ouverte open-policy tout']);
  });

  it('une politique retirée d’une table existante', async () => {
    const gaps = await gapsAfter(async tx => {
      await tx.unsafe('drop policy site_org_policy on azimut.site');
    });
    expect(gaps).toEqual(['site policy']);
  });

  it('une clé étrangère simple entre deux tables d’organisation', async () => {
    const gaps = await gapsAfter(async tx => {
      await tx.unsafe(`create table azimut.zz_t06_cle (
        id uuid primary key, org_id uuid not null,
        site_id uuid references azimut.site(id))`);
      await tx.unsafe('alter table azimut.zz_t06_cle enable row level security');
      await tx.unsafe('alter table azimut.zz_t06_cle force row level security');
      await tx.unsafe(`create policy p on azimut.zz_t06_cle for all to authenticated
        using (org_id in (select azimut.user_org_ids()))`);
    });
    expect(gaps).toEqual(['zz_t06_cle fk zz_t06_cle_site_id_fkey']);
  });

  it('une fonction SECURITY DEFINER sans chemin de recherche figé', async () => {
    const gaps = await gapsAfter(async tx => {
      await tx.unsafe('create function azimut.zz_t06_privilege() returns int security definer language sql as $$ select 1 $$');
    });
    expect(gaps).toEqual(['function zz_t06_privilege search_path']);
  });

  /**
   * Le registre n'existe que sous `scripts/migrate.js`. Absent, il est créé
   * ici comme ce script le crée : les droits par défaut de 0025 l'accordent
   * alors à `authenticated`, ce que le contrôle doit voir.
   */
  it('un registre des migrations accordé à authenticated', async () => {
    const gaps = await gapsAfter(async tx => {
      const [registry] = await tx<{ oid: string | null }[]>`select to_regclass('azimut._migrations')::text as oid`;
      if (registry?.oid === null) {
        await tx.unsafe(`create table azimut._migrations (
          id serial primary key, name text not null unique,
          applied_at timestamptz not null default now())`);
      }
      await tx.unsafe('grant select on azimut._migrations to authenticated');
    });
    expect(gaps).toEqual(['_migrations grant authenticated']);
  });
});
