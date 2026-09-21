import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { buildCommand } from '@azimut/core-model';
import { applyCommands } from '../write-path.js';

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
  await db.execute(sql`alter table azimut.organization no force row level security`);
  await db.execute(sql`alter table azimut.membership no force row level security`);
  await db.execute(sql`delete from azimut.membership`);
  await db.execute(sql`delete from azimut.organization`);
  await db.execute(sql`insert into azimut.organization(id,name,slug) values (${ORG_A},'A','a'),(${ORG_B},'B','b')`);
  await db.execute(sql`insert into azimut.membership(org_id,user_id,role) values (${ORG_A},${ALICE},'admin'),(${ORG_B},${BOB},'admin')`);
  await db.execute(sql`alter table azimut.organization force row level security`);
  await db.execute(sql`alter table azimut.membership force row level security`);

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
    after: { id, org_id: org, name, country_code: 'FR' },
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
