import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { enrolFixtureMembers } from '../fixture-membership.js';

/**
 * A6.2 et R2 (partie R) — les rôles appliqués par la base (0076).
 *
 * Chaque essai monte son décor dans une transaction annulée, sous le rôle
 * `authenticated`, en changeant d'identité par `azimut.current_user_id`.
 *
 * Pour `approval`, aucune épreuve n'est montée : une insertion admise par la
 * politique s'arrête ensuite sur la clé étrangère `proof_id`. Le motif du refus
 * suffit donc à dire qui a refusé — la politique (« row-level security ») ou
 * la contrainte (« foreign key »), qui ne s'évalue qu'une fois la politique
 * passée.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];

const ORG = 'a6200000-0000-0000-0000-0000000000a0';
const SITE = 'a6200000-0000-0000-0000-0000000005a1';
const SCHEDULE = 'a6200000-0000-0000-0000-00000000c0a1';
const ADMIN = 'a6200000-0000-0000-0000-0000000000a1';
const OWNER_REP = 'a6200000-0000-0000-0000-0000000000a2';
const DESIGNER = 'a6200000-0000-0000-0000-0000000000a3';
const AUDITOR = 'a6200000-0000-0000-0000-0000000000a4';
const NO_PROOF = 'a6200000-0000-0000-0000-00000000dead';

const RLS = /row-level security/;

let sql: postgres.Sql;

beforeAll(() => {
  if (URL === undefined || URL === '') {
    throw new Error('AZIMUT_TEST_DATABASE_URL absente. Voir packages/db/migrations/ORDRE.md.');
  }
  sql = postgres(URL, { onnotice: () => undefined });
});

afterAll(async () => { await sql.end(); });

type Tx = postgres.TransactionSql;

/** Le décor, puis l'essai sous `authenticated`, puis l'annulation de tout. */
async function inRolledBack(check: (tx: Tx, as: (userId: string) => Promise<void>) => Promise<void>): Promise<void> {
  const done = new Error('annulation voulue');
  await sql.begin(async tx => {
    await tx`select set_config('azimut.current_user_id', ${ADMIN}, true)`;
    await tx`insert into azimut.organization(id,name,slug) values (${ORG},'A62','a62-roles')`;
    await enrolFixtureMembers(text => tx.unsafe(text), [
      { orgId: ORG, userId: ADMIN, role: 'admin' },
      { orgId: ORG, userId: OWNER_REP, role: 'owner_rep' },
      { orgId: ORG, userId: DESIGNER, role: 'designer' },
      { orgId: ORG, userId: AUDITOR, role: 'auditor' },
    ]);
    await tx`set local role authenticated`;
    await tx`insert into azimut.site(id,org_id,name,country_code,timezone)
             values (${SITE},${ORG},'Site A62','FR','Europe/Paris')`;
    await tx`insert into azimut.message_schedule(id,org_id,site_id,version,state,generated_at,inputs_hash)
             values (${SCHEDULE},${ORG},${SITE},1,'in_review',now(),'sha256:entrees')`;
    const as = async (userId: string): Promise<void> => {
      await tx`select set_config('azimut.current_user_id', ${userId}, true)`;
    };
    await check(tx, as);
    throw done;
  }).catch((e: unknown) => { if (e !== done) throw e; });
}

/** Le motif du refus, ou « accepté ». */
async function refusal(tx: Tx, run: () => Promise<unknown>): Promise<string> {
  try {
    await tx.savepoint(async () => { await run(); });
  } catch (e: unknown) {
    return e instanceof Error ? e.message : String(e);
  }
  return 'accepté';
}

describe('A6.2 — auditor : lecture seule intégrale, aucune écriture', () => {
  it('lit le site de son organisation', async () => {
    await inRolledBack(async (tx, as) => {
      await as(AUDITOR);
      expect(await tx`select id from azimut.site where id = ${SITE}`).toHaveLength(1);
    });
  });

  it('n’insère rien', async () => {
    await inRolledBack(async (tx, as) => {
      await as(AUDITOR);
      expect(await refusal(tx, () => tx`insert into azimut.site(org_id,name,country_code,timezone)
        values (${ORG},'Intrus','FR','Europe/Paris')`)).toMatch(RLS);
    });
  });

  it('ne modifie ni ne supprime rien', async () => {
    await inRolledBack(async (tx, as) => {
      await as(AUDITOR);
      expect((await tx`update azimut.site set name = 'Modifié' where id = ${SITE}`).count).toBe(0);
      expect((await tx`update azimut.organization set name = 'Modifiée' where id = ${ORG}`).count).toBe(0);
      expect((await tx`delete from azimut.message_schedule where id = ${SCHEDULE}`).count).toBe(0);
      await as(ADMIN);
      expect((await tx`select name from azimut.site where id = ${SITE}`)[0]?.['name']).toBe('Site A62');
    });
  });

  it('les autres rôles écrivent toujours', async () => {
    await inRolledBack(async (tx, as) => {
      await as(DESIGNER);
      expect((await tx`update azimut.site set name = 'Renommé' where id = ${SITE}`).count).toBe(1);
    });
  });
});

