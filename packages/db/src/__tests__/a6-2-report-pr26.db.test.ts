import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import type { Sql } from 'postgres';
import { randomUUID } from 'node:crypto';
import { deleteOrgFixture } from '../fixture-cleanup.js';
import { provisionStatements } from '../provision-organization.js';

/**
 * 0085, report de la PR 26 : deux règles que la chaîne appliquée n'avait pas.
 *
 *  - le bon à tirer est décidé par l'owner_rep seul : l'admin, qui produit,
 *    ne valide pas ;
 *  - `job` et `kiosk_package` ne s'écrivent que d'une session du service.
 *    Depuis l'API, un membre crée un travail en file et l'annule tant qu'il
 *    l'est (D9.2), rien d'autre.
 *
 * La seconde partie s'éprouve depuis la connexion de l'API (`authenticator`,
 * `AZIMUT_TEST_POSTGREST_DB_URI`), comme le banc d'étanchéité : c'est son rôle
 * de connexion que la garde regarde. Le décor est provisionné, jamais posé en
 * levant le cloisonnement, et ses écritures sont annulées.
 */
const dsn = process.env['AZIMUT_TEST_DATABASE_URL'] ?? '';
const apiDsn = process.env['AZIMUT_TEST_POSTGREST_DB_URI'] ?? '';
const required = (process.env['AZIMUT_REQUIRE_POSTGREST'] ?? '') !== '';

const ORG = randomUUID();
const ADMIN = randomUUID();
const DESIGNER = randomUUID();
const OWNER_REP = randomUUID();
const AUDITOR = randomUUID();
const SITE = randomUUID();
const BUILDING = randomUUID();
const LEVEL = randomUUID();
const NODE = randomUUID();
const SUPPORT = randomUUID();
const FACE = randomUUID();
const PROOF = randomUUID();

let owner: Sql;
let api: Sql | null = null;

type Tx = postgres.TransactionSql;

