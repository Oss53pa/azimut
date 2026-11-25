import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  createConnection, createDb, enrolFixtureMembers, loadSiteSnapshotAs, recordServicePassage,
} from '@azimut/db';
import { createAuditSiteJobHandler } from '../audit-site-job.js';
import type { Job } from '../job.js';

/**
 * B3, décisions QB0 et QB2 — le travail `audit_site` du service inscrit le
 * passage de validation du graphe et l'enregistre (0085), ce qui ouvre la
 * soumission du tableau des messages ; une modification du graphe la referme.
 *
 * Le banc se connecte sous un rôle membre de celui du service, comme le
 * service lui-même.
 *
 * Décor qui ne se retire pas : `graph_validation` est en insertion seule. Un
 * site neuf par exécution, dans une organisation d'essai que `db:reset` seul
 * retire.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'] ?? '';
const ORG = 'b3000000-0000-4000-8000-0000000000a1';
const DESIGNER = 'b3000000-0000-4000-8000-0000000000d1';
const SITE = randomUUID();
const BUILDING = randomUUID();
const LEVEL = randomUUID();
const ENTRANCE = randomUUID();
const JUNCTION = randomUUID();
const EDGE = randomUUID();
const SCHEDULE = randomUUID();
const T = '2026-11-25T10:00:00.000Z';

let client: ReturnType<typeof createConnection>;
let db: ReturnType<typeof createDb>;

function job(payload: Record<string, unknown>): Job {
  return {
    id: randomUUID(), org_id: ORG, kind: 'audit_site', state: 'running', payload, result: null,
    attempts: 1, max_attempts: 3, created_at: new Date(T), started_at: new Date(T), finished_at: null,
    error: null, requested_by: DESIGNER,
  };
}

const handler = () => createAuditSiteJobHandler({
  loadSnapshot: (orgId, siteId, requester) => loadSiteSnapshotAs(db, requester, orgId, siteId),
  recordPassage: (requester, passage) => recordServicePassage(db, requester, passage),
  now: () => new Date(T),
});

/** La soumission du tableau, sous l'identité du concepteur, annulée. */
async function submit(): Promise<string> {
  const done = new Error('annulation voulue');
  let verdict = 'accepté';
  await client.begin(async tx => {
    await tx`select set_config('azimut.current_user_id', ${DESIGNER}, true)`;
    await tx`set local role authenticated`;
    try {
      await tx.savepoint(async sp => {
        await sp`update azimut.message_schedule set state = 'in_review' where id = ${SCHEDULE}`;
      });
    } catch (e: unknown) {
      const code = (e as { code?: unknown }).code;
      verdict = typeof code === 'string' ? code : '?';
    }
    throw done;
  }).catch((e: unknown) => { if (e !== done) throw e; });
  return verdict;
}

describe.runIf(URL !== '')('B3 — le travail audit_site inscrit le passage du service', () => {
  beforeAll(async () => {
    client = createConnection(URL);
    db = createDb(URL);
    await client.unsafe('alter table azimut.organization no force row level security');
    await client`insert into azimut.organization(id,name,slug) values (${ORG},'B3','b3-audit-site')
                 on conflict (id) do nothing`;
    await client.unsafe('alter table azimut.organization force row level security');
    await enrolFixtureMembers(text => client.unsafe(text), [{ orgId: ORG, userId: DESIGNER, role: 'designer' }]);
    await client.begin(async tx => {
      await tx`select set_config('azimut.current_user_id', ${DESIGNER}, true)`;
      await tx`insert into azimut.site(id,org_id,name,country_code,timezone) values (${SITE},${ORG},'Site B3','FR','Europe/Paris')`;
      await tx`insert into azimut.building(id,org_id,site_id,name) values (${BUILDING},${ORG},${SITE},'B')`;
      await tx`insert into azimut.level(id,org_id,building_id,name,ordinal,elevation_m) values (${LEVEL},${ORG},${BUILDING},'RDC',0,0)`;
      await tx`insert into azimut.node(id,org_id,level_id,kind,label,position) values
               (${ENTRANCE},${ORG},${LEVEL},'entrance','Entrée','{"x_m":0,"y_m":0}'),
               (${JUNCTION},${ORG},${LEVEL},'junction','','{"x_m":10,"y_m":0}')`;
      await tx`insert into azimut.edge(id,org_id,from_node_id,to_node_id,length_m,width_m,slope_pct,accessible,direction)
               values (${EDGE},${ORG},${ENTRANCE},${JUNCTION},10,1.4,0,true,'both')`;
      await tx`insert into azimut.message_schedule(id,org_id,site_id,version,state,generated_at,inputs_hash)
               values (${SCHEDULE},${ORG},${SITE},1,'draft',${T},'sha256:entrees')`;
    });
  });

  afterAll(async () => {
    await client.end();
    await db.$client.end();
  });

  it('sans passage, la soumission est refusée', async () => {
    expect(await submit()).toBe('PT412');
  });

  it('le travail sans site désigné échoue sans rien écrire', async () => {
    await expect(handler()(job({}))).rejects.toThrow(/site_id/);
    expect(await submit()).toBe('PT412');
  });

  it('le travail valide, inscrit et enregistre le passage, et le rapport le dit', async () => {
    const result = await handler()(job({ site_id: SITE, mode: 'atelier' }));
    const passage = result['graph_validation'] as { passed: boolean; revision: number; graph_hash: string };
    expect(passage.revision).toBeGreaterThan(0);
    expect(passage.graph_hash).toMatch(/^sha256:/);
    // Une entrée reliée à un carrefour : deux avertissements, aucune anomalie
    // bloquante. Le passage est réussi, et la soumission s'ouvre.
    expect(passage.passed).toBe(true);
    expect(await submit()).toBe('accepté');
  });

  it('une modification du graphe referme la soumission jusqu’au passage suivant', async () => {
    await client.begin(async tx => {
      await tx`select set_config('azimut.current_user_id', ${DESIGNER}, true)`;
      await tx`update azimut.node set label = 'Hall' where id = ${ENTRANCE}`;
    });
    expect(await submit()).toBe('PT412');
    const result = await handler()(job({ site_id: SITE }));
    expect((result['graph_validation'] as { passed: boolean }).passed).toBe(true);
    expect(await submit()).toBe('accepté');
  });
});
