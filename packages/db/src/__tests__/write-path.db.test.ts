import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { buildCommand } from '@azimut/core-model';
import { applyCommands } from '../write-path.js';
import { deleteOrgFixture } from '../fixture-cleanup.js';

/**
 * A6.1, second test obligatoire — « un utilisateur de l'organisation A ne peut
 * lire, écrire, ni détecter l'existence d'aucune ligne de l'organisation B ».
 *
 * Il demande une base : `pnpm test:db`. Mise en place dans
 * `packages/db/migrations/ORDRE.md`. Sans base, la suite s'arrête d'elle-même
 * avec le mode d'emploi, plutôt que de passer en silence.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];
const ALICE = '11111111-1111-1111-1111-111111111111';
const BOB = '22222222-2222-2222-2222-222222222222';
const ORG_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const ORG_B = 'bbbbbbbb-0000-0000-0000-000000000002';

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
  // La suite se rejoue : elle part d'un état connu plutôt que de supposer une
  // base neuve. L'amorçage contourne les politiques, comme le ferait un import
  // d'administration, et les rétablit aussitôt.
  //
  // Le nettoyage porte sur les deux organisations de cette suite, et sur elles
  // seules. Il vidait les cinq tables entières, ce qui emportait les fixtures
  // des autres suites : une suite qui nettoie au-delà de ce qu'elle a écrit
  // fait échouer ses voisines selon l'ordre d'exécution.
  //
  // A5.11, version 7 : la cascade depuis l'organisation n'existe plus, et
  // partir d'elle se heurterait maintenant à un refus. Le décor se retire dans
  // l'ordre de dépendance, que `deleteOrgFixture` calcule depuis le schéma.
  await deleteOrgFixture(text => client.unsafe(text), text => client.unsafe(text),
    [ORG_A, ORG_B]);

  const seeded = ['membership', 'organization'];
  for (const table of seeded) {
    await db.execute(sql`alter table ${sql.identifier('azimut')}.${sql.identifier(table)} no force row level security`);
  }
  await db.execute(sql`insert into azimut.organization(id,name,slug) values (${ORG_A},'A','a'),(${ORG_B},'B','b')`);
  await db.execute(sql`insert into azimut.membership(org_id,user_id,role) values (${ORG_A},${ALICE},'admin'),(${ORG_B},${BOB},'admin')`);
  for (const table of seeded) {
    await db.execute(sql`alter table ${sql.identifier('azimut')}.${sql.identifier(table)} force row level security`);
  }

});
afterAll(async () => { await client.end(); });

async function readAs(userId: string, id: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local role authenticated`);
    await tx.execute(sql`select set_config('azimut.current_user_id', ${userId}, true)`);
    return tx.execute(sql`select id from azimut.site where id = ${id}`);
  });
}

function siteCreate(id: string, org: string, name: string) {
  const out = buildCommand({
    operation: 'create', module: '01-socle', table: 'site', id, org_id: org,
    after: { id, org_id: org, name, country_code: 'FR', timezone: 'Europe/Paris' },
    timestamp: '2026-09-21T00:00:00.000Z',
  });
  if (!out.ok) throw new Error(JSON.stringify(out.findings));
  return out.value;
}

describe('chemin d’écriture et cloisonnement en écriture (A6.1)', () => {
  it('écrit un site dans son organisation', async () => {
    const id = 'a5000000-0000-0000-0000-00000000aa01';
    const r = await applyCommands(db, { userId: ALICE }, [siteCreate(id, ORG_A, 'Site A')]);
    expect(r.ok).toBe(true);
    // La relecture doit poser la même identité : sans elle, la base ne montre
    // rien, ce qui est le comportement voulu et non un échec d'écriture.
    const rows = await readAs(ALICE, id);
    expect(rows.length).toBe(1);
  });

  it('refuse une écriture dans une autre organisation', async () => {
    const id = 'a5000000-0000-0000-0000-00000000bb01';
    const r = await applyCommands(db, { userId: ALICE }, [siteCreate(id, ORG_B, 'Site vole')]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.findings[0]?.code).toBe('EDIT.WRITE_REFUSED');
  });

  it('tout ou rien : une commande refusée annule la précédente', async () => {
    const bon = 'a5000000-0000-0000-0000-00000000cc01';
    const mauvais = 'a5000000-0000-0000-0000-00000000cc02';
    const r = await applyCommands(db, { userId: ALICE }, [
      siteCreate(bon, ORG_A, 'Bon'),
      siteCreate(mauvais, ORG_B, 'Mauvais'),
    ]);
    expect(r.ok).toBe(false);
    const rows = await readAs(ALICE, bon);
    expect(rows.length).toBe(0);
  });

  it('l’identité ne fuit pas d’une transaction à la suivante', async () => {
    const id = 'a5000000-0000-0000-0000-00000000dd01';
    await applyCommands(db, { userId: ALICE }, [siteCreate(id, ORG_A, 'Chez Alice')]);
    expect((await readAs(ALICE, id)).length).toBe(1);
    expect((await readAs(BOB, id)).length).toBe(0);
  });
});

/**
 * E5.1 et M1 (partie M) — `azimut.apply_commands`, le chemin d'écriture
 * atteignable depuis le poste.
 *
 * Le poste parle à PostgREST et ne peut pas ouvrir de transaction. Or M1 veut
 * qu'un site naisse avec un bâtiment et un niveau — « un site sans niveau est
 * un état inutile » — et trois requêtes séparées laisseraient ce cas se
 * produire au moindre incident.
 */
