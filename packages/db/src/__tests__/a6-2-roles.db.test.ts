import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { provisionStatements } from '../provision-organization.js';
import { missingRolePolicies } from '../role-policies.js';

/**
 * A6.2 et T-0.5 : les membres et les rôles, éprouvés en base (0075).
 *
 * Ce qui s'éprouve :
 *  - aucune table portant `org_id` n'échappe aux politiques par rôle, et le
 *    contrôle échoue bien quand une table en manque ;
 *  - personne ne s'inscrit soi-même dans une organisation, et le refus ne dit
 *    pas si l'organisation visée existe (A6.1) ;
 *  - le dernier administrateur ne se retire ni ne se destitue (O3) ;
 *  - chacun des sept rôles lit et écrit ce qu'A6.2 lui accorde, et rien de
 *    plus ;
 *  - un utilisateur sans organisation ne voit rien (T-0.5).
 *
 * Tout se passe dans des transactions annulées. Le décor entre par le
 * provisionnement et par `azimut.set_member`, jamais en levant le
 * cloisonnement (A2.4).
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];

const ORG_A = 'a6200000-0000-0000-0000-0000000000a1';
const ORG_B = 'a6200000-0000-0000-0000-0000000000b1';
const ABSENT = 'a6200000-0000-0000-0000-0000000000f9';
const SITE = 'a6200000-0000-0000-0000-0000000005a1';
const SCHEDULE = 'a6200000-0000-0000-0000-0000000006a1';
const ADMIN_A = 'a6200000-0000-0000-0000-00000000a001';
const ADMIN_B = 'a6200000-0000-0000-0000-00000000b001';
const LONER = 'a6200000-0000-0000-0000-00000000c001';

const MEMBERS = {
  designer: 'a6200000-0000-0000-0000-00000000a002',
  owner_rep: 'a6200000-0000-0000-0000-00000000a003',
  operator: 'a6200000-0000-0000-0000-00000000a004',
  auditor: 'a6200000-0000-0000-0000-00000000a005',
  vendor: 'a6200000-0000-0000-0000-00000000a006',
  marketing: 'a6200000-0000-0000-0000-00000000a007',
} as const;

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

/** Le message d'une tentative refusée, ou « accepté ». */
async function refusal(tx: Tx, attempt: () => Promise<unknown>): Promise<string> {
  try {
    await tx.savepoint(async () => { await attempt(); });
    return 'accepté';
  } catch (e: unknown) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** Deux organisations ; dans A, un membre de chaque rôle, un site et un tableau. */
async function inRolledBack(check: (tx: Tx) => Promise<void>): Promise<void> {
  const done = new Error('annulation voulue');
  await sql.begin(async tx => {
    for (const p of [
      { id: ORG_A, name: 'A62', slug: 'a62-a', adminId: ADMIN_A },
      { id: ORG_B, name: 'B62', slug: 'a62-b', adminId: ADMIN_B },
    ]) {
      for (const text of provisionStatements(p)) await tx.unsafe(text);
    }
    await tx`set local role authenticated`;
    await as(tx, ADMIN_A);
    for (const [role, user] of Object.entries(MEMBERS)) {
      await tx`select azimut.set_member(${ORG_A}, ${user}, ${role})`;
    }
    await tx`insert into azimut.site(id,org_id,name,country_code,timezone)
             values (${SITE},${ORG_A},'Site des rôles','FR','Europe/Paris')`;
    await tx`insert into azimut.message_schedule(id,org_id,site_id,version,state,generated_at,inputs_hash)
             values (${SCHEDULE},${ORG_A},${SITE},1,'in_review',now(),'sha256:entrees')`;
    await check(tx);
    throw done;
  }).catch((e: unknown) => { if (e !== done) throw e; });
}

async function count(tx: Tx, table: string): Promise<number> {
  const [row] = await tx.unsafe<{ n: number }[]>(`select count(*)::int as n from azimut.${table}`);
  return row?.n ?? -1;
}

describe('A6.2 : chaque table portant org_id porte ses politiques par rôle', () => {
  it('aucune table n’en manque', async () => {
    expect(await missingRolePolicies(text => sql.unsafe(text))).toEqual([]);
  });

  it('une table nouvelle sans politique est signalée', async () => {
    const done = new Error('annulation voulue');
    let found: readonly string[] = [];
    await sql.begin(async tx => {
      await tx.unsafe('create table azimut.zz_a62_sans_politique (id uuid primary key, org_id uuid not null)');
      found = await missingRolePolicies(text => tx.unsafe(text));
      throw done;
    }).catch((e: unknown) => { if (e !== done) throw e; });
    expect(found).toEqual([
      'zz_a62_sans_politique role_delete', 'zz_a62_sans_politique role_insert',
      'zz_a62_sans_politique role_read', 'zz_a62_sans_politique role_update',
    ]);
  });
});

describe('A6.2 : personne ne s’inscrit soi-même', () => {
  it('l’admin de B ne s’inscrit pas dans A, ni par la table ni par la fonction', async () => {
    await inRolledBack(async tx => {
      await as(tx, ADMIN_B);
      expect(await refusal(tx, () => tx`
        insert into azimut.membership(org_id,user_id,role) values (${ORG_A},${ADMIN_B},'admin')`))
        .toMatch(/permission denied/);
      expect(await refusal(tx, () => tx`
        update azimut.membership set role = 'admin' where user_id = ${ADMIN_B}`))
        .toMatch(/permission denied/);
      expect(await refusal(tx, () => tx`select azimut.set_member(${ORG_A}, ${ADMIN_B}, 'admin')`))
        .toBe('EDIT.WRITE_REFUSED');
    });
  });

  it('le refus est le même que l’organisation existe ou non (A6.1)', async () => {
    await inRolledBack(async tx => {
      await as(tx, ADMIN_B);
      const existing = await refusal(tx, () => tx`select azimut.set_member(${ORG_A}, ${ADMIN_B}, 'admin')`);
      const absent = await refusal(tx, () => tx`select azimut.set_member(${ABSENT}, ${ADMIN_B}, 'admin')`);
      expect(existing).toBe(absent);
      expect(await refusal(tx, () => tx`select azimut.remove_member(${ORG_A}, ${ADMIN_A})`))
        .toBe(await refusal(tx, () => tx`select azimut.remove_member(${ABSENT}, ${ADMIN_A})`));
    });
  });

  it('un membre qui n’est pas admin ne se promeut pas', async () => {
    await inRolledBack(async tx => {
      await as(tx, MEMBERS.designer);
      expect(await refusal(tx, () => tx`select azimut.set_member(${ORG_A}, ${MEMBERS.designer}, 'admin')`))
        .toBe('EDIT.WRITE_REFUSED');
    });
  });

  it('une organisation se crée par la fonction, et son créateur en est l’admin', async () => {
    await inRolledBack(async tx => {
      await as(tx, LONER);
      expect(await refusal(tx, () => tx`
        insert into azimut.organization(name,slug) values ('Directe','a62-directe')`))
        .toMatch(/permission denied/);
      const [created] = await tx<{ id: string }[]>`
        select azimut.create_organization('Neuve', 'a62-neuve') as id`;
      const mine = await tx<{ role: string }[]>`
        select role from azimut.membership where org_id = ${created?.id ?? ''}`;
      expect(mine).toEqual([{ role: 'admin' }]);
      await tx`select set_config('azimut.current_user_id', '', true)`;
      expect(await refusal(tx, () => tx`select azimut.create_organization('Sans nom', 'a62-anonyme')`))
        .toBe('EDIT.WRITE_REFUSED');
    });
  });
});

describe('O3 : le dernier administrateur', () => {
  it('ne se retire pas et ne se destitue pas ; avec un second admin, il le peut', async () => {
    await inRolledBack(async tx => {
      await as(tx, ADMIN_A);
      expect(await refusal(tx, () => tx`select azimut.remove_member(${ORG_A}, ${ADMIN_A})`))
        .toBe('ACCOUNT.LAST_ADMIN');
      expect(await refusal(tx, () => tx`select azimut.set_member(${ORG_A}, ${ADMIN_A}, 'designer')`))
        .toBe('ACCOUNT.LAST_ADMIN');
      await tx`select azimut.set_member(${ORG_A}, ${MEMBERS.operator}, 'admin')`;
      expect(await refusal(tx, () => tx`select azimut.set_member(${ORG_A}, ${ADMIN_A}, 'designer')`))
        .toBe('accepté');
    });
  });
});

describe('A6.2 : ce que chaque rôle lit et écrit', () => {
  const site = (tx: Tx) => () => tx`
    insert into azimut.site(org_id,name,country_code,timezone)
    values (${ORG_A},'Second site','FR','Europe/Paris')`;

  it('lecture : vendor et marketing ne voient rien, les autres voient le site', async () => {
    await inRolledBack(async tx => {
      for (const [role, user] of Object.entries(MEMBERS)) {
        await as(tx, user);
        const seen = await count(tx, 'site');
        expect(seen, role).toBe(role === 'vendor' || role === 'marketing' ? 0 : 1);
      }
    });
  });

  it('écriture d’un site : admin, designer et operator seulement', async () => {
    await inRolledBack(async tx => {
      const writers = new Set(['designer', 'operator']);
      for (const [role, user] of Object.entries(MEMBERS)) {
        await as(tx, user);
        const outcome = await refusal(tx, site(tx));
        if (writers.has(role)) expect(outcome, role).toBe('accepté');
        else expect(outcome, role).toMatch(/row-level security/);
      }
    });
  });

  it('charte : l’admin seul l’écrit', async () => {
    await inRolledBack(async tx => {
      const charter = (tx2: Tx) => () => tx2`
        insert into azimut.charter(org_id,site_id,name,version) values (${ORG_A},${SITE},'Charte',1)`;
      await as(tx, MEMBERS.designer);
      expect(await refusal(tx, charter(tx))).toMatch(/row-level security/);
      await as(tx, ADMIN_A);
      expect(await refusal(tx, charter(tx))).toBe('accepté');
    });
  });

  it('validation d’un tableau : owner_rep seul, ni le designer ni l’admin', async () => {
    await inRolledBack(async tx => {
      const decide = () => tx`
        insert into azimut.message_schedule_approval(org_id,schedule_id,decision,inputs_hash)
        values (${ORG_A},${SCHEDULE},'approved','sha256:entrees')`;
      for (const user of [MEMBERS.designer, ADMIN_A, MEMBERS.auditor]) {
        await as(tx, user);
        expect(await refusal(tx, decide), user).toMatch(/row-level security/);
      }
      await as(tx, MEMBERS.owner_rep);
      expect(await refusal(tx, decide)).toBe('accepté');
    });
  });

  it('membres : l’admin et l’auditeur voient l’organisation entière, les autres leur seule ligne', async () => {
    await inRolledBack(async tx => {
      await as(tx, MEMBERS.auditor);
      expect(await count(tx, 'membership')).toBe(7);
      await as(tx, MEMBERS.designer);
      expect(await count(tx, 'membership')).toBe(1);
    });
  });

  it('organisation : seul l’admin la modifie', async () => {
    await inRolledBack(async tx => {
      await as(tx, MEMBERS.designer);
      const touched = await tx`update azimut.organization set name = 'Renommée' where id = ${ORG_A}`;
      expect(touched.count).toBe(0);
      await as(tx, ADMIN_A);
      const renamed = await tx`update azimut.organization set name = 'Renommée' where id = ${ORG_A}`;
      expect(renamed.count).toBe(1);
    });
  });
});

describe('T-0.5 : un utilisateur sans organisation ne voit rien', () => {
  it('ni organisation, ni membre, ni site, ni journal', async () => {
    await inRolledBack(async tx => {
      await as(tx, LONER);
      for (const table of ['organization', 'membership', 'site', 'message_schedule', 'audit_log', 'job']) {
        expect(await count(tx, table), table).toBe(0);
      }
    });
  });
});
