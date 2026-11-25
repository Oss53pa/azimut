import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { enrolFixtureMembers } from '../fixture-membership.js';

/**
 * Migration 0085 — M02.W11 tenue par la base (décisions QB0 à QB4,
 * `docs/decoupage-barriere-validation.md`).
 *
 * Ce qui s'éprouve : la révision du graphe augmente à toute écriture d'un
 * nœud, d'une arête ou d'une liaison verticale ; la soumission d'un tableau
 * des messages est refusée sans passage du service valant pour la révision
 * actuelle, et acceptée avec ; un membre n'écrit ni la révision ni un passage.
 *
 * Le banc se connecte sous un rôle membre de celui du service, comme la CI :
 * il pose les passages « du service ». Le refus d'un poste s'éprouve par la
 * connexion de PostgREST, qui n'en est pas membre.
 *
 * Tout se fait dans des transactions annulées.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];
const POSTGREST_URI = process.env['AZIMUT_TEST_POSTGREST_DB_URI'] ?? '';
const ORG = 'a0850000-0000-4000-8000-0000000000a1';
const SITE = 'a0850000-0000-4000-8000-0000000000b1';
const BUILDING = 'a0850000-0000-4000-8000-0000000000b2';
const LEVEL = 'a0850000-0000-4000-8000-0000000000b3';
const NODE_A = 'a0850000-0000-4000-8000-0000000000e1';
const NODE_B = 'a0850000-0000-4000-8000-0000000000e2';
const EDGE = 'a0850000-0000-4000-8000-0000000000e3';
const SCHEDULE = 'a0850000-0000-4000-8000-0000000000f1';
const DESIGNER = 'a0850000-0000-4000-8000-0000000000d1';
const T = '2026-11-25T10:00:00.000Z';

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
    await tx`select set_config('azimut.current_user_id', ${DESIGNER}, true)`;
    await tx`insert into azimut.organization(id,name,slug) values (${ORG},'0085','barriere-m02-w11')`;
    await enrolFixtureMembers(text => tx.unsafe(text), [{ orgId: ORG, userId: DESIGNER, role: 'designer' }]);
    await tx`insert into azimut.site(id,org_id,name,country_code,timezone) values (${SITE},${ORG},'Site','FR','Europe/Paris')`;
    await tx`insert into azimut.building(id,org_id,site_id,name) values (${BUILDING},${ORG},${SITE},'B')`;
    await tx`insert into azimut.level(id,org_id,building_id,name,ordinal,elevation_m) values (${LEVEL},${ORG},${BUILDING},'RDC',0,0)`;
    await tx`insert into azimut.message_schedule(id,org_id,site_id,version,state,generated_at,inputs_hash)
             values (${SCHEDULE},${ORG},${SITE},1,'draft',${T},'sha256:entrees')`;
    await check(tx);
    throw done;
  }).catch((e: unknown) => { if (e !== done) throw e; });
}

async function revision(tx: postgres.TransactionSql): Promise<number> {
  const [row] = await tx<{ revision: string }[]>`select revision::text from azimut.graph_revision where site_id = ${SITE}`;
  return row === undefined ? 0 : Number(row.revision);
}

async function servicePassage(tx: postgres.TransactionSql, passed: boolean): Promise<void> {
  const blocking = passed ? 0 : 1;
  const [run] = await tx<{ id: string }[]>`
    insert into azimut.graph_validation(org_id, site_id, graph_hash, ran_at, passed, blocking_count, warning_count)
    values (${ORG}, ${SITE}, 'sha256:service', ${T}, ${passed}, ${blocking}, 0) returning id`;
  if (run === undefined) throw new Error('passage');
  await tx`select azimut.record_service_validation(${SITE}, ${await revision(tx)}::bigint, ${run.id})`;
}

async function submit(tx: postgres.TransactionSql): Promise<string> {
  try {
    await tx.savepoint(async sp => {
      await sp`update azimut.message_schedule set state = 'in_review' where id = ${SCHEDULE}`;
    });
  } catch (e: unknown) {
    const code = (e as { code?: unknown }).code;
    return typeof code === 'string' ? code : '?';
  }
  return 'accepté';
}

const graph = async (tx: postgres.TransactionSql): Promise<void> => {
  await tx`insert into azimut.node(id,org_id,level_id,kind,label,position) values
           (${NODE_A},${ORG},${LEVEL},'entrance','Entrée','{"x_m":0,"y_m":0}'),
           (${NODE_B},${ORG},${LEVEL},'junction','','{"x_m":10,"y_m":0}')`;
  await tx`insert into azimut.edge(id,org_id,from_node_id,to_node_id,length_m,width_m,slope_pct,accessible,direction)
           values (${EDGE},${ORG},${NODE_A},${NODE_B},10,1.4,0,true,'both')`;
};

describe('0085 — la révision du graphe', () => {
  it('augmente à toute écriture d’un nœud, d’une arête ou d’une liaison verticale', async () => {
    await inRolledBack(async tx => {
      expect(await revision(tx)).toBe(0);
      await graph(tx);
      expect(await revision(tx)).toBe(3);
      await tx`update azimut.node set label = 'Hall' where id = ${NODE_A}`;
      expect(await revision(tx)).toBe(4);
      await tx`insert into azimut.vertical_link(org_id, edge_id, kind, accessible) values (${ORG}, ${EDGE}, 'stair', false)`;
      expect(await revision(tx)).toBe(5);
      await tx`delete from azimut.edge where id = ${EDGE}`;
      expect(await revision(tx)).toBeGreaterThanOrEqual(6);
    });
  });
});

describe('0085 — M02.W11 : la soumission exige un passage du service pour la révision actuelle', () => {
  it('sans passage du service, refusée', async () => {
    await inRolledBack(async tx => {
      await graph(tx);
      expect(await submit(tx)).toBe('PT412');
    });
  });

  it('un passage écrit par un poste ne compte pas (QB3)', async () => {
    await inRolledBack(async tx => {
      await graph(tx);
      await tx`insert into azimut.graph_validation(org_id, site_id, graph_hash, ran_at, passed, blocking_count, warning_count)
               values (${ORG}, ${SITE}, 'sha256:poste', ${T}, true, 0, 0)`;
      expect(await submit(tx)).toBe('PT412');
    });
  });

  it('avec un passage réussi du service pour la révision actuelle, acceptée', async () => {
    await inRolledBack(async tx => {
      await graph(tx);
      await servicePassage(tx, true);
      expect(await submit(tx)).toBe('accepté');
    });
  });

  it('un graphe modifié après le passage ferme de nouveau la soumission', async () => {
    await inRolledBack(async tx => {
      await graph(tx);
      await servicePassage(tx, true);
      await tx`update azimut.node set label = 'Hall' where id = ${NODE_A}`;
      expect(await submit(tx)).toBe('PT412');
    });
  });

  it('un passage échoué ne l’ouvre pas', async () => {
    await inRolledBack(async tx => {
      await graph(tx);
      await servicePassage(tx, false);
      expect(await submit(tx)).toBe('PT412');
    });
  });
});

describe.runIf(POSTGREST_URI !== '')('0085 — un poste n’écrit ni la révision ni un passage', () => {
  it('par la connexion de PostgREST, sous le rôle des postes', async () => {
    const rest = postgres(POSTGREST_URI, { onnotice: () => undefined });
    try {
      const verdicts = await rest.begin(async tx => {
        await tx`set local role authenticated`;
        await tx`select set_config('azimut.current_user_id', ${DESIGNER}, true)`;
        const codeOf = async (run: (sp: postgres.TransactionSql) => Promise<unknown>): Promise<string> => {
          try {
            await tx.savepoint(async sp => { await run(sp); });
          } catch (e: unknown) {
            const code = (e as { code?: unknown }).code;
            return typeof code === 'string' ? code : '?';
          }
          return 'accepté';
        };
        return [
          await codeOf(sp => sp`insert into azimut.graph_revision(site_id, org_id, revision) values (${SITE}, ${ORG}, 99)`),
          await codeOf(sp => sp`select azimut.record_service_validation(${SITE}, 1, ${SITE})`),
        ];
      });
      expect(verdicts).toEqual(['42501', '42501']);
    } finally {
      await rest.end();
    }
  });
});
