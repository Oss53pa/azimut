import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { provisionStatements } from '../provision-organization.js';

/**
 * D-5 et D-6 (0081) : les seuils en configuration, et les espaces de stockage.
 *
 * Le stockage n'existe que sur une plateforme qui le fournit. L'essai pose,
 * dans une transaction annulée, le strict nécessaire de ses deux tables, puis
 * appelle `azimut.install_storage()` comme la migration le fait : ce sont les
 * politiques réelles qui sont éprouvées.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];

const ORG_A = 'd5600000-0000-0000-0000-0000000000a1';
const ORG_B = 'd5600000-0000-0000-0000-0000000000b1';
const ADMIN_A = 'd5600000-0000-0000-0000-00000000a001';
const DESIGNER_A = 'd5600000-0000-0000-0000-00000000a002';
const AUDITOR_A = 'd5600000-0000-0000-0000-00000000a005';
const VENDOR_A = 'd5600000-0000-0000-0000-00000000a006';
const ADMIN_B = 'd5600000-0000-0000-0000-00000000b001';

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

async function failure(tx: Tx, attempt: () => Promise<unknown>): Promise<string> {
  try {
    await tx.savepoint(async () => { await attempt(); });
    return 'accepté';
  } catch (e: unknown) {
    return e instanceof Error ? e.message : String(e);
  }
}

async function inRolledBack(check: (tx: Tx) => Promise<void>, withStorage = false): Promise<void> {
  const done = new Error('annulation voulue');
  await sql.begin(async tx => {
    if (withStorage) {
      await tx.unsafe(`
        create schema storage;
        create table storage.buckets (id text primary key, name text, public boolean,
          file_size_limit bigint, allowed_mime_types text[]);
        create table storage.objects (id uuid primary key default gen_random_uuid(),
          bucket_id text references storage.buckets(id), name text not null);
        alter table storage.objects enable row level security;
        grant usage on schema storage to authenticated;
        grant select on storage.buckets to authenticated;
        grant select, insert, update, delete on storage.objects to authenticated;`);
      await tx`select azimut.install_storage()`;
    }
    for (const p of [
      { id: ORG_A, name: 'A56', slug: 'd56-a', adminId: ADMIN_A },
      { id: ORG_B, name: 'B56', slug: 'd56-b', adminId: ADMIN_B },
    ]) {
      for (const text of provisionStatements(p)) await tx.unsafe(text);
    }
    await tx`set local role authenticated`;
    await as(tx, ADMIN_A);
    await tx`select azimut.set_member(${ORG_A}, ${DESIGNER_A}, 'designer')`;
    await tx`select azimut.set_member(${ORG_A}, ${AUDITOR_A}, 'auditor')`;
    await tx`select azimut.set_member(${ORG_A}, ${VENDOR_A}, 'vendor')`;
    await check(tx);
    throw done;
  }).catch((e: unknown) => { if (e !== done) throw e; });
}

const value = async (tx: Tx, org: string, key: string): Promise<string | null> => {
  const [row] = await tx<{ v: string | null }[]>`select azimut.security_setting_value(${org}, ${key})::text as v`;
  return row?.v ?? null;
};

describe('D-5 : les seuils sont des données, communes et resserrables par organisation', () => {
  it('se lisent, ne s’écrivent pas, et une clé inconnue ne rend rien', async () => {
    await inRolledBack(async tx => {
      expect(await value(tx, ORG_A, 'plan.max_bytes')).toBe('62914560');
      expect(await value(tx, ORG_A, 'inconnue.cle')).toBeNull();
      expect(await failure(tx, () => tx`update azimut.security_setting set value = 0`)).toMatch(/permission denied/);
    });
  });

  it('l’admin resserre une clé surchargeable, jamais ne la relâche', async () => {
    await inRolledBack(async tx => {
      await tx`insert into azimut.org_security_setting(org_id,key,value) values (${ORG_A},'asset.svg.max_bytes',1000)`;
      expect(await value(tx, ORG_A, 'asset.svg.max_bytes')).toBe('1000');
      expect(await failure(tx, () => tx`
        update azimut.org_security_setting set value = 999999999 where org_id = ${ORG_A}`)).toBe('EDIT.WRITE_REFUSED');
      expect(await failure(tx, () => tx`
        insert into azimut.org_security_setting(org_id,key,value) values (${ORG_A},'plan.max_bytes',1)`)).toBe('EDIT.WRITE_REFUSED');
    });
  });

  it('un designer ne surcharge rien, et B ne voit pas la surcharge de A', async () => {
    await inRolledBack(async tx => {
      await tx`insert into azimut.org_security_setting(org_id,key,value) values (${ORG_A},'asset.svg.max_bytes',1000)`;
      await as(tx, DESIGNER_A);
      expect(await failure(tx, () => tx`
        insert into azimut.org_security_setting(org_id,key,value) values (${ORG_A},'pdf.max_pages',10)`)).toMatch(/row-level security/);
      await as(tx, ADMIN_B);
      expect(await value(tx, ORG_A, 'asset.svg.max_bytes')).toBe('5242880');
    });
  });
});

describe('D-6 : quatre espaces privés, cloisonnés par le premier segment du chemin', () => {
  const put = (tx: Tx, bucket: string, name: string) =>
    () => tx`insert into storage.objects(bucket_id, name) values (${bucket}, ${name})`;
  const seen = async (tx: Tx): Promise<number> => {
    const [row] = await tx<{ n: number }[]>`select count(*)::int as n from storage.objects`;
    return row?.n ?? -1;
  };

  it('les espaces sont privés et bornés par les seuils', async () => {
    await inRolledBack(async tx => {
      const rows = await tx`select id, public, file_size_limit::text as max from storage.buckets order by id`;
      expect(rows).toEqual([
        { id: 'azimut-creatives', public: false, max: '52428800' },
        { id: 'azimut-deliveries', public: false, max: '524288000' },
        { id: 'azimut-plans', public: false, max: '62914560' },
        { id: 'azimut-proofs', public: false, max: '104857600' },
      ]);
    }, true);
  });

  it('un designer dépose un plan dans son organisation, et nulle part ailleurs', async () => {
    await inRolledBack(async tx => {
      await as(tx, DESIGNER_A);
      expect(await failure(tx, put(tx, 'azimut-plans', `${ORG_A}/site/plan-1/plan.pdf`))).toBe('accepté');
      expect(await failure(tx, put(tx, 'azimut-plans', `${ORG_B}/site/plan-1/plan.pdf`))).toMatch(/row-level security/);
      expect(await failure(tx, put(tx, 'azimut-deliveries', `${ORG_A}/site/p/paquet.zip`))).toMatch(/row-level security/);
      expect(await failure(tx, put(tx, 'autre-espace', `${ORG_A}/x`))).toMatch(/row-level security|foreign key/);
    }, true);
  });

  it('B ne lit rien de A ; l’auditeur lit sans déposer ; le vendor sans lot ne lit pas les plans', async () => {
    await inRolledBack(async tx => {
      await as(tx, DESIGNER_A);
      await put(tx, 'azimut-plans', `${ORG_A}/site/plan-1/plan.pdf`)();
      await as(tx, ADMIN_B);
      expect(await seen(tx)).toBe(0);
      await as(tx, AUDITOR_A);
      expect(await seen(tx)).toBe(1);
      expect(await failure(tx, put(tx, 'azimut-plans', `${ORG_A}/site/plan-2/plan.pdf`))).toMatch(/row-level security/);
      await as(tx, VENDOR_A);
      expect(await seen(tx)).toBe(0);
    }, true);
  });

  it('un fichier ne se réécrit pas, et seul l’admin le supprime', async () => {
    await inRolledBack(async tx => {
      await as(tx, DESIGNER_A);
      await put(tx, 'azimut-plans', `${ORG_A}/site/plan-1/plan.pdf`)();
      const renamed = await tx`update storage.objects set name = ${`${ORG_A}/site/plan-1/autre.pdf`} returning id`;
      expect(renamed).toHaveLength(0);
      const removedByDesigner = await tx`delete from storage.objects returning id`;
      expect(removedByDesigner).toHaveLength(0);
      await as(tx, ADMIN_A);
      const removedByAdmin = await tx`delete from storage.objects returning id`;
      expect(removedByAdmin).toHaveLength(1);
    }, true);
  });
});
