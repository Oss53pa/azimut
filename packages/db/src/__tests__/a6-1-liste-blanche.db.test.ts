import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { MODULE_KEYS, OWNED_TABLES } from '@azimut/core-model';
import { provisionStatements } from '../provision-organization.js';

/**
 * E5.1, M12.A2 et A6.1 : la liste blanche de `apply_commands` (0078).
 *
 * La liste concorde avec le registre de propriété. La fonction refuse toute
 * table qu'aucun module ne possède, toute opération que la table n'admet pas,
 * toute commande mal formée, et toute modification ou suppression qui
 * n'atteint aucune ligne, du même refus que la ligne soit absente, d'une
 * autre organisation ou hors des droits du rôle.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];

const ORG_A = 'a6400000-0000-0000-0000-0000000000a1';
const ORG_B = 'a6400000-0000-0000-0000-0000000000b1';
const ADMIN_A = 'a6400000-0000-0000-0000-00000000a001';
const OWNER_REP_A = 'a6400000-0000-0000-0000-00000000a003';
const ADMIN_B = 'a6400000-0000-0000-0000-00000000b001';
const SITE_A = 'a6400000-0000-0000-0000-0000000001a1';
const SITE_B = 'a6400000-0000-0000-0000-0000000001b1';
const ABSENT = 'a6400000-0000-0000-0000-0000000000f9';

const INSERT_ONLY = ['approval', 'graph_validation', 'message_schedule_approval'];

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

async function apply(tx: Tx, commands: unknown): Promise<unknown> {
  return tx`select azimut.apply_commands(${tx.json(commands as postgres.JSONValue)}) as n`;
}

/** Code et message d'un refus, ou « accepté » ; les identifiants comparés ramenés au même jeton. */
async function failure(tx: Tx, attempt: () => Promise<unknown>, ids: readonly string[] = []): Promise<string> {
  try {
    await tx.savepoint(async () => { await attempt(); });
    return 'accepté';
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    return ids.reduce((acc, id) => acc.replaceAll(id, '<id>'), `${err.code ?? ''} | ${err.message ?? ''}`);
  }
}

async function inRolledBack(check: (tx: Tx) => Promise<void>): Promise<void> {
  const done = new Error('annulation voulue');
  await sql.begin(async tx => {
    for (const p of [
      { id: ORG_A, name: 'A64', slug: 'a64-a', adminId: ADMIN_A },
      { id: ORG_B, name: 'B64', slug: 'a64-b', adminId: ADMIN_B },
    ]) {
      for (const text of provisionStatements(p)) await tx.unsafe(text);
    }
    await tx`set local role authenticated`;
    await as(tx, ADMIN_A);
    await tx`select azimut.set_member(${ORG_A}, ${OWNER_REP_A}, 'owner_rep')`;
    await tx`insert into azimut.site(id,org_id,name,country_code,timezone) values (${SITE_A},${ORG_A},'Site A','FR','Europe/Paris')`;
    await as(tx, ADMIN_B);
    await tx`insert into azimut.site(id,org_id,name,country_code,timezone) values (${SITE_B},${ORG_B},'Site B','FR','Europe/Paris')`;
    await as(tx, ADMIN_A);
    await check(tx);
    throw done;
  }).catch((e: unknown) => { if (e !== done) throw e; });
}

const rename = (id: string, extra: Record<string, string> = {}) =>
  [{ operation: 'update', table: 'site', id, after: { name: 'Renommé', ...extra } }];

describe('D-4 : la liste concorde avec le registre de propriété', () => {
  it('chaque table possédée, et `support`, avec ses opérations', async () => {
    const rows = await sql<{ table_name: string; modules: string[]; ops: string }[]>`
      select table_name, modules,
             concat_ws(',', case when can_create then 'c' end, case when can_update then 'u' end,
                       case when can_delete then 'd' end) as ops
      from azimut.command_table order by table_name collate "C"`;
    const expected = [
      ...MODULE_KEYS.flatMap(m => OWNED_TABLES[m].map(t => ({
        table_name: t, modules: [m], ops: INSERT_ONLY.includes(t) ? 'c' : 'c,u,d',
      }))),
      { table_name: 'support', modules: ['02-wayfinding', '04-signaletique'], ops: 'c,u,d' },
    ].sort((a, b) => (a.table_name < b.table_name ? -1 : 1)); // ordre des octets, comme `collate "C"`
    expect(rows.map(r => ({ ...r }))).toEqual(expected);
  });

  it('se lit, ne s’écrit pas', async () => {
    await inRolledBack(async tx => {
      expect(await failure(tx, () => tx`delete from azimut.command_table`)).toMatch(/permission denied/);
      expect(await failure(tx, () => tx`
        insert into azimut.command_table values ('organization', '{x}', true, true, true)`)).toMatch(/permission denied/);
    });
  });
});

