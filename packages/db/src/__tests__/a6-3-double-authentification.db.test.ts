import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { provisionStatements } from '../provision-organization.js';

/**
 * A6.3, O3 et T-0.5 : la double authentification et l'identité, en base (0080).
 *
 * Une requête de l'API porte ses revendications dans `request.jwt.claims`,
 * comme PostgREST les pose. L'essai les pose de même, sous `authenticated`.
 *
 * Ce qui s'éprouve :
 *  - l'identité d'une requête de l'API est celle du jeton, jamais celle d'un
 *    réglage de session posé à côté ;
 *  - un `admin` ou un `owner_rep` en `aal1` ne lit ni n'écrit rien de son
 *    organisation, et ne voit que sa propre inscription ;
 *  - le même en `aal2` retrouve ses droits ; un `designer` n'en a pas besoin ;
 *  - un connecté sans organisation ne voit rien (T-0.5).
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];

const ORG = 'a6500000-0000-0000-0000-0000000000a1';
const ADMIN = 'a6500000-0000-0000-0000-00000000a001';
const DESIGNER = 'a6500000-0000-0000-0000-00000000a002';
const OWNER_REP = 'a6500000-0000-0000-0000-00000000a003';
const LONER = 'a6500000-0000-0000-0000-00000000c001';
const OTHER = 'a6500000-0000-0000-0000-00000000f001';
const SITE = 'a6500000-0000-0000-0000-0000000001a1';
const SCHEDULE = 'a6500000-0000-0000-0000-0000000006a1';

let sql: postgres.Sql;

beforeAll(() => {
  if (URL === undefined || URL === '') {
    throw new Error('AZIMUT_TEST_DATABASE_URL absente. Voir packages/db/migrations/ORDRE.md.');
  }
  sql = postgres(URL, { onnotice: () => undefined });
});

afterAll(async () => { await sql.end(); });

type Tx = postgres.TransactionSql;

/** Une requête de l'API : le jeton de `user`, au niveau d'assurance donné. */
async function api(tx: Tx, user: string, aal: 'aal1' | 'aal2'): Promise<void> {
  const claims = JSON.stringify({ sub: user, role: 'authenticated', aal });
  await tx`select set_config('request.jwt.claims', ${claims}, true)`;
}

async function refusal(tx: Tx, attempt: () => Promise<unknown>): Promise<string> {
  try {
    await tx.savepoint(async () => { await attempt(); });
    return 'accepté';
  } catch (e: unknown) {
    return e instanceof Error ? e.message : String(e);
  }
}

async function count(tx: Tx, table: string): Promise<number> {
  const [row] = await tx.unsafe<{ n: number }[]>(`select count(*)::int as n from azimut.${table}`);
  return row?.n ?? -1;
}

/** Une organisation, son admin, un designer, un owner_rep, un site et un tableau en revue. */
async function inRolledBack(check: (tx: Tx) => Promise<void>): Promise<void> {
  const done = new Error('annulation voulue');
  await sql.begin(async tx => {
    for (const text of provisionStatements({ id: ORG, name: 'A65', slug: 'a65', adminId: ADMIN })) {
      await tx.unsafe(text);
    }
    await tx`set local role authenticated`;
    await tx`select set_config('azimut.current_user_id', ${ADMIN}, true)`;
    await tx`select azimut.set_member(${ORG}, ${DESIGNER}, 'designer')`;
    await tx`select azimut.set_member(${ORG}, ${OWNER_REP}, 'owner_rep')`;
    await tx`insert into azimut.site(id,org_id,name,country_code,timezone)
             values (${SITE},${ORG},'Site','FR','Europe/Paris')`;
    await tx`insert into azimut.message_schedule(id,org_id,site_id,version,state,generated_at,inputs_hash)
             values (${SCHEDULE},${ORG},${SITE},1,'in_review',now(),'sha256:entrees')`;
    await check(tx);
    throw done;
  }).catch((e: unknown) => { if (e !== done) throw e; });
}