describe('apply_commands — le chemin d’écriture du poste', () => {
  const ORG = ORG_A;

  async function callAs(userId: string, commands: unknown): Promise<unknown> {
    return db.transaction(async (tx) => {
      await tx.execute(sql`set local role authenticated`);
      await tx.execute(sql`select set_config('azimut.current_user_id', ${userId}, true)`);
      return tx.execute(sql`select azimut.apply_commands(${JSON.stringify(commands)}::jsonb) as applied`);
    });
  }

  function creation(suffix: string, org: string) {
    const site = `a5000000-0000-0000-0000-000000${suffix}`;
    const building = `a6000000-0000-0000-0000-000000${suffix}`;
    const level = `a7000000-0000-0000-0000-000000${suffix}`;
    return {
      site,
      commands: [
        { operation: 'create', table: 'site', id: site,
          after: { id: site, org_id: org, name: `Site ${suffix}`, country_code: 'FR',
                   timezone: 'Europe/Paris' } },
        { operation: 'create', table: 'building', id: building,
          after: { id: building, org_id: org, site_id: site, name: 'Bâtiment 1' } },
        { operation: 'create', table: 'level', id: level,
          after: { id: level, org_id: org, building_id: building, name: 'Niveau 0',
                   ordinal: '0', elevation_m: '0' } },
      ],
    };
  }

  it('crée le site, son bâtiment et son niveau en une transaction', async () => {
    const { site, commands } = creation('00ee01', ORG);
    await callAs(ALICE, commands);
    expect((await readAs(ALICE, site)).length).toBe(1);
  });

  it('refuse une création dans une autre organisation', async () => {
    const { commands } = creation('00ee02', ORG_B);
    await expect(callAs(ALICE, commands)).rejects.toThrow();
  });

  /**
   * C'est la garantie qui motive la fonction : M1 (partie M) interdit un site
   * sans niveau, et sans transaction le premier insert survivrait à l'échec du
   * second.
   */
  it('annule tout si une seule commande échoue', async () => {
    const { site, commands } = creation('00ee03', ORG);
    const broken = [
      commands[0],
      { ...commands[1], after: { ...(commands[1]?.after ?? {}), site_id: '00000000-0000-0000-0000-000000000000' } },
    ];
    await expect(callAs(ALICE, broken)).rejects.toThrow();
    expect((await readAs(ALICE, site)).length).toBe(0);
  });

  it('refuse une table qui n’est pas au schéma', async () => {
    await expect(callAs(ALICE, [
      { operation: 'create', table: 'pg_shadow', id: ALICE, after: { x: '1' } },
    ])).rejects.toThrow();
  });
});
