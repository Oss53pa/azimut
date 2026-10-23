import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { provisionStatements } from '../provision-organization.js';

/**
 * A6.1 et A6.2 : l'essai d'abus du lot 3, partie 2 (0076).
 *
 * Un connecté de B vise une ligne de A par clé étrangère, à l'insertion et à
 * la mise à jour : il est refusé exactement comme s'il visait un identifiant
 * absent, et ne compte rien de A. Les signatures sont celles de l'utilisateur
 * courant, quoi que l'appelant fournisse. Une validation d'`owner_rep` atteint
 * son épreuve, et seulement elle.
 *
 * Tout se passe dans des transactions annulées, sous `authenticated` ; le
 * décor entre par le provisionnement et `azimut.set_member` (A2.4).
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];

const ORG_A = 'a6100000-0000-0000-0000-0000000000a1';
const ORG_B = 'a6100000-0000-0000-0000-0000000000b1';
const ADMIN_A = 'a6100000-0000-0000-0000-00000000a001';
const OWNER_REP_A = 'a6100000-0000-0000-0000-00000000a003';
const ADMIN_B = 'a6100000-0000-0000-0000-00000000b001';
const OWNER_REP_B = 'a6100000-0000-0000-0000-00000000b003';
const FORGED = 'a6100000-0000-0000-0000-00000000f001';
const ABSENT = 'a6100000-0000-0000-0000-0000000000f9';

const SITE_A = 'a6100000-0000-0000-0000-0000000001a1';
const BUILDING_A = 'a6100000-0000-0000-0000-0000000002a1';
const LEVEL_A = 'a6100000-0000-0000-0000-0000000003a1';
const NODE_A = 'a6100000-0000-0000-0000-0000000004a1';
const SUPPORT_A = 'a6100000-0000-0000-0000-0000000005a1';
const FACE_A = 'a6100000-0000-0000-0000-0000000006a1';
const PROOF_A = 'a6100000-0000-0000-0000-0000000007a1';
const SITE_B = 'a6100000-0000-0000-0000-0000000001b1';
const BUILDING_B = 'a6100000-0000-0000-0000-0000000002b1';

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

/**
 * Ce qu'un refus laisse voir à l'appelant : code, message et détail, où les
 * deux identifiants comparés sont ramenés au même jeton. Deux refus égaux par
 * ce biais ne se distinguent que par la valeur que l'appelant a lui-même
 * fournie.
 */
async function failure(tx: Tx, ids: readonly string[], attempt: () => Promise<unknown>): Promise<string> {
  try {
    await tx.savepoint(async () => { await attempt(); });
    return 'accepté';
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string; detail?: string };
    const text = `${err.code ?? ''} | ${err.message ?? ''} | ${err.detail ?? ''}`;
    return ids.reduce((acc, id) => acc.replaceAll(id, '<id>'), text);
  }
}

/** A : un admin, un owner_rep et une épreuve en attente ; B : un admin, un owner_rep, un site. */
async function inRolledBack(check: (tx: Tx) => Promise<void>): Promise<void> {
  const done = new Error('annulation voulue');
  await sql.begin(async tx => {
    for (const p of [
      { id: ORG_A, name: 'A61', slug: 'a61-a', adminId: ADMIN_A },
      { id: ORG_B, name: 'B61', slug: 'a61-b', adminId: ADMIN_B },
    ]) {
      for (const text of provisionStatements(p)) await tx.unsafe(text);
    }
    await tx`set local role authenticated`;
    await as(tx, ADMIN_A);
    await tx`select azimut.set_member(${ORG_A}, ${OWNER_REP_A}, 'owner_rep')`;
    await tx`insert into azimut.site(id,org_id,name,country_code,timezone)
             values (${SITE_A},${ORG_A},'Site A','FR','Europe/Paris')`;
    await tx`insert into azimut.building(id,org_id,site_id,name) values (${BUILDING_A},${ORG_A},${SITE_A},'Bâtiment A')`;
    await tx`insert into azimut.level(id,org_id,building_id,name,ordinal,elevation_m)
             values (${LEVEL_A},${ORG_A},${BUILDING_A},'Niveau 0',0,0)`;
    await tx`insert into azimut.node(id,org_id,level_id,kind,position)
             values (${NODE_A},${ORG_A},${LEVEL_A},'junction',${tx.json({ x_m: 1, y_m: 1 })})`;
    await tx`insert into azimut.support(id,org_id,site_id,node_id,kind)
             values (${SUPPORT_A},${ORG_A},${SITE_A},${NODE_A},'totem')`;
    await tx`insert into azimut.support_face(id,org_id,support_id) values (${FACE_A},${ORG_A},${SUPPORT_A})`;
    await tx`insert into azimut.proof(id,org_id,face_id,version,storage_path)
             values (${PROOF_A},${ORG_A},${FACE_A},1,'epreuves/a.pdf')`;
    await as(tx, ADMIN_B);
    await tx`select azimut.set_member(${ORG_B}, ${OWNER_REP_B}, 'owner_rep')`;
    await tx`insert into azimut.site(id,org_id,name,country_code,timezone)
             values (${SITE_B},${ORG_B},'Site B','FR','Europe/Paris')`;
    await tx`insert into azimut.building(id,org_id,site_id,name) values (${BUILDING_B},${ORG_B},${SITE_B},'Bâtiment B')`;
    await check(tx);
    throw done;
  }).catch((e: unknown) => { if (e !== done) throw e; });
}