describe('A6.3 : l’identité d’une requête de l’API est celle de son jeton', () => {
  it('un réglage de session posé à côté du jeton est ignoré', async () => {
    await inRolledBack(async tx => {
      await tx`select set_config('azimut.current_user_id', ${ADMIN}, true)`;
      await api(tx, OTHER, 'aal2');
      const [row] = await tx`select azimut.current_user_id()::text as id, azimut.session_is_strong() as strong`;
      expect(row).toEqual({ id: OTHER, strong: true });
      expect(await count(tx, 'site')).toBe(0);
    });
  });

  it('sans jeton, la connexion directe garde son identité et sa force', async () => {
    await inRolledBack(async tx => {
      const [row] = await tx`select azimut.current_user_id()::text as id, azimut.session_is_strong() as strong`;
      expect(row).toEqual({ id: ADMIN, strong: true });
    });
  });
});

describe('A6.3 et O3 : admin et owner_rep exigent un second facteur', () => {
  it('un admin en aal1 ne lit rien, ne voit que sa propre inscription, n’administre rien', async () => {
    await inRolledBack(async tx => {
      await api(tx, ADMIN, 'aal1');
      expect(await count(tx, 'site')).toBe(0);
      expect(await count(tx, 'organization')).toBe(0);
      const own = await tx`select role from azimut.membership`;
      expect(own).toEqual([{ role: 'admin' }]);
      expect(await refusal(tx, () => tx`select azimut.set_member(${ORG}, ${OTHER}, 'designer')`))
        .toBe('EDIT.WRITE_REFUSED');
      expect(await refusal(tx, () => tx`select azimut.create_vendor(${ORG}, 'Fabricant')`))
        .toBe('EDIT.WRITE_REFUSED');
      const renamed = await tx`update azimut.site set name = 'x' where id = ${SITE} returning id`;
      expect(renamed).toHaveLength(0);
    });
  });

  it('le même admin en aal2 retrouve ses droits', async () => {
    await inRolledBack(async tx => {
      await api(tx, ADMIN, 'aal2');
      expect(await count(tx, 'site')).toBe(1);
      await tx`select azimut.set_member(${ORG}, ${OTHER}, 'designer')`;
      expect(await count(tx, 'membership')).toBe(4);
    });
  });

  it('un owner_rep en aal1 ne valide pas ; en aal2, il valide', async () => {
    await inRolledBack(async tx => {
      const approve = () => tx`
        insert into azimut.message_schedule_approval(org_id,schedule_id,decision,inputs_hash)
        values (${ORG},${SCHEDULE},'approved','sha256:entrees')`;
      await api(tx, OWNER_REP, 'aal1');
      expect(await refusal(tx, approve)).toMatch(/row-level security/);
      await api(tx, OWNER_REP, 'aal2');
      expect(await refusal(tx, approve)).toBe('accepté');
    });
  });

  it('un designer n’a pas besoin du second facteur', async () => {
    await inRolledBack(async tx => {
      await api(tx, DESIGNER, 'aal1');
      expect(await count(tx, 'site')).toBe(1);
      const renamed = await tx`update azimut.site set name = 'Renommé' where id = ${SITE} returning id`;
      expect(renamed).toHaveLength(1);
    });
  });

  it('créer une organisation exige une session forte', async () => {
    await inRolledBack(async tx => {
      await api(tx, LONER, 'aal1');
      expect(await refusal(tx, () => tx`select azimut.create_organization('Nouvelle', 'a65-nouvelle')`))
        .toBe('EDIT.WRITE_REFUSED');
      await api(tx, LONER, 'aal2');
      expect(await refusal(tx, () => tx`select azimut.create_organization('Nouvelle', 'a65-nouvelle')`))
        .toBe('accepté');
    });
  });
});

describe('T-0.5 : un connecté sans organisation ne voit rien', () => {
  it('aucune ligne, sur aucune table d’organisation, même en aal2', async () => {
    await inRolledBack(async tx => {
      await api(tx, LONER, 'aal2');
      for (const table of ['organization', 'membership', 'site', 'message_schedule', 'audit_log', 'job', 'vendor']) {
        expect(await count(tx, table), table).toBe(0);
      }
    });
  });
});
