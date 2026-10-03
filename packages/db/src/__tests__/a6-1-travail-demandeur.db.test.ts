import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { buildCommand } from '@azimut/core-model';
import { applyCommands } from '../write-path.js';
import { loadSiteDataAs } from '../load-site-data.js';
import { deleteOrgFixture } from '../fixture-cleanup.js';

/**
 * A6.1 — le service de compilation lit sous l'identité du demandeur du travail
 * (migration 0070).
 *
 * Ce qui s'éprouve ici, contre la base réelle et sous `FORCE ROW LEVEL
 * SECURITY` :
 *   · le demandeur lit son site, et rien de l'autre organisation ;
 *   · un membre de deux organisations ne fait pas lire le site de l'une sous
 *     le nom de l'autre ;
 *   · le demandeur d'un travail est posé par la base, ne s'usurpe pas, et ne
 *     change plus après l'insertion.
 *
 * Le décor s'installe par le chemin identifié, jamais en levant le
 * cloisonnement : chaque utilisateur crée son organisation, s'y inscrit, puis
 * crée son site sous sa propre identité.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];

const USER_A = 'a6100000-0000-0000-0000-0000000000a1';
const USER_B = 'a6100000-0000-0000-0000-0000000000b1';
const USER_AB = 'a6100000-0000-0000-0000-0000000000c1';
const ORG_A = 'a6100000-0000-0000-0000-00000000a0a0';
const ORG_B = 'a6100000-0000-0000-0000-00000000b0b0';
const SITE_A = 'a6100000-0000-0000-0000-0000000005a1';
const SITE_B = 'a6100000-0000-0000-0000-0000000005b1';

let client: postgres.Sql;
let db: ReturnType<typeof drizzle>;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function asUser<T>(userId: string, run: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local role authenticated`);
    await tx.execute(sql`select set_config('azimut.current_user_id', ${userId}, true)`);
    return run(tx);
  });
}

async function seedOrg(userId: string, orgId: string, slug: string): Promise<void> {
  await asUser(userId, async (tx) => {
    await tx.execute(sql`insert into azimut.organization(id,name,slug) values (${orgId}, ${slug}, ${slug})`);
  });
}

async function join(userId: string, orgId: string): Promise<void> {
  await asUser(userId, async (tx) => {
    await tx.execute(sql`insert into azimut.membership(org_id,user_id,role) values (${orgId}, ${userId}, 'admin')`);
  });
}

async function seedSite(userId: string, orgId: string, siteId: string): Promise<void> {
  const out = buildCommand({
    operation: 'create', module: '01-socle', table: 'site', id: siteId, org_id: orgId,
    after: { id: siteId, org_id: orgId, name: `Site ${siteId.slice(-2)}`, country_code: 'FR', timezone: 'Europe/Paris' },
    timestamp: '2026-10-03T00:00:00.000Z',
  });
  if (!out.ok) throw new Error(JSON.stringify(out.findings));
  const applied = await applyCommands(db, { userId }, [out.value]);
  if (!applied.ok) throw new Error(JSON.stringify(applied.findings));
}

/** Une colonne de la première ligne rendue, ou `undefined`. */
function firstColumn(rows: unknown, column: string): unknown {
  const first: unknown = Array.isArray(rows) ? rows[0] : undefined;
  return typeof first === 'object' && first !== null
    ? (first as Record<string, unknown>)[column]
    : undefined;
}

/** Le message d'une tentative refusée, ou « accepté ». */
async function attempt(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return 'accepté';
  } catch (e: unknown) {
    const cause = e instanceof Error && e.cause instanceof Error ? e.cause.message : '';
    return `${e instanceof Error ? e.message : String(e)} ${cause}`;
  }
}

beforeAll(async () => {
  if (URL === undefined || URL === '') {
    throw new Error('AZIMUT_TEST_DATABASE_URL absente. Voir packages/db/migrations/ORDRE.md.');
  }
  client = postgres(URL, { onnotice: () => undefined });
  db = drizzle(client);
  await deleteOrgFixture(text => client.unsafe(text), text => client.unsafe(text), [ORG_A, ORG_B]);

  await seedOrg(USER_A, ORG_A, 'a61-a');
  await join(USER_A, ORG_A);
  await seedOrg(USER_B, ORG_B, 'a61-b');
  await join(USER_B, ORG_B);
  await join(USER_AB, ORG_A);
  await join(USER_AB, ORG_B);
  await seedSite(USER_A, ORG_A, SITE_A);
  await seedSite(USER_B, ORG_B, SITE_B);
});

afterAll(async () => {
  await deleteOrgFixture(text => client.unsafe(text), text => client.unsafe(text), [ORG_A, ORG_B]);
  await client.end();
});

describe('A6.1 — le service lit sous l’identité du demandeur', () => {
  it('le demandeur lit le site de son organisation', async () => {
    const site = await loadSiteDataAs(db, USER_B, ORG_B, SITE_B);
    expect(site.site.id).toBe(SITE_B);
    expect(site.organization.id).toBe(ORG_B);
  });

  it('un demandeur de A ne lit rien de B, même en nommant le site', async () => {
    expect(await attempt(() => loadSiteDataAs(db, USER_A, ORG_A, SITE_B))).toMatch(/not found/);
    expect(await attempt(() => loadSiteDataAs(db, USER_A, ORG_B, SITE_B))).toMatch(/not found/);
  });

  it('un membre des deux organisations ne lit pas le site de B sous le nom de A', async () => {
    expect(await attempt(() => loadSiteDataAs(db, USER_AB, ORG_A, SITE_B)))
      .toMatch(/not in organization/);
    const own = await loadSiteDataAs(db, USER_AB, ORG_B, SITE_B);
    expect(own.site.id).toBe(SITE_B);
  });

  it('sans identité, la lecture ne voit rien', async () => {
    expect(await attempt(() => db.transaction(async (tx) => {
      await tx.execute(sql`set local role authenticated`);
      const rows: unknown = await tx.execute(sql`select id from azimut.site where id = ${SITE_B}`);
      if (firstColumn(rows, 'id') !== undefined) throw new Error('visible');
    }))).toBe('accepté');
  });
});

describe('A6.1 — le demandeur d’un travail est posé par la base', () => {
  it('par défaut, le demandeur est l’utilisateur qui insère', async () => {
    const id = await asUser(USER_A, async (tx) => {
      const rows: unknown = await tx.execute(sql`
        insert into azimut.job(org_id, kind, payload)
        values (${ORG_A}, 'build_kiosk_package', ${JSON.stringify({ site_id: SITE_A, version: 1 })}::jsonb)
        returning id, requested_by`);
      expect(firstColumn(rows, 'requested_by')).toBe(USER_A);
      return String(firstColumn(rows, 'id') ?? '');
    });
    expect(id).not.toBe('');
  });

  it('nul ne crée un travail au nom d’un autre', async () => {
    const message = await attempt(() => asUser(USER_A, async (tx) => {
      await tx.execute(sql`
        insert into azimut.job(org_id, kind, requested_by)
        values (${ORG_A}, 'build_kiosk_package', ${USER_B})`);
    }));
    expect(message).toMatch(/row-level security/);
  });

  it('le demandeur ne change plus après l’insertion', async () => {
    const message = await attempt(() => asUser(USER_A, async (tx) => {
      await tx.execute(sql`
        update azimut.job set requested_by = ${USER_AB}
        where org_id = ${ORG_A}`);
    }));
    expect(message).toMatch(/fixed at insertion/);
  });
});