describe('A6.2 — bon à tirer : owner_rep seul, en son propre nom', () => {
  const decide = (tx: Tx, reviewer: string) => () => tx`
    insert into azimut.approval(org_id, proof_id, decision, reviewer_id)
    values (${ORG}, ${NO_PROOF}, 'approved', ${reviewer})`;

  it('designer : refusé par la politique (« pas de validation »)', async () => {
    await inRolledBack(async (tx, as) => {
      await as(DESIGNER);
      expect(await refusal(tx, decide(tx, DESIGNER))).toMatch(RLS);
    });
  });

  it('auditor : refusé par la politique', async () => {
    await inRolledBack(async (tx, as) => {
      await as(AUDITOR);
      expect(await refusal(tx, decide(tx, AUDITOR))).toMatch(RLS);
    });
  });

  it('owner_rep : la politique laisse passer, seule l’épreuve absente arrête', async () => {
    await inRolledBack(async (tx, as) => {
      await as(OWNER_REP);
      expect(await refusal(tx, decide(tx, OWNER_REP))).toMatch(/foreign key/);
    });
  });

  it('admin : refusé, celui qui produit ne valide pas (0077)', async () => {
    await inRolledBack(async (tx, as) => {
      await as(ADMIN);
      expect(await refusal(tx, decide(tx, ADMIN))).toMatch(RLS);
    });
  });

  it('personne ne décide au nom d’un autre', async () => {
    await inRolledBack(async (tx, as) => {
      await as(OWNER_REP);
      expect(await refusal(tx, decide(tx, ADMIN))).toMatch(RLS);
    });
  });
});

describe('R2 (partie R) — tableau des messages : owner_rep seul approuve', () => {
  const approve = (tx: Tx) => () => tx`
    insert into azimut.message_schedule_approval(org_id, schedule_id, decision, inputs_hash)
    values (${ORG}, ${SCHEDULE}, 'approved', 'sha256:entrees')`;

  it('admin et designer, qui génèrent, n’approuvent pas', async () => {
    await inRolledBack(async (tx, as) => {
      for (const user of [ADMIN, DESIGNER]) {
        await as(user);
        expect(await refusal(tx, approve(tx)), user).toMatch(RLS);
      }
    });
  });

  it('owner_rep approuve', async () => {
    await inRolledBack(async (tx, as) => {
      await as(OWNER_REP);
      expect(await refusal(tx, approve(tx))).toBe('accepté');
    });
  });
});

describe('A12.3 — une entrée de journal est écrite au nom de son auteur', () => {
  const log = (tx: Tx, actor: string | null) => () => tx`
    insert into azimut.audit_log(org_id, actor_id, action, entity)
    values (${ORG}, ${actor}, 'essai', 'site')`;

  it('à son propre nom : accepté', async () => {
    await inRolledBack(async (tx, as) => {
      await as(DESIGNER);
      expect(await refusal(tx, log(tx, DESIGNER))).toBe('accepté');
    });
  });

  it('au nom d’un autre, ou de personne : refusé', async () => {
    await inRolledBack(async (tx, as) => {
      await as(DESIGNER);
      expect(await refusal(tx, log(tx, ADMIN))).toMatch(RLS);
      expect(await refusal(tx, log(tx, null))).toMatch(RLS);
    });
  });

  it('l’auditor n’écrit pas au journal, même à son nom', async () => {
    await inRolledBack(async (tx, as) => {
      await as(AUDITOR);
      expect(await refusal(tx, log(tx, AUDITOR))).toMatch(RLS);
    });
  });
});

describe('0076 — toute table portant org_id refuse l’écriture à l’auditor', () => {
  // Les tables en insertion seule (A12.3) l'écartent dans leur unique
  // politique d'insertion, éprouvée plus haut ; elles ne portent aucune
  // politique de modification ni de suppression.
  it('trois politiques restrictives par table, lues dans le catalogue', async () => {
    const missing = await sql<{ relname: string }[]>`
      select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attname = 'org_id' and not a.attisdropped
      where n.nspname = 'azimut' and c.relkind in ('r','p')
        and c.relname not in ('approval','audit_log','graph_validation','message_schedule_approval')
        and (select count(*) from pg_policy p
             where p.polrelid = c.oid and not p.polpermissive
               and p.polname in (c.relname || '_auditor_no_insert',
                                 c.relname || '_auditor_no_update',
                                 c.relname || '_auditor_no_delete')) <> 3
      order by c.relname`;
    expect(missing.map(r => r.relname)).toEqual([]);
  });
});