describe('A6.1 : une ligne de A ne se vise pas par clé étrangère depuis B', () => {
  it('à l’insertion, le refus est celui d’un identifiant absent', async () => {
    await inRolledBack(async tx => {
      const insert = (siteId: string) => () => tx`
        insert into azimut.building(org_id,site_id,name) values (${ORG_B},${siteId},'Intrus')`;
      const foreign = await failure(tx, [SITE_A, ABSENT], insert(SITE_A));
      const absent = await failure(tx, [SITE_A, ABSENT], insert(ABSENT));
      expect(foreign).toMatch(/^23503 \| /);
      expect(foreign).toBe(absent);
    });
  });

  it('à la mise à jour, de même', async () => {
    await inRolledBack(async tx => {
      const update = (siteId: string) => () => tx`
        update azimut.building set site_id = ${siteId} where id = ${BUILDING_B}`;
      const foreign = await failure(tx, [SITE_A, ABSENT], update(SITE_A));
      const absent = await failure(tx, [SITE_A, ABSENT], update(ABSENT));
      expect(foreign).toMatch(/^23503 \| /);
      expect(foreign).toBe(absent);
    });
  });

  it('une validation de B ne vise pas l’épreuve de A', async () => {
    await inRolledBack(async tx => {
      // Le bon à tirer est décidé par l'owner_rep seul (0085).
      await as(tx, OWNER_REP_B);
      const approve = (proofId: string) => () => tx`
        insert into azimut.approval(org_id,proof_id,decision,reviewer_id) values (${ORG_B},${proofId},'approved',${OWNER_REP_B})`;
      const foreign = await failure(tx, [PROOF_A, ABSENT], approve(PROOF_A));
      const absent = await failure(tx, [PROOF_A, ABSENT], approve(ABSENT));
      expect(foreign).toMatch(/^23503 \| /);
      expect(foreign).toBe(absent);
    });
  });

  it('B ne lit ni ne compte rien de A', async () => {
    await inRolledBack(async tx => {
      const [row] = await tx<{ sites: number; proofs: number }[]>`
        select (select count(*)::int from azimut.site where org_id = ${ORG_A}) as sites,
               (select count(*)::int from azimut.proof) as proofs`;
      expect(row).toEqual({ sites: 0, proofs: 0 });
    });
  });
});

describe('A6.2 : la validation d’un owner_rep atteint son épreuve', () => {
  it('l’épreuve passe à approuvée, signée par le validateur réel', async () => {
    await inRolledBack(async tx => {
      await as(tx, OWNER_REP_A);
      await tx`insert into azimut.approval(org_id,proof_id,decision,reviewer_id)
               values (${ORG_A},${PROOF_A},'approved',${FORGED})`;
      const [approval] = await tx`select reviewer_id from azimut.approval where proof_id = ${PROOF_A}`;
      const [proof] = await tx`select status, reviewer_id from azimut.proof where id = ${PROOF_A}`;
      expect(approval).toEqual({ reviewer_id: OWNER_REP_A });
      expect(proof).toEqual({ status: 'approved', reviewer_id: OWNER_REP_A });
    });
  });

  it('sans utilisateur courant, la validation est refusée', async () => {
    await inRolledBack(async tx => {
      await tx`select set_config('azimut.current_user_id', '', true)`;
      expect(await failure(tx, [], () => tx`
        insert into azimut.approval(org_id,proof_id,decision,reviewer_id) values (${ORG_A},${PROOF_A},'approved',${FORGED})`))
        .toMatch(/^42501 \| EDIT\.WRITE_REFUSED/);
    });
  });
});

describe('A6.2 : les signatures sont celles de l’utilisateur courant', () => {
  it('une annotation insérée close porte son auteur et son clôturant réels', async () => {
    await inRolledBack(async tx => {
      await as(tx, ADMIN_A);
      const [note] = await tx`
        insert into azimut.review_annotation(org_id,site_id,support_face_id,state,body,author_id,resolved_by,resolved_at)
        values (${ORG_A},${SITE_A},${FACE_A},'resolved','Corriger',${FORGED},${FORGED},'2000-01-01')
        returning id, author_id, resolved_by`;
      expect(note).toMatchObject({ author_id: ADMIN_A, resolved_by: ADMIN_A });

      await tx`update azimut.review_annotation set author_id = ${FORGED}, resolved_by = ${FORGED}
               where id = ${String(note?.['id'])}`;
      const [after] = await tx`select author_id, resolved_by from azimut.review_annotation where id = ${String(note?.['id'])}`;
      expect(after).toEqual({ author_id: ADMIN_A, resolved_by: ADMIN_A });

      const [reply] = await tx`
        insert into azimut.review_annotation_reply(org_id,annotation_id,body,author_id)
        values (${ORG_A},${String(note?.['id'])},'Fait',${FORGED}) returning author_id`;
      expect(reply).toEqual({ author_id: ADMIN_A });
    });
  });

  it('un calque d’esquisse porte son auteur et le garde', async () => {
    await inRolledBack(async tx => {
      await as(tx, ADMIN_A);
      const [layer] = await tx`
        insert into azimut.sketch_layer(org_id,site_id,level_id,name,owner_id)
        values (${ORG_A},${SITE_A},${LEVEL_A},'Calque',${FORGED}) returning id, owner_id`;
      expect(layer?.['owner_id']).toBe(ADMIN_A);
      await tx`update azimut.sketch_layer set owner_id = ${FORGED} where id = ${String(layer?.['id'])}`;
      const [after] = await tx`select owner_id from azimut.sketch_layer where id = ${String(layer?.['id'])}`;
      expect(after).toEqual({ owner_id: ADMIN_A });
    });
  });
});
