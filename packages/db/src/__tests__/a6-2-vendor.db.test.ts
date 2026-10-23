import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { provisionStatements } from '../provision-organization.js';

/**
 * A6.2 et M07.C2 : les tests dédiés du rôle `vendor` (0077).
 *
 * « Lecture des exécutions du seul lot qui lui est rattaché, dépôt
 * d'épreuves. » « Un prestataire ne voit aucune exécution hors de son lot, y
 * compris par canal indirect. »
 *
 * Décor, dans A : deux fabricants X et Y, un lot chacun, un support par lot,
 * une face et une épreuve par support, et sur le support de X une version
 * approuvée et un brouillon. V1 est rattaché à X, V2 à Y, V3 à aucun. B a son
 * admin. Tout se passe dans des transactions annulées, sous `authenticated`.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];

const ORG_A = 'a6300000-0000-0000-0000-0000000000a1';
const ORG_B = 'a6300000-0000-0000-0000-0000000000b1';
const ADMIN_A = 'a6300000-0000-0000-0000-00000000a001';
const DESIGNER_A = 'a6300000-0000-0000-0000-00000000a002';
const V1 = 'a6300000-0000-0000-0000-00000000a011';
const V2 = 'a6300000-0000-0000-0000-00000000a012';
const V3 = 'a6300000-0000-0000-0000-00000000a013';
const ADMIN_B = 'a6300000-0000-0000-0000-00000000b001';
const ABSENT = 'a6300000-0000-0000-0000-0000000000f9';

const SITE = 'a6300000-0000-0000-0000-0000000001a1';
const BUILDING = 'a6300000-0000-0000-0000-0000000002a1';
const LEVEL = 'a6300000-0000-0000-0000-0000000003a1';
const NODE = 'a6300000-0000-0000-0000-0000000004a1';
const S1 = 'a6300000-0000-0000-0000-0000000005a1';
const S2 = 'a6300000-0000-0000-0000-0000000005a2';
const F1 = 'a6300000-0000-0000-0000-0000000006a1';
const F2 = 'a6300000-0000-0000-0000-0000000006a2';
const P1 = 'a6300000-0000-0000-0000-0000000007a1';
const P2 = 'a6300000-0000-0000-0000-0000000007a2';
const V_APPROVED = 'a6300000-0000-0000-0000-0000000008a1';
const V_DRAFT = 'a6300000-0000-0000-0000-0000000008a2';
const L1 = 'a6300000-0000-0000-0000-0000000009a1';
const L2 = 'a6300000-0000-0000-0000-0000000009a2';

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

async function ids(tx: Tx, table: string): Promise<readonly string[]> {
  const rows = await tx.unsafe<{ id: string }[]>(`select id::text from azimut.${table} order by id`);
  return rows.map(r => r.id);
}

async function inRolledBack(check: (tx: Tx, vendors: { x: string; y: string }) => Promise<void>): Promise<void> {
  const done = new Error('annulation voulue');
  await sql.begin(async tx => {
    for (const p of [
      { id: ORG_A, name: 'A63', slug: 'a63-a', adminId: ADMIN_A },
      { id: ORG_B, name: 'B63', slug: 'a63-b', adminId: ADMIN_B },
    ]) {
      for (const text of provisionStatements(p)) await tx.unsafe(text);
    }
    await tx`set local role authenticated`;
    await as(tx, ADMIN_A);
    await tx`select azimut.set_member(${ORG_A}, ${DESIGNER_A}, 'designer')`;
    for (const v of [V1, V2, V3]) await tx`select azimut.set_member(${ORG_A}, ${v}, 'vendor')`;
    const [x] = await tx<{ id: string }[]>`select azimut.create_vendor(${ORG_A}, 'Fabricant X') as id`;
    const [y] = await tx<{ id: string }[]>`select azimut.create_vendor(${ORG_A}, 'Fabricant Y') as id`;
    const vendors = { x: x?.id ?? '', y: y?.id ?? '' };
    await tx`select azimut.attach_vendor_member(${vendors.x}, ${V1})`;
    await tx`select azimut.attach_vendor_member(${vendors.y}, ${V2})`;

    await tx`insert into azimut.site(id,org_id,name,country_code,timezone) values (${SITE},${ORG_A},'Site','FR','Europe/Paris')`;
    await tx`insert into azimut.building(id,org_id,site_id,name) values (${BUILDING},${ORG_A},${SITE},'Bâtiment')`;
    await tx`insert into azimut.level(id,org_id,building_id,name,ordinal,elevation_m) values (${LEVEL},${ORG_A},${BUILDING},'Niveau 0',0,0)`;
    await tx`insert into azimut.node(id,org_id,level_id,kind,position)
             values (${NODE},${ORG_A},${LEVEL},'junction',${tx.json({ x_m: 1, y_m: 1 })})`;
    for (const [s, f, p, lot, vendor, code] of [
      [S1, F1, P1, L1, vendors.x, 'L1'], [S2, F2, P2, L2, vendors.y, 'L2'],
    ] as const) {
      await tx`insert into azimut.support(id,org_id,site_id,node_id,kind) values (${s},${ORG_A},${SITE},${NODE},'totem')`;
      await tx`insert into azimut.support_face(id,org_id,support_id) values (${f},${ORG_A},${s})`;
      await tx`insert into azimut.proof(id,org_id,face_id,version,storage_path) values (${p},${ORG_A},${f},1,'epreuves/x.pdf')`;
      await tx`insert into azimut.fabrication_lot(id,org_id,site_id,code,manufacturer_name,vendor_id)
               values (${lot},${ORG_A},${SITE},${code},'Fabricant',${vendor})`;
      await tx`insert into azimut.lot_support(org_id,lot_id,support_id) values (${ORG_A},${lot},${s})`;
    }
    await tx`insert into azimut.support_version(id,org_id,support_id,version,state) values (${V_APPROVED},${ORG_A},${S1},1,'approved')`;
    await tx`insert into azimut.support_version(id,org_id,support_id,version,state) values (${V_DRAFT},${ORG_A},${S1},2,'draft')`;
    await check(tx, vendors);
    throw done;
  }).catch((e: unknown) => { if (e !== done) throw e; });
}

describe('A6.2 : le vendor rattaché voit son lot, et rien d’autre', () => {
  it('lit son fabricant, son lot, ses supports, ses faces, ses exécutions approuvées et ses épreuves', async () => {
    await inRolledBack(async (tx, vendors) => {
      await as(tx, V1);
      expect(await ids(tx, 'vendor')).toEqual([vendors.x]);
      expect(await ids(tx, 'fabrication_lot')).toEqual([L1]);
      expect(await ids(tx, 'support')).toEqual([S1]);
      expect(await ids(tx, 'support_face')).toEqual([F1]);
      expect(await ids(tx, 'support_version')).toEqual([V_APPROVED]);
      expect(await ids(tx, 'proof')).toEqual([P1]);
      const [link] = await tx`select count(*)::int as n from azimut.lot_support`;
      expect(link).toEqual({ n: 1 });
    });
  });

  it('ne voit rien du reste de l’organisation, ni des membres, ni de B', async () => {
    await inRolledBack(async tx => {
      await as(tx, V1);
      for (const table of ['site', 'building', 'level', 'node', 'approval', 'message_schedule', 'job', 'audit_log']) {
        expect(await ids(tx, table), table).toEqual([]);
      }
      const [m] = await tx`select count(*)::int as n from azimut.membership`;
      expect(m).toEqual({ n: 1 });
      const [vm] = await tx`select count(*)::int as n from azimut.vendor_member`;
      expect(vm).toEqual({ n: 1 });
      const [org] = await tx`select count(*)::int as n from azimut.organization where id = ${ORG_B}`;
      expect(org).toEqual({ n: 0 });
    });
  });

  it('un vendor non rattaché ne voit rien', async () => {
    await inRolledBack(async tx => {
      await as(tx, V3);
      for (const table of ['vendor', 'fabrication_lot', 'lot_support', 'support', 'support_face', 'support_version', 'proof']) {
        expect(await ids(tx, table), table).toEqual([]);
      }
    });
  });

  it('le lot de l’autre fabricant ne se lit pas, même par son identifiant', async () => {
    await inRolledBack(async tx => {
      await as(tx, V1);
      const [row] = await tx`
        select (select count(*)::int from azimut.fabrication_lot where id = ${L2}) as lot,
               (select count(*)::int from azimut.support_face where id = ${F2}) as face,
               (select count(*)::int from azimut.proof where face_id = ${F2}) as proof`;
      expect(row).toEqual({ lot: 0, face: 0, proof: 0 });
    });
  });
});

describe('A6.2 : le vendor dépose une épreuve sur son lot, et n’écrit rien d’autre', () => {
  it('dépose une épreuve en attente sur une face de son lot', async () => {
    await inRolledBack(async tx => {
      await as(tx, V1);
      await tx`insert into azimut.proof(org_id,face_id,version,storage_path) values (${ORG_A},${F1},2,'epreuves/v2.pdf')`;
      expect(await ids(tx, 'proof')).toHaveLength(2);
    });
  });

  it('le refus sur la face d’un autre lot est celui d’une face absente', async () => {
    await inRolledBack(async tx => {
      await as(tx, V1);
      const deposit = (face: string) => () => tx`
        insert into azimut.proof(org_id,face_id,version,storage_path) values (${ORG_A},${face},2,'epreuves/v2.pdf')`;
      const other = await failure(tx, deposit(F2), [F2, ABSENT]);
      expect(other).toMatch(/^42501 \| new row violates row-level security/);
      expect(other).toBe(await failure(tx, deposit(ABSENT), [F2, ABSENT]));
    });
  });

  it('ne dépose pas une épreuve déjà décidée', async () => {
    await inRolledBack(async tx => {
      await as(tx, V1);
      expect(await failure(tx, () => tx`
        insert into azimut.proof(org_id,face_id,version,storage_path,status) values (${ORG_A},${F1},2,'e.pdf','approved')`))
        .toMatch(/^42501 \| new row violates row-level security/);
    });
  });

  it('ne modifie ni son lot, ni ses épreuves, ni ne valide', async () => {
    await inRolledBack(async tx => {
      await as(tx, V1);
      const lot = await tx`update azimut.fabrication_lot set state = 'delivered' where id = ${L1} returning id`;
      const proof = await tx`update azimut.proof set storage_path = 'autre.pdf' where id = ${P1} returning id`;
      expect([lot.length, proof.length]).toEqual([0, 0]);
      expect(await failure(tx, () => tx`
        insert into azimut.approval(org_id,proof_id,decision,reviewer_id) values (${ORG_A},${P1},'approved',${V1})`))
        .toMatch(/^42501 \| new row violates row-level security/);
    });
  });
});

describe('A6.2 : le rattachement est réservé à l’admin', () => {
  it('personne n’écrit directement un fabricant ni un rattachement', async () => {
    await inRolledBack(async (tx, vendors) => {
      await as(tx, ADMIN_A);
      expect(await failure(tx, () => tx`insert into azimut.vendor(org_id,name) values (${ORG_A},'Z')`))
        .toMatch(/permission denied/);
      expect(await failure(tx, () => tx`
        insert into azimut.vendor_member(org_id,vendor_id,user_id) values (${ORG_A},${vendors.x},${V3})`))
        .toMatch(/permission denied/);
    });
  });

  it('un designer, ou le vendor lui-même, ne rattache pas', async () => {
    await inRolledBack(async (tx, vendors) => {
      for (const user of [DESIGNER_A, V3]) {
        await as(tx, user);
        expect(await failure(tx, () => tx`select azimut.attach_vendor_member(${vendors.x}, ${V3})`))
          .toBe('42501 | EDIT.WRITE_REFUSED');
      }
    });
  });

  it('l’admin ne rattache qu’un compte au rôle vendor', async () => {
    await inRolledBack(async (tx, vendors) => {
      await as(tx, ADMIN_A);
      expect(await failure(tx, () => tx`select azimut.attach_vendor_member(${vendors.x}, ${DESIGNER_A})`))
        .toBe('42501 | EDIT.WRITE_REFUSED');
    });
  });

  it('l’admin de B est refusé de même que le fabricant existe ou non', async () => {
    await inRolledBack(async (tx, vendors) => {
      await as(tx, ADMIN_B);
      const existing = await failure(tx, () => tx`select azimut.attach_vendor_member(${vendors.x}, ${ADMIN_B})`);
      const absent = await failure(tx, () => tx`select azimut.attach_vendor_member(${ABSENT}, ${ADMIN_B})`);
      expect(existing).toBe('42501 | EDIT.WRITE_REFUSED');
      expect(existing).toBe(absent);
      expect(await failure(tx, () => tx`select azimut.create_vendor(${ORG_A}, 'Intrus')`))
        .toBe('42501 | EDIT.WRITE_REFUSED');
    });
  });

  it('détaché, le vendor ne voit plus rien', async () => {
    await inRolledBack(async (tx, vendors) => {
      await as(tx, ADMIN_A);
      await tx`select azimut.detach_vendor_member(${vendors.x}, ${V1})`;
      await as(tx, V1);
      expect(await ids(tx, 'fabrication_lot')).toEqual([]);
      expect(await ids(tx, 'proof')).toEqual([]);
    });
  });
});
