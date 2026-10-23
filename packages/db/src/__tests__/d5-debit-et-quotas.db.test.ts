import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { provisionStatements } from '../provision-organization.js';

/**
 * Lot 8 de l'audit (0084) : la limitation de débit et les quotas de la file.
 *
 * Les seuils sont abaissés dans la transaction annulée de chaque essai : ce
 * sont des données, et l'essai les traite comme telles.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];

const ORG_A = 'd8000000-0000-0000-0000-0000000000a1';
const ORG_B = 'd8000000-0000-0000-0000-0000000000b1';
const ADMIN_A = 'd8000000-0000-0000-0000-00000000a001';
const ADMIN_A2 = 'd8000000-0000-0000-0000-00000000a002';
const ADMIN_B = 'd8000000-0000-0000-0000-00000000b001';
const member = (n: number): string => `d8000000-0000-0000-0000-0000000${String(n).padStart(5, '0')}`;

let sql: postgres.Sql;

beforeAll(() => {
  if (URL === undefined || URL === '') {
    throw new Error('AZIMUT_TEST_DATABASE_URL absente. Voir packages/db/migrations/ORDRE.md.');
  }
  sql = postgres(URL, { onnotice: () => undefined });
});

afterAll(async () => { await sql.end(); });

type Tx = postgres.TransactionSql;

async function as(tx: Tx, userId: string): Promise<void> {
  await tx`select set_config('azimut.current_user_id', ${userId}, true)`;
}

/** Le refus, avec son état SQL, son message et son détail ; ou `accepté`. */
async function outcome(tx: Tx, attempt: () => Promise<unknown>): Promise<string> {
  try {
    await tx.savepoint(async () => { await attempt(); });
    return 'accepté';
  } catch (e: unknown) {
    if (e instanceof postgres.PostgresError) return `${e.code} ${e.message} ${e.detail ?? ''}`;
    return e instanceof Error ? e.message : String(e);
  }
}

async function inRolledBack(settings: Readonly<Record<string, number>>, check: (tx: Tx) => Promise<void>): Promise<void> {
  const done = new Error('annulation voulue');
  await sql.begin(async tx => {
    for (const [key, value] of Object.entries(settings)) {
      await tx`update azimut.security_setting set value = ${value} where key = ${key}`;
    }
    for (const p of [
      { id: ORG_A, name: 'A8', slug: 'd8-a', adminId: ADMIN_A },
      { id: ORG_B, name: 'B8', slug: 'd8-b', adminId: ADMIN_B },
    ]) {
      for (const text of provisionStatements(p)) await tx.unsafe(text);
    }
    await tx`set local role authenticated`;
    await check(tx);
    throw done;
  }).catch((e: unknown) => { if (e !== done) throw e; });
}

const addMember = (tx: Tx, org: string, n: number) => () => tx`select azimut.set_member(${org}, ${member(n)}, 'designer')`;

describe('lot 8 : une rafale est refusée au-delà du seuil, et seulement elle', () => {
  it('le N+1-ième changement de membre d’un utilisateur est refusé, en 429 avec un délai', async () => {
    await inRolledBack({ 'rate.membership.per_user': 3 }, async tx => {
      await as(tx, ADMIN_A);
      for (let n = 1; n <= 3; n++) expect(await outcome(tx, addMember(tx, ORG_A, n))).toBe('accepté');
      const refused = await outcome(tx, addMember(tx, ORG_A, 4));
      expect(refused).toMatch(/^PGRST \{"code" : "rate_limited", "message" : "rate_limited"\} /);
      expect(refused).toMatch(/"status" : 429/);
      expect(refused).toMatch(/"Retry-After" : "\d+"/);
    });
  });

  it('le refus ne nomme ni l’organisation, ni l’utilisateur, ni le compteur', async () => {
    await inRolledBack({ 'rate.membership.per_user': 1 }, async tx => {
      await as(tx, ADMIN_A);
      await addMember(tx, ORG_A, 1)();
      const refused = await outcome(tx, addMember(tx, ORG_A, 2));
      expect(refused).toContain('rate_limited');
      for (const leak of [ORG_A, ADMIN_A, 'hits', 'per_user', 'membership']) expect(refused).not.toContain(leak);
    });
  });

  it('l’organisation B n’est pas affectée par la rafale de A', async () => {
    await inRolledBack({ 'rate.membership.per_user': 2, 'rate.membership.per_org': 2 }, async tx => {
      await as(tx, ADMIN_A);
      await addMember(tx, ORG_A, 1)();
      await addMember(tx, ORG_A, 2)();
      expect(await outcome(tx, addMember(tx, ORG_A, 3))).toContain('rate_limited');
      await as(tx, ADMIN_B);
      expect(await outcome(tx, addMember(tx, ORG_B, 11))).toBe('accepté');
      expect(await outcome(tx, addMember(tx, ORG_B, 12))).toBe('accepté');
    });
  });

  it('le seuil d’une organisation se partage entre ses membres', async () => {
    await inRolledBack({ 'rate.membership.per_user': 10, 'rate.membership.per_org': 3 }, async tx => {
      await as(tx, ADMIN_A);
      await tx`select azimut.set_member(${ORG_A}, ${ADMIN_A2}, 'admin')`;
      await addMember(tx, ORG_A, 1)();
      await as(tx, ADMIN_A2);
      expect(await outcome(tx, addMember(tx, ORG_A, 2))).toBe('accepté');
      expect(await outcome(tx, addMember(tx, ORG_A, 3))).toContain('rate_limited');
    });
  });

  it('le débit d’écriture est compté par utilisateur, instruction par instruction', async () => {
    await inRolledBack({ 'rate.write.per_user': 2 }, async tx => {
      await as(tx, ADMIN_A);
      const site = (n: number) => () => tx`insert into azimut.site(org_id, name, country_code, timezone)
        values (${ORG_A}, ${`Site ${String(n)}`}, 'CI', 'Africa/Abidjan')`;
      expect(await outcome(tx, site(1))).toBe('accepté');
      expect(await outcome(tx, site(2))).toBe('accepté');
      expect(await outcome(tx, site(3))).toContain('rate_limited');
      await as(tx, ADMIN_B);
      expect(await outcome(tx, () => tx`insert into azimut.site(org_id, name, country_code, timezone)
        values (${ORG_B}, 'Site B', 'CI', 'Africa/Abidjan')`)).toBe('accepté');
    });
  });
});

