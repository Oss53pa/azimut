import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createConnection, createDb, deleteOrgFixture } from '@azimut/db';
import { DbWorkerQueue, REQUESTER_CANNOT_READ } from '../db-queue.js';
import { processNextJob } from '../worker.js';
import type { JobHandler } from '../worker.js';

/**
 * T-0.11 et D9.2 — la file des travaux en base (migration 0071), contre la
 * base réelle et sous `FORCE ROW LEVEL SECURITY`.
 *
 * Acceptation de T-0.11 : un travail factice s'exécute, échoue, est rejoué
 * sans effet de bord, et laisse une trace complète. S'y ajoute ce que la
 * prise entre organisations doit garantir : le service prend les travaux de
 * toutes, mais ne lit chacun que sous son demandeur, et ni `authenticated` ni
 * le rôle du service n'ont d'autre accès à la file.
 *
 * Les travaux sont créés par leurs demandeurs, sous leur propre identité.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];

const USER_A = 'a0110000-0000-0000-0000-0000000000a1';
const USER_B = 'a0110000-0000-0000-0000-0000000000b1';
const USER_LEFT = 'a0110000-0000-0000-0000-0000000000c1';
const ORG_A = 'a0110000-0000-0000-0000-00000000a0a0';
const ORG_B = 'a0110000-0000-0000-0000-00000000b0b0';

const T0 = Date.parse('2026-10-03T08:00:00.000Z');
const at = (seconds: number): Date => new Date(T0 + seconds * 1000);

let client: ReturnType<typeof createConnection>;
let db: ReturnType<typeof createDb>;

type Row = Readonly<Record<string, unknown>>;
type Run = (text: string, params?: readonly string[]) => Promise<readonly Row[]>;

/** Une transaction sous un rôle donné, et, pour `authenticated`, une identité. */
async function within(
  role: 'authenticated' | 'azimut_compiler',
  userId: string | null,
  statements: (run: Run) => Promise<readonly Row[]>,
): Promise<readonly Row[]> {
  const rows: Row[] = [];
  await client.begin(async (tx) => {
    await tx.unsafe(`set local role ${role}`);
    if (userId !== null) {
      await tx.unsafe(`select set_config('azimut.current_user_id', $1, true)`, [userId]);
    }
    rows.push(...await statements(async (text, params = []) => [...await tx.unsafe(text, [...params])]));
  });
  return rows;
}

const asUser = (userId: string, statements: (run: Run) => Promise<readonly Row[]>) =>
  within('authenticated', userId, statements);

function only(rows: readonly Row[]): Row {
  const first = rows[0];
  if (first === undefined) throw new Error('aucune ligne');
  return first;
}

async function enqueue(userId: string, orgId: string, payload: Record<string, unknown>): Promise<string> {
  const rows = await asUser(userId, run => run(`
    insert into azimut.job(org_id, kind, payload)
    values ($1, 'audit_site', $2::text::jsonb)
    returning id`, [orgId, JSON.stringify(payload)]));
  return String(only(rows)['id']);
}

async function jobAs(userId: string, jobId: string): Promise<Row> {
  return only(await asUser(userId, run => run(`
    select state, attempts, error, result from azimut.job where id = $1`, [jobId])));
}

/** Le message d'une tentative refusée, ou « accepté ». */
async function attempt(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return 'accepté';
  } catch (e: unknown) {
    const cause = e instanceof Error && e.cause instanceof Error ? e.cause.message : '';
    return `${e instanceof Error ? e.message : String(e)} ${cause}`;
  }
}

function queue(): DbWorkerQueue {
  return new DbWorkerQueue(db, { maxAttempts: 3 });
}

beforeAll(async () => {
  if (URL === undefined || URL === '') {
    throw new Error('AZIMUT_TEST_DATABASE_URL absente. Voir packages/db/migrations/ORDRE.md.');
  }
  client = createConnection(URL);
  db = createDb(URL);
  await deleteOrgFixture(text => client.unsafe(text), text => client.unsafe(text), [ORG_A, ORG_B]);

  for (const [user, org, slug] of [[USER_A, ORG_A, 't011-a'], [USER_B, ORG_B, 't011-b']] as const) {
    await asUser(user, run => run(
      'insert into azimut.organization(id,name,slug) values ($1, $2, $2)', [org, slug]));
    await asUser(user, run => run(
      `insert into azimut.membership(org_id,user_id,role) values ($1, $2, 'admin')`, [org, user]));
  }
});

afterAll(async () => {
  await deleteOrgFixture(text => client.unsafe(text), text => client.unsafe(text), [ORG_A, ORG_B]);
  await client.end();
  await db.$client.end();
});

