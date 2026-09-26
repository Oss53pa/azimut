import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';

/**
 * A12.3 — « `audit_log`, `approval`, `message_schedule_approval` et
 * `graph_validation` sont en insertion seule, garanti en base et non par
 * convention applicative. Aucune modification et aucune suppression ne sont
 * possibles, pour aucun rôle, administration comprise. »
 *
 * Cet essai tient la même place que ceux du cloisonnement : il lit la base
 * réelle, pas le texte des migrations, et il échoue le jour où un droit, une
 * politique ou un déclencheur réapparaît ou disparaît. `audit_log` a vécu
 * vingt-cinq migrations avec UPDATE et DELETE accordés au rôle applicatif ;
 * un essai de ce genre l'aurait dit dès la première.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];

const INSERT_ONLY = ['audit_log', 'approval', 'graph_validation', 'message_schedule_approval'] as const;

/** Tables d'A12.3 qui n'existent pas encore : la tranche 2 est suspendue. */
const NOT_YET_CREATED = new Set<string>(['message_schedule_approval']);

const ORG = 'a1230000-0000-0000-0000-0000000000a1';

let sql: postgres.Sql;
let existing: readonly string[] = [];

beforeAll(async () => {
  if (URL === undefined || URL === '') {
    throw new Error('AZIMUT_TEST_DATABASE_URL absente. Voir packages/db/migrations/ORDRE.md.');
  }
  sql = postgres(URL, { onnotice: () => undefined });
  const rows = await sql<{ relname: string }[]>`
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'azimut' and c.relkind in ('r','p') and c.relname in ${sql(INSERT_ONLY)}`;
  existing = rows.map(r => r.relname).sort();
});

afterAll(async () => { await sql.end(); });

describe('A12.3 — les tables en insertion seule, en base', () => {
  it('chaque table nommée existe, sauf celle que la tranche suspendue n’a pas créée', () => {
    const missing = INSERT_ONLY.filter(t => !existing.includes(t));
    expect(missing.filter(t => !NOT_YET_CREATED.has(t))).toEqual([]);
    // Le jour où elle naît, elle doit sortir de la liste d'attente : l'essai la
    // couvre alors sans qu'on ait à s'en souvenir.
    expect(existing.filter(t => NOT_YET_CREATED.has(t))).toEqual([]);
  });

  it('aucun rôle autre que le propriétaire ne détient la modification, la suppression ni le vidage', async () => {
    const rows = await sql<{ table: string; grantee: string; privilege: string }[]>`
      select c.relname as table, coalesce(r.rolname, 'PUBLIC') as grantee, a.privilege_type as privilege
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
      left join pg_roles r on r.oid = a.grantee
      where n.nspname = 'azimut' and c.relname in ${sql(INSERT_ONLY)}
        and a.grantee <> c.relowner
        and a.privilege_type in ('UPDATE','DELETE','TRUNCATE')
      order by 1, 2, 3`;
    expect(rows.map(r => `${r.table} ${r.grantee} ${r.privilege}`)).toEqual([]);
  });

  it('aucune politique n’autorise la modification ni la suppression', async () => {
    const rows = await sql<{ table: string; policy: string; cmd: string }[]>`
      select c.relname as table, p.polname as policy, p.polcmd::text as cmd
      from pg_policy p join pg_class c on c.oid = p.polrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'azimut' and c.relname in ${sql(INSERT_ONLY)}
        and p.polcmd::text in ('*','w','d')
      order by 1, 2`;
    expect(rows.map(r => `${r.table} ${r.policy} ${r.cmd}`)).toEqual([]);
  });

  it('chaque table porte ses trois déclencheurs de refus', async () => {
    for (const table of existing) {
      const rows = await sql<{ tgname: string }[]>`
        select t.tgname from pg_trigger t
        join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'azimut' and c.relname = ${table} and not t.tgisinternal
          and t.tgenabled <> 'D'`;
      const names = rows.map(r => r.tgname);
      expect(names, table).toContain(`guard_${table}_update`);
      expect(names, table).toContain(`guard_${table}_delete`);
      expect(names, table).toContain(`guard_${table}_truncate`);
    }
  });
});

/**
 * Le journal d'audit, éprouvé : une ligne insérée ne se modifie, ne se
 * supprime ni ne se vide, ni sous le rôle applicatif ni sous le rôle
 * propriétaire. Tout se passe dans une transaction annulée : la ligne d'essai
 * ne survit pas, puisqu'aucune suppression ne pourrait l'effacer ensuite.
 */
describe('A12.3 — audit_log refuse la modification, la suppression et le vidage', () => {
  async function inRolledBack(check: (tx: postgres.TransactionSql) => Promise<void>): Promise<void> {
    const done = new Error('annulation voulue');
    await sql.begin(async tx => {
      await tx`insert into azimut.organization(id,name,slug) values (${ORG},'Audit','audit-a123')`;
      await tx`insert into azimut.audit_log(org_id, action, entity, occurred_at)
               values (${ORG}, 'essai', 'organization', now())`;
      await check(tx);
      throw done;
    }).catch((e: unknown) => { if (e !== done) throw e; });
  }

  async function refused(tx: postgres.TransactionSql, run: () => Promise<unknown>): Promise<string> {
    try {
      await tx.savepoint(async () => { await run(); });
    } catch (e: unknown) {
      return e instanceof Error ? e.message : String(e);
    }
    return 'accepté';
  }

  it('sous le rôle propriétaire, les déclencheurs refusent les trois voies', async () => {
    await inRolledBack(async tx => {
      expect(await refused(tx, () => tx`update azimut.audit_log set action = 'x' where org_id = ${ORG}`))
        .toMatch(/insert-only/);
      expect(await refused(tx, () => tx`delete from azimut.audit_log where org_id = ${ORG}`))
        .toMatch(/insert-only/);
      expect(await refused(tx, () => tx`truncate azimut.audit_log`))
        .toMatch(/insert-only/);
    });
  });

  it('sous le rôle applicatif, les droits refusent avant même les déclencheurs', async () => {
    await inRolledBack(async tx => {
      await tx`set local role authenticated`;
      expect(await refused(tx, () => tx`update azimut.audit_log set action = 'x'`))
        .toMatch(/permission denied/);
      expect(await refused(tx, () => tx`delete from azimut.audit_log`))
        .toMatch(/permission denied/);
      expect(await refused(tx, () => tx`truncate azimut.audit_log`))
        .toMatch(/permission denied/);
    });
  });
});