describe('lot 8 : les quotas de la file', () => {
  const enqueue = (tx: Tx, org: string, payload: unknown) => () =>
    tx`insert into azimut.job(org_id, kind, payload) values (${org}, 'audit_site', ${JSON.stringify(payload)}::text::jsonb)`;

  it('un paramètre au-delà de la taille configurée est refusé', async () => {
    await inRolledBack({ 'job.payload.max_bytes': 64 }, async tx => {
      await as(tx, ADMIN_A);
      expect(await outcome(tx, enqueue(tx, ORG_A, { site: 'x' }))).toBe('accepté');
      expect(await outcome(tx, enqueue(tx, ORG_A, { site: 'x'.repeat(100) })))
        .toBe('22023 EDIT.COMMAND_SHAPE_INVALID job.payload too_large');
    });
  });

  it('les dépôts sont limités par utilisateur', async () => {
    await inRolledBack({ 'rate.job_enqueue.per_user': 2 }, async tx => {
      await as(tx, ADMIN_A);
      await enqueue(tx, ORG_A, {})();
      await enqueue(tx, ORG_A, {})();
      expect(await outcome(tx, enqueue(tx, ORG_A, {}))).toContain('rate_limited');
    });
  });

  it('la prise ne dépasse pas le nombre de travaux en cours d’une organisation', async () => {
    await inRolledBack({ 'job.max_running_per_org': 1 }, async tx => {
      await as(tx, ADMIN_A);
      await enqueue(tx, ORG_A, { n: 1 })();
      await enqueue(tx, ORG_A, { n: 2 })();
      await as(tx, ADMIN_B);
      await enqueue(tx, ORG_B, { n: 3 })();
      await tx`reset role`;
      await tx`set local role azimut_job_dispatch`;
      const claim = async (): Promise<string | null> => {
        const [row] = await tx<{ org_id: string }[]>`select org_id from azimut.job_claim(now(), array[5])`;
        return row?.org_id ?? null;
      };
      // Trois travaux en attente, deux de A : un seul de A part, celui de B
      // aussi, et le second de A attend. L'ordre des deux premières prises
      // n'est pas en cause : déposés dans la même transaction, ils ont la
      // même date.
      const taken = [await claim(), await claim(), await claim()];
      expect(taken.slice(0, 2).sort()).toEqual([ORG_A, ORG_B].sort());
      expect(taken[2]).toBeNull();
    });
  });
});

describe('lot 8 : les compteurs ne se lisent ni ne se contournent', () => {
  it('l’application ne lit pas les compteurs et n’appelle pas le contrôle', async () => {
    await inRolledBack({}, async tx => {
      await as(tx, ADMIN_A);
      expect(await outcome(tx, () => tx`select * from azimut.rate_counter`)).toMatch(/permission denied/);
      expect(await outcome(tx, () => tx`select azimut.rate_check('membership', ${ORG_B})`)).toMatch(/permission denied/);
      expect(await outcome(tx, () => tx`delete from azimut.rate_counter`)).toMatch(/permission denied/);
    });
  });
});