describe('T-0.11 — le service prend les travaux de toutes les organisations', () => {
  it('chaque travail est lu et clos sous son demandeur', async () => {
    const jobA = await enqueue(USER_A, ORG_A, { marque: 'a' });
    const jobB = await enqueue(USER_B, ORG_B, { marque: 'b' });
    const q = queue();

    const first = await q.dequeue(at(0));
    const second = await q.dequeue(at(0));
    expect([first?.id, second?.id]).toEqual([jobA, jobB]);
    expect(first?.payload).toEqual({ marque: 'a' });
    expect(second?.payload).toEqual({ marque: 'b' });
    expect(second?.requested_by).toBe(USER_B);
    expect(first?.attempts).toBe(1);
    expect(await q.dequeue(at(0))).toBeNull();

    await q.markSucceeded(jobA, { fait: 'a' }, at(1));
    await q.markSucceeded(jobB, { fait: 'b' }, at(1));
    expect(await jobAs(USER_A, jobA)).toMatchObject({ state: 'succeeded', result: { fait: 'a' } });
    expect(await jobAs(USER_B, jobB)).toMatchObject({ state: 'succeeded', result: { fait: 'b' } });
  });

  it('un travail factice échoue, est rejoué après la temporisation, et laisse sa trace', async () => {
    const jobId = await enqueue(USER_A, ORG_A, { essai: 'rejeu' });
    let calls = 0;
    const handler: JobHandler = async () => {
      calls += 1;
      if (calls === 1) throw new Error('échec voulu');
      return { appels: calls };
    };
    const options = (now: Date) => ({
      queue: queue(), handlers: new Map([['audit_site', handler]]), now: () => now,
    });

    expect(await processNextJob(options(at(10)))).toBe(true);
    expect(await jobAs(USER_A, jobId))
      .toMatchObject({ state: 'queued', attempts: 1, error: 'échec voulu' });

    // D9.2 : cinq secondes avant la deuxième tentative.
    expect(await processNextJob(options(at(14)))).toBe(false);
    expect(await processNextJob(options(at(15)))).toBe(true);

    expect(await jobAs(USER_A, jobId))
      .toMatchObject({ state: 'succeeded', attempts: 2, error: null, result: { appels: 2 } });
    const count = only(await asUser(USER_A, run => run(`
      select count(*)::int as n from azimut.job
      where org_id = $1 and payload->>'essai' = 'rejeu'`, [ORG_A])));
    expect(count['n']).toBe(1);
  });

  it('les tentatives épuisées, le travail est en échec', async () => {
    const jobId = await enqueue(USER_B, ORG_B, { essai: 'épuisement' });
    const q = queue();
    for (const second of [100, 105, 135]) {
      const job = await q.dequeue(at(second));
      expect(job?.id).toBe(jobId);
      await q.markFailed(jobId, `essai ${second}`, at(second));
    }
    expect(await q.dequeue(at(1000))).toBeNull();
    expect(await jobAs(USER_B, jobId))
      .toMatchObject({ state: 'failed', attempts: 3, error: 'essai 135' });
  });

  it('un travail sans progression est relevé, et sa clôture tardive ne touche pas la reprise', async () => {
    const jobId = await enqueue(USER_A, ORG_A, { essai: 'stagnation' });
    const slow = queue();
    const other = queue();

    expect((await slow.dequeue(at(200)))?.id).toBe(jobId);
    expect(await other.reapStalled(at(200 + 29 * 60))).toEqual([]);
    expect(await other.reapStalled(at(200 + 30 * 60))).toEqual([jobId]);
    expect(await jobAs(USER_A, jobId))
      .toMatchObject({ state: 'queued', attempts: 1, error: 'stalled: no progress for 30 minutes' });

    const retry = await other.dequeue(at(200 + 30 * 60 + 5));
    expect(retry?.attempts).toBe(2);
    await slow.markSucceeded(jobId, { tardif: true }, at(200 + 31 * 60));
    expect(await jobAs(USER_A, jobId)).toMatchObject({ state: 'running', attempts: 2 });

    await other.markSucceeded(jobId, { reprise: true }, at(200 + 31 * 60));
    expect(await jobAs(USER_A, jobId))
      .toMatchObject({ state: 'succeeded', attempts: 2, result: { reprise: true } });
  });

  it('un demandeur parti de l’organisation : le travail est abandonné, avec la raison', async () => {
    await asUser(USER_LEFT, run => run(
      `insert into azimut.membership(org_id,user_id,role) values ($1, $2, 'designer')`,
      [ORG_A, USER_LEFT]));
    const jobId = await enqueue(USER_LEFT, ORG_A, { essai: 'départ' });
    await asUser(USER_LEFT, run => run(
      'delete from azimut.membership where org_id = $1 and user_id = $2', [ORG_A, USER_LEFT]));

    expect(await queue().dequeue(at(300))).toBeNull();
    expect(await jobAs(USER_A, jobId))
      .toMatchObject({ state: 'failed', attempts: 1, error: REQUESTER_CANNOT_READ });
  });
});

describe('T-0.11 — nul autre accès à la file', () => {
  it('un utilisateur n’exécute aucune fonction de prise', async () => {
    for (const call of [
      `select * from azimut.job_claim(now(), '{5}'::integer[])`,
      'select * from azimut.job_stalled(now(), 1)',
      `select azimut.job_abandon(gen_random_uuid(), now(), 'x')`,
    ]) {
      expect(await attempt(() => asUser(USER_A, run => run(call))))
        .toMatch(/permission denied for function/);
    }
  });

  it('le rôle du service ne lit ni n’écrit la table', async () => {
    for (const statement of [
      'select id from azimut.job',
      `update azimut.job set state = 'cancelled'`,
    ]) {
      expect(await attempt(() => within('azimut_compiler', null, run => run(statement))))
        .toMatch(/permission denied for table job/);
    }
  });
});