async function refusal(tx: Tx, attempt: () => Promise<unknown>): Promise<string> {
  try {
    await tx.savepoint(async () => { await attempt(); });
    return 'accepté';
  } catch (e: unknown) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** Une transaction annulée, ouverte sur `client`, sous l'identité de `user`. */
async function rolledBack(client: Sql, user: string, check: (tx: Tx) => Promise<void>): Promise<void> {
  const done = new Error('annulation voulue');
  await client.begin(async tx => {
    await tx`set local role authenticated`;
    const claims = JSON.stringify({ sub: user, role: 'authenticated', aal: 'aal2' });
    await tx`select set_config('request.jwt.claims', ${claims}, true)`;
    await check(tx);
    throw done;
  }).catch((e: unknown) => { if (e !== done) throw e; });
}

beforeAll(async () => {
  if (dsn === '') throw new Error('AZIMUT_TEST_DATABASE_URL absente. Voir packages/db/migrations/ORDRE.md.');
  owner = postgres(dsn, { onnotice: () => undefined });
  await owner.begin(async tx => {
    for (const text of provisionStatements({ id: ORG, name: 'R26', slug: `r26-${ORG.slice(0, 8)}`, adminId: ADMIN })) {
      await tx.unsafe(text);
    }
    await tx`set local role authenticated`;
    await tx`select set_config('azimut.current_user_id', ${ADMIN}, true)`;
    for (const [user, role] of [[DESIGNER, 'designer'], [OWNER_REP, 'owner_rep'], [AUDITOR, 'auditor']] as const) {
      await tx`select azimut.set_member(${ORG}, ${user}, ${role})`;
    }
    await tx`insert into azimut.site(id,org_id,name,country_code,timezone)
             values (${SITE},${ORG},'Site R26','FR','Europe/Paris')`;
    await tx`insert into azimut.building(id,org_id,site_id,name) values (${BUILDING},${ORG},${SITE},'Bâtiment')`;
    await tx`insert into azimut.level(id,org_id,building_id,name,ordinal,elevation_m)
             values (${LEVEL},${ORG},${BUILDING},'Niveau 0',0,0)`;
    await tx`insert into azimut.node(id,org_id,level_id,kind,position)
             values (${NODE},${ORG},${LEVEL},'junction',${tx.json({ x_m: 1, y_m: 1 })})`;
    await tx`insert into azimut.support(id,org_id,site_id,node_id,kind)
             values (${SUPPORT},${ORG},${SITE},${NODE},'totem')`;
    await tx`insert into azimut.support_face(id,org_id,support_id) values (${FACE},${ORG},${SUPPORT})`;
    await tx`insert into azimut.proof(id,org_id,face_id,version,storage_path)
             values (${PROOF},${ORG},${FACE},1,'epreuves/r26.pdf')`;
  });
  if (apiDsn !== '') api = postgres(apiDsn, { onnotice: () => undefined });
});

afterAll(async () => {
  await api?.end();
  await deleteOrgFixture(text => owner.unsafe(text), text => owner.unsafe(text), [ORG]);
  await owner.end();
});

describe('0085 : le bon à tirer est décidé par l’owner_rep seul', () => {
  const approve = (tx: Tx) => () => tx`
    insert into azimut.approval(org_id,proof_id,decision) values (${ORG},${PROOF},'approved')`;

  it('l’admin, le designer et l’auditeur sont refusés', async () => {
    for (const user of [ADMIN, DESIGNER, AUDITOR]) {
      await rolledBack(owner, user, async tx => {
        expect(await refusal(tx, approve(tx))).toMatch(/row-level security policy/);
      });
    }
  });

  it('l’owner_rep décide', async () => {
    await rolledBack(owner, OWNER_REP, async tx => {
      expect(await refusal(tx, approve(tx))).toBe('accepté');
    });
  });
});

describe.runIf(apiDsn !== '' || required)('0085 : travaux et paquets de borne, depuis l’API', () => {
  const lifecycle = /lifecycle belongs to the compiler service/;

  it('la connexion de l’API est configurée', () => {
    expect(apiDsn).not.toBe('');
  });

  it('un membre crée un travail en file, et l’annule tant qu’il l’est', async () => {
    await rolledBack(api ?? owner, ADMIN, async tx => {
      const [job] = await tx<{ id: string }[]>`
        insert into azimut.job(org_id, kind) values (${ORG}, 'build_kiosk_package') returning id`;
      expect(job).toBeDefined();
      expect(await refusal(tx, () => tx`
        update azimut.job set state = 'cancelled' where id = ${job?.id ?? ''}`)).toBe('accepté');
    });
  });

  it('un membre ne crée pas un travail déjà réussi', async () => {
    await rolledBack(api ?? owner, ADMIN, async tx => {
      expect(await refusal(tx, () => tx`
        insert into azimut.job(org_id, kind, state, result)
        values (${ORG}, 'build_kiosk_package', 'succeeded', '{}'::jsonb)`)).toMatch(/created queued/);
    });
  });

  it('un membre ne clôt, ne modifie ni ne supprime un travail', async () => {
    await rolledBack(api ?? owner, ADMIN, async tx => {
      const [job] = await tx<{ id: string }[]>`
        insert into azimut.job(org_id, kind) values (${ORG}, 'build_kiosk_package') returning id`;
      const id = job?.id ?? '';
      expect(await refusal(tx, () => tx`
        update azimut.job set state = 'succeeded', result = '{}'::jsonb where id = ${id}`)).toMatch(lifecycle);
      expect(await refusal(tx, () => tx`
        update azimut.job set state = 'cancelled', error = 'x' where id = ${id}`)).toMatch(lifecycle);
      expect(await refusal(tx, () => tx`delete from azimut.job where id = ${id}`)).toMatch(lifecycle);
    });
  });

  it('un membre n’écrit pas de paquet de borne', async () => {
    await rolledBack(api ?? owner, ADMIN, async tx => {
      expect(await refusal(tx, () => tx`
        insert into azimut.kiosk_package(org_id, site_id, version, storage_path, checksum, content_hash)
        values (${ORG}, ${SITE}, 1, 'paquets/r26.zip', 'sha256:x', 'sha256:y')`))
        .toMatch(/written by the compiler service only/);
    });
  });

  it('la session du service, elle, mène le cycle de vie', async () => {
    await rolledBack(owner, ADMIN, async tx => {
      const [job] = await tx<{ id: string }[]>`
        insert into azimut.job(org_id, kind) values (${ORG}, 'build_kiosk_package') returning id`;
      expect(await refusal(tx, () => tx`
        update azimut.job set state = 'running', attempts = 1, started_at = now()
        where id = ${job?.id ?? ''}`)).toBe('accepté');
    });
  });
});
