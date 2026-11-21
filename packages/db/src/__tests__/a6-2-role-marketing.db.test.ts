import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { enrolFixtureMembers } from '../fixture-membership.js';

/**
 * A5.1 et A6.2 — le rôle `marketing` sur une base réelle (0079).
 *
 * A6.2 lui donne le seul module de P9, et « aucun accès aux autres modules ».
 * P9 n'étant pas construit, le rôle ne voit et n'écrit rien de son
 * organisation, sauf ses propres rattachements. Membre `admin` d'une autre
 * organisation, il y garde ses droits : le refus porte sur l'organisation où
 * il est `marketing`, pas sur l'utilisateur.
 *
 * Tout se passe dans des transactions annulées.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];
const ORG_M = 'a7900000-0000-0000-0000-0000000000a1';
const ORG_A = 'a7900000-0000-0000-0000-0000000000a2';
const SITE_M = 'a7900000-0000-0000-0000-0000000000b1';
const SITE_A = 'a7900000-0000-0000-0000-0000000000b2';
const MARKETER = 'a7900000-0000-0000-0000-0000000000d1';
const KEEPER = 'a7900000-0000-0000-0000-0000000000d2';

let sql: postgres.Sql;

beforeAll(() => {
  if (URL === undefined || URL === '') {
    throw new Error('AZIMUT_TEST_DATABASE_URL absente. Voir packages/db/migrations/ORDRE.md.');
  }
  sql = postgres(URL, { onnotice: () => undefined });
});

afterAll(async () => { await sql.end(); });

async function inRolledBack(check: (tx: postgres.TransactionSql) => Promise<void>): Promise<void> {
  const done = new Error('annulation voulue');
  await sql.begin(async tx => {
    // Le décor est posé par un administrateur des deux organisations : sous
    // l'identité du membre marketing, la base le refuse, et c'est le sujet.
    await tx`select set_config('azimut.current_user_id', ${KEEPER}, true)`;
    await tx`insert into azimut.organization(id,name,slug)
             values (${ORG_M},'M','a79-marketing'),(${ORG_A},'A','a79-admin')`;
    await enrolFixtureMembers(text => tx.unsafe(text), [
      { orgId: ORG_M, userId: MARKETER, role: 'marketing' },
      { orgId: ORG_A, userId: MARKETER, role: 'admin' },
      { orgId: ORG_M, userId: KEEPER, role: 'admin' },
      { orgId: ORG_A, userId: KEEPER, role: 'admin' },
    ]);
    await tx`insert into azimut.site(id,org_id,name,country_code,timezone)
             values (${SITE_M},${ORG_M},'Site M','FR','Europe/Paris'),
                    (${SITE_A},${ORG_A},'Site A','FR','Europe/Paris')`;
    await tx`select set_config('azimut.current_user_id', ${MARKETER}, true)`;
    await tx`set local role authenticated`;
    await check(tx);
    throw done;
  }).catch((e: unknown) => { if (e !== done) throw e; });
}

async function refusal(tx: postgres.TransactionSql, run: () => Promise<unknown>): Promise<string> {
  try {
    await tx.savepoint(async () => { await run(); });
  } catch (e: unknown) {
    return e instanceof Error ? e.message : String(e);
  }
  return 'accepté';
}

describe('0079 — le rôle marketing', () => {
  it('est accepté au rattachement, et un rôle hors de A5.1 est refusé', async () => {
    await inRolledBack(async tx => {
      const roles = await tx<{ role: string }[]>`
        select role from azimut.membership where user_id = ${MARKETER} order by role`;
      expect(roles.map(r => r.role)).toEqual(['admin', 'marketing']);
      await tx`reset role`;
      const [constraint] = await tx<{ def: string }[]>`
        select pg_get_constraintdef(oid) as def from pg_constraint
        where conrelid = 'azimut.membership'::regclass and conname = 'membership_role_check'`;
      for (const role of ['admin', 'designer', 'owner_rep', 'vendor', 'operator', 'auditor', 'marketing']) {
        expect(constraint?.def).toContain(`'${role}'`);
      }
      let message = 'accepté';
      try {
        await tx.savepoint(async sp => {
          await sp`alter table azimut.membership no force row level security`;
          await sp`insert into azimut.membership(org_id,user_id,role) values (${ORG_A},${KEEPER},'stagiaire')`;
        });
      } catch (e: unknown) {
        message = e instanceof Error ? e.message : String(e);
      }
      expect(message).toMatch(/membership_role_check/);
    });
  });

  it('ne voit rien de l’organisation où il est marketing, sauf ses rattachements', async () => {
    await inRolledBack(async tx => {
      const sites = await tx<{ id: string }[]>`select id from azimut.site order by id`;
      expect(sites.map(s => s.id)).toEqual([SITE_A]);
      const orgs = await tx<{ id: string }[]>`select id from azimut.organization order by id`;
      expect(orgs.map(o => o.id)).toEqual([ORG_A]);
    });
  });

  it('n’écrit rien dans l’organisation où il est marketing', async () => {
    await inRolledBack(async tx => {
      expect(await refusal(tx, () => tx`
        insert into azimut.site(org_id,name,country_code,timezone)
        values (${ORG_M},'Autre','FR','Europe/Paris')`)).toMatch(/row-level security/);
      const updated = await tx`update azimut.site set name = 'X' where id = ${SITE_M}`;
      expect(updated.count).toBe(0);
    });
  });

  it('garde ses droits d’admin dans son autre organisation', async () => {
    await inRolledBack(async tx => {
      const updated = await tx`update azimut.site set name = 'Site A2' where id = ${SITE_A}`;
      expect(updated.count).toBe(1);
    });
  });
});

const INSERT_ONLY = [
  'approval', 'audit_log', 'command_journal', 'graph_validation', 'message_schedule_approval',
] as const;

describe('0079 — toute table portant org_id refuse le rôle marketing', () => {
  it('une politique restrictive par table, lue dans le catalogue', async () => {
    const missing = await sql<{ relname: string }[]>`
      select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attname = 'org_id' and not a.attisdropped
      where n.nspname = 'azimut' and c.relkind in ('r','p') and c.relname <> 'membership'
        and c.relname not in ${sql(INSERT_ONLY)}
        and not exists (select 1 from pg_policy p
                        where p.polrelid = c.oid and not p.polpermissive
                          and p.polname = c.relname || '_marketing_no_access')
      order by c.relname`;
    expect(missing.map(r => r.relname)).toEqual([]);
  });

  it('les tables en insertion seule le refusent dans leurs deux politiques', async () => {
    const rows = await sql<{ tablename: string; cmd: string; expr: string }[]>`
      select tablename, cmd, coalesce(qual, '') || coalesce(with_check, '') as expr
      from pg_policies
      where schemaname = 'azimut' and tablename in ${sql(INSERT_ONLY)} and permissive = 'PERMISSIVE'
      order by 1, 2`;
    expect(rows.length).toBe(INSERT_ONLY.length * 2);
    for (const row of rows) expect(row.expr, `${row.tablename} ${row.cmd}`).toContain('marketing');
  });
});