describe('D-4 : ce que apply_commands refuse', () => {
  it('une table qu’aucun module ne possède', async () => {
    await inRolledBack(async tx => {
      for (const table of ['organization', 'membership', 'audit_log', 'charter', '_migrations', 'command_table', 'vendor']) {
        expect(await failure(tx, () => apply(tx, [
          { operation: 'create', table, id: ABSENT, after: { name: 'x' } }])), table)
          .toBe('42501 | EDIT.TABLE_NOT_OWNED');
      }
    });
  });

  it('une modification ou une suppression sur une table en insertion seule', async () => {
    await inRolledBack(async tx => {
      for (const operation of ['update', 'delete']) {
        expect(await failure(tx, () => apply(tx, [
          { operation, table: 'approval', id: ABSENT, after: { comment: 'x' } }])))
          .toBe('42501 | EDIT.WRITE_REFUSED');
      }
    });
  });

  it('une commande mal formée', async () => {
    await inRolledBack(async tx => {
      const shapes: unknown[] = [
        { operation: 'create', table: 'site' },
        { operation: 'create', table: 'site', id: SITE_A, after: 'pas un objet' },
        { operation: 'create', table: 'site', id: ABSENT, after: { id: SITE_A, name: 'x' } },
        { operation: 'update', table: 'site', id: SITE_A, after: { id: ABSENT } },
        { operation: 'renommer', table: 'site', id: SITE_A },
      ];
      for (const command of shapes) {
        expect(await failure(tx, () => apply(tx, [command])), JSON.stringify(command))
          .toBe('22023 | EDIT.COMMAND_SHAPE_INVALID');
      }
    });
  });

  it('un org_id fourni ne déplace pas la ligne', async () => {
    await inRolledBack(async tx => {
      expect(await failure(tx, () => apply(tx, rename(SITE_A, { org_id: ORG_B }))))
        .toBe('42501 | EDIT.WRITE_REFUSED');
      const [row] = await tx`select org_id::text as org, name from azimut.site where id = ${SITE_A}`;
      expect(row).toEqual({ org: ORG_A, name: 'Site A' });
      await apply(tx, rename(SITE_A, { org_id: ORG_A }));
      const [after] = await tx`select name from azimut.site where id = ${SITE_A}`;
      expect(after).toEqual({ name: 'Renommé' });
    });
  });
});

describe('A6.1 : une écriture qui n’atteint rien est refusée, toujours de la même façon', () => {
  it('ligne absente, ligne de B, ligne hors des droits du rôle', async () => {
    await inRolledBack(async tx => {
      const scrub = [SITE_A, SITE_B, ABSENT];
      const absent = await failure(tx, () => apply(tx, rename(ABSENT)), scrub);
      const foreign = await failure(tx, () => apply(tx, rename(SITE_B)), scrub);
      await as(tx, OWNER_REP_A);
      const forbidden = await failure(tx, () => apply(tx, rename(SITE_A)), scrub);
      const removal = await failure(tx, () => apply(tx, [{ operation: 'delete', table: 'site', id: SITE_A }]), scrub);
      expect(absent).toBe('42501 | EDIT.WRITE_REFUSED');
      expect([foreign, forbidden, removal]).toEqual([absent, absent, absent]);
    });
  });

  it('une écriture permise passe, et compte ses commandes', async () => {
    await inRolledBack(async tx => {
      const [row] = await apply(tx, rename(SITE_A)) as { n: number }[];
      expect(row).toEqual({ n: 1 });
    });
  });
});
