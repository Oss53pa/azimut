import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createConnection, createDb, applyCommands, enrolFixtureMembers, withFixtureRole } from '@azimut/db';
import { startPostgrest, signToken, installPlatformStubs } from '@azimut/db/harness';
import type { Harness } from '@azimut/db/harness';
import type { ColumnValue, EntityCommand, Outcome } from '@azimut/core-model';
import { validateGraph } from '@azimut/engine-graph';
import { createPostgrestRepository } from '../../data/postgrest-repository.js';
import { setAccessTokenSource } from '../../auth/access-token.js';
import { sessionFromSite } from '../session-from-site.js';
import { flushQueue, writeToSession } from '../session-store.js';
import type { SessionState } from '../session-store.js';
import { createJournaledSink } from '../journaled-sink.js';
import {
  follow, isJournaledWrite, readJournalHead, readJournalSince, recordOwnWrite, startCursor,
} from '../journal-follower.js';
import type { JournalCursor } from '../journal-follower.js';
import { applyReceived, canReceive } from '../journal-session.js';
import { acquireLock } from '../object-lock-client.js';
import { graphScopeFromSession } from '../session-scope.js';
import { comparable } from '../undo-conflict.js';
import { readSessionGraph } from '../session-graph.js';
import { updateNodeCommands } from '../graph-update-commands.js';
import type { SinkConfig } from '../postgrest-sink.js';

/**
 * S6.10 — l'essai de convergence à deux clients, sur l'instance autonome que
 * monte la chaîne (A3.4 : PostgreSQL et PostgREST, sans plateforme), par les
 * fonctions que `useTrancheSession` et `useJournalFollow` assemblent.
 *
 * Quatre épreuves, et une exigence : l'égalité stricte des états finaux —
 * chaque poste, sans relecture finale, porte exactement les lignes de la base.
 *
 *  1. séquences concurrentes, tirées d'une graine fixe (aucun tirage du
 *     moteur, A9) : chaque poste écrit sur ce qu'il croit, parfois sans avoir
 *     lu l'autre ; un refus 409 le fait relire, comme l'atelier ;
 *  2. coupure réseau : un poste écrit hors ligne, sa file part au retour ;
 *     une file en conflit n'est ni fusionnée ni perdue (S6.9, L4.4) ;
 *  3. verrou expiré : le verrou d'un poste coupé tombe, l'autre écrit, et le
 *     premier, revenu, est refusé puis relit ;
 *  4. incohérence topologique provoquée : une arête retirée laisse un nœud
 *     orphelin ; le poste qui reçoit la commande le voit, et la base refuse
 *     l'émission du tableau des messages (0085).
 *
 * **Décor qui ne se retire pas** (journal et passages en insertion seule) :
 * un site neuf par exécution, dans une organisation d'essai que `db:reset`
 * seul retire.
 */
const dsn = process.env['AZIMUT_TEST_DATABASE_URL'] ?? '';
const postgrestBinary = process.env['AZIMUT_TEST_POSTGREST'] ?? '';
const postgrestDbUri = process.env['AZIMUT_TEST_POSTGREST_DB_URI'] ?? '';
const jwtSecret = process.env['AZIMUT_TEST_JWT_SECRET'] ?? '';
const runnable = dsn !== '' && postgrestBinary !== '' && existsSync(postgrestBinary)
  && postgrestDbUri !== '' && jwtSecret !== '';

const ORG = 'd6a00000-0000-4000-8000-0000000000a1';
const POSTE_A = 'd6a00000-0000-4000-8000-0000000000d1';
const POSTE_B = 'd6a00000-0000-4000-8000-0000000000d2';
const SITE = randomUUID();
const BUILDING = randomUUID();
const LEVEL = randomUUID();
const [ENTRANCE, J1, J2, J3] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const [E1, E2, E3] = [randomUUID(), randomUUID(), randomUUID()];
const SCHEDULE = randomUUID();
const T = '2026-11-25T10:00:00.000Z';
const API_KEY = 'cle-publiable-du-banc';
const TABLES = ['building', 'node', 'edge'] as const;

type Poste = {
  readonly userId: string;
  readonly config: SinkConfig;
  session: SessionState;
  cursor: JournalCursor;
};

let client: ReturnType<typeof createConnection>;
let db: ReturnType<typeof createDb>;
let rest: Harness;
let a: Poste;
let b: Poste;

/** Un tirage reproductible : congruence linéaire, graine fixe. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; };
}

async function siteOf(userId: string): Promise<SessionState> {
  const release = setAccessTokenSource(() => signToken(userId));
  try {
    return sessionFromSite(await createPostgrestRepository({ url: rest.url, apiKey: API_KEY, schema: 'azimut' }).loadSite(SITE));
  } finally {
    release();
  }
}

/** Ce que fait `resync` : la tête d'abord, le site ensuite. */
async function resync(poste: Poste): Promise<void> {
  const head = await readJournalHead(poste.config, SITE);
  if (head === null) throw new Error('tête illisible');
  poste.session = await siteOf(poste.userId);
  poste.cursor = startCursor(SITE, head);
}

function send(poste: Poste) {
  const sink = createJournaledSink(poste.config, { siteId: SITE, levelId: null });
  return async (cmds: readonly EntityCommand[]): Promise<Outcome<unknown>> => {
    const out = await sink(cmds);
    if (out.ok && isJournaledWrite(out.value)) poste.cursor = recordOwnWrite(poste.cursor, out.value);
    return out;
  };
}

/** Un geste : la session, l'envoi, et la relecture sur refus 409. */
async function write(poste: Poste, commands: readonly EntityCommand[]): Promise<string> {
  const result = await writeToSession(poste.session, commands, send(poste));
  poste.session = result.state;
  const cause = result.refused?.[0]?.params['cause'];
  if (cause === '409') await resync(poste);
  return result.refused === null ? 'écrit' : String(cause);
}

async function poll(poste: Poste): Promise<number> {
  if (!canReceive(poste.session, false)) return 0;
  const read = await readJournalSince(poste.config, SITE, poste.cursor.lastSeq);
  if (!read.ok) throw new Error(`lecture : ${read.cause}`);
  const step = follow(poste.cursor, read.entries);
  if (step.gap) { await resync(poste); return 0; }
  poste.session = applyReceived(poste.session, step.received);
  poste.cursor = step.cursor;
  return step.received.length;
}

const valueOf = (poste: Poste, table: string, id: string, column: string): unknown =>
  poste.session.rows.find(r => r.table === table && r.id === id)?.values[column];

/** Une modification fondée sur ce que le poste croit de la ligne. */
function update(poste: Poste, table: string, id: string, after: Record<string, ColumnValue>): EntityCommand[] {
  const before: Record<string, ColumnValue> = {};
  for (const column of Object.keys(after)) {
    const v = valueOf(poste, table, id, column);
    before[column] = v === undefined || v === null ? null
      : typeof v === 'object' ? JSON.stringify(v) : (v as ColumnValue);
  }
  return [{ operation: 'update', module: '01-socle', table, id, org_id: ORG, before, after, timestamp: T, groupKey: null }];
}

/** Le déplacement d'un nœud tel que l'atelier l'écrit : le nœud, et la
 * longueur des arêtes qui le touchent, sur ce que le poste croit du graphe. */
function moveNode(poste: Poste, id: string, x: number, y: number): readonly EntityCommand[] {
  const graph = readSessionGraph(poste.session);
  const node = graph.nodes.find(n => n.id === id);
  if (node === undefined) throw new Error('nœud absent');
  const built = updateNodeCommands(node, { kind: node.kind, label: node.label, position: { x_m: x, y_m: y } },
    graph.edges, graph.nodes, { orgId: ORG, timestamp: T }, `deplacement-${id}`);
  if (!built.ok) throw new Error(built.findings.map(f => f.code).join(','));
  return built.value;
}

/** Les lignes du graphe et du bâtiment, ramenées à une forme commune. */
function stateOf(session: SessionState): Record<string, Record<string, ColumnValue>> {
  const out: Record<string, Record<string, ColumnValue>> = {};
  for (const row of session.rows) {
    if (!(TABLES as readonly string[]).includes(row.table)) continue;
    const values: Record<string, ColumnValue> = {};
    for (const key of Object.keys(row.values).sort()) values[key] = comparable(row.values[key]);
    out[`${row.table}:${row.id}`] = values;
  }
  return out;
}

async function expectConverged(): Promise<void> {
  await poll(a); await poll(b);
  const truth = stateOf(await siteOf(POSTE_A));
  expect(stateOf(a.session)).toEqual(truth);
  expect(stateOf(b.session)).toEqual(truth);
}

describe.runIf(runnable)('S6.10 — convergence à deux clients', () => {
  beforeAll(async () => {
    client = createConnection(dsn);
    db = createDb(dsn);
    await withFixtureRole(client, tx => tx`insert into azimut.organization(id,name,slug) values (${ORG},'S6.10','s6-10-convergence')
                 on conflict (id) do nothing`);
    await enrolFixtureMembers(text => client.unsafe(text), [
      { orgId: ORG, userId: POSTE_A, role: 'designer' },
      { orgId: ORG, userId: POSTE_B, role: 'designer' },
    ]);
    const node = (id: string, kind: string, label: string, x: number) =>
      ({ table: 'node', id, after: { id, org_id: ORG, level_id: LEVEL, kind, label, position: JSON.stringify({ x_m: x, y_m: 0 }) } });
    const edge = (id: string, from: string, to: string) =>
      ({ table: 'edge', id, after: { id, org_id: ORG, from_node_id: from, to_node_id: to, length_m: 10, width_m: 1.4, slope_pct: 0, accessible: true, direction: 'both' } });
    const decor = [
      { table: 'site', id: SITE, after: { id: SITE, org_id: ORG, name: 'Site partagé', country_code: 'FR', timezone: 'Europe/Paris' } },
      { table: 'building', id: BUILDING, after: { id: BUILDING, org_id: ORG, site_id: SITE, name: 'Bâtiment' } },
      { table: 'level', id: LEVEL, after: { id: LEVEL, org_id: ORG, building_id: BUILDING, name: 'RDC', ordinal: 0, elevation_m: 0 } },
      node(ENTRANCE, 'entrance', 'Entrée', 0), node(J1, 'junction', 'J1', 10), node(J2, 'junction', 'J2', 20), node(J3, 'junction', 'J3', 30),
      edge(E1, ENTRANCE, J1), edge(E2, J1, J2), edge(E3, J2, J3),
    ].map(d => ({ operation: 'create', module: '01-socle', org_id: ORG, timestamp: T, groupKey: null, before: null, ...d }) as EntityCommand);
    const written = await applyCommands(db, { userId: POSTE_A }, decor);
    if (!written.ok) throw new Error(written.findings.map(f => f.code).join(', '));
    await installPlatformStubs(client);
    rest = await startPostgrest({ binary: postgrestBinary, dbUri: postgrestDbUri, port: 3996 });
    const open = async (userId: string): Promise<Poste> => {
      const config: SinkConfig = { url: rest.url, apiKey: API_KEY, schema: 'azimut', accessToken: signToken(userId) };
      const poste: Poste = { userId, config, session: { rows: [], queued: [], online: true }, cursor: startCursor(SITE) };
      await resync(poste);
      return poste;
    };
    a = await open(POSTE_A);
    b = await open(POSTE_B);
  }, 60_000);

  afterAll(async () => {
    await rest.stop();
    await client.end();
    await db.$client.end();
  });

  it('1. séquences concurrentes : refus réels, états finaux égaux à la base', async () => {
    const draw = seeded(610);
    const targets = [J1, J2, J3];
    const verdicts: string[] = [];
    for (let step = 0; step < 40; step++) {
      const poste = draw() < 0.5 ? a : b;
      if (draw() < 0.4) await poll(poste);
      const id = targets[Math.floor(draw() * targets.length)] ?? J1;
      const commands = draw() < 0.5
        ? update(poste, 'node', id, { label: `${poste === a ? 'A' : 'B'}-${String(step)}` })
        : moveNode(poste, id, Math.round(draw() * 1000) / 10, step);
      verdicts.push(await write(poste, commands));
    }
    // L'épreuve n'en est une que si des gestes se sont croisés.
    expect(verdicts.filter(v => v === '409').length).toBeGreaterThan(0);
    expect(verdicts.filter(v => v === 'écrit').length).toBeGreaterThan(0);
    await expectConverged();
  }, 60_000);

  it('2. coupure réseau : la file part au retour ; une file en conflit ne se fusionne pas', async () => {
    b.session = { ...b.session, online: false };
    expect(await write(b, update(b, 'node', J3, { label: 'Hors ligne' }))).toBe('écrit');
    expect(b.session.queued).toHaveLength(1);
    expect(await write(a, update(a, 'building', BUILDING, { name: 'Bâtiment Nord' }))).toBe('écrit');
    const flushed = await flushQueue(b.session, send(b));
    b.session = flushed.state;
    expect(flushed.flushed).toBe(1);
    await expectConverged();

    b.session = { ...b.session, online: false };
    await write(b, update(b, 'node', J1, { label: 'B hors ligne' }));
    expect(await write(a, update(a, 'node', J1, { label: 'A en ligne' }))).toBe('écrit');
    const refused = await flushQueue(b.session, send(b));
    // Ni écrasement de la base, ni perte du travail : la file reste, et le
    // poste ne reçoit plus tant qu'elle n'est pas arbitrée (S6.9, L4.4).
    expect(refused.flushed).toBe(0);
    expect(refused.state.queued).toHaveLength(1);
    expect(canReceive(refused.state, false)).toBe(false);
    const row = await client.begin(async tx => {
      await tx`select set_config('azimut.current_user_id', ${POSTE_A}, true)`;
      return (await tx<{ label: string }[]>`select label from azimut.node where id = ${J1}`)[0];
    });
    expect(row?.label).toBe('A en ligne');
    // L'arbitrage n'existe pas encore : le poste repart de l'état du dépôt.
    await resync(b);
    await expectConverged();
  }, 60_000);

  it('3. verrou expiré : l’autre écrit, le poste revenu est refusé puis relit', async () => {
    expect(await acquireLock(a.config, { table: 'node', id: J2 })).toBe('held');
    expect(await write(b, update(b, 'node', J2, { label: 'B sous verrou' }))).toBe('423');
    const staleA = update(a, 'node', J2, { label: 'A après coupure' });
    // Le poste A est coupé : son verrou n'est plus renouvelé, et tombe.
    await withFixtureRole(client, tx => tx`update azimut.object_lock set acquired_at = now() - interval '2 minutes', expires_at = now() - interval '1 second' where target_id = ${J2}`);
    expect(await write(b, update(b, 'node', J2, { label: 'B après expiration' }))).toBe('écrit');
    expect(await write(a, staleA)).toBe('409');
    await expectConverged();
  }, 60_000);

  it('4. incohérence topologique provoquée : vue par l’autre poste, émission refusée', async () => {
    // Le graphe est validé par le service, et le tableau peut être émis.
    await client.begin(async tx => {
      await tx`select set_config('azimut.current_user_id', ${POSTE_A}, true)`;
      await tx`insert into azimut.message_schedule(id,org_id,site_id,version,state,generated_at,inputs_hash)
               values (${SCHEDULE},${ORG},${SITE},1,'draft',${T},'sha256:entrees')`;
    });
    await client.begin(async tx => {
      await tx`select set_config('azimut.current_user_id', ${POSTE_A}, true)`;
      const [run] = await tx<{ id: string }[]>`
        insert into azimut.graph_validation(org_id, site_id, graph_hash, ran_at, passed, blocking_count, warning_count)
        values (${ORG}, ${SITE}, 'sha256:service', ${T}, true, 0, 0) returning id`;
      const [rev] = await tx<{ revision: string }[]>`select revision::text from azimut.graph_revision where site_id = ${SITE}`;
      await tx`select azimut.record_service_validation(${SITE}, ${Number(rev?.revision ?? 0)}::bigint, ${run?.id ?? ''})`;
    });
    await poll(a); await poll(b);
    const blocking = (s: SessionState) => {
      const out = validateGraph(graphScopeFromSession(s).scope);
      return (out.ok ? out.warnings : out.findings).filter(f => f.severity === 'blocking').map(f => f.code);
    };
    expect(blocking(b.session)).toEqual([]);

    // A retire la dernière arête : J3 n'est plus relié à rien.
    expect(await write(a, [{
      operation: 'delete', module: '01-socle', table: 'edge', id: E3, org_id: ORG,
      before: { from_node_id: J2, to_node_id: J3 }, after: null, timestamp: T, groupKey: null,
    }])).toBe('écrit');
    expect(await poll(b)).toBe(1);
    expect(blocking(b.session)).toContain('GRAPH.NODE_ORPHAN');

    // B tente l'émission : la base la refuse, la révision validée n'étant
    // plus celle du graphe.
    expect(await write(b, [{
      operation: 'update', module: '02-wayfinding', table: 'message_schedule', id: SCHEDULE, org_id: ORG,
      before: { state: 'draft' }, after: { state: 'in_review' }, timestamp: T, groupKey: null,
    }])).toBe('412');
    await expectConverged();
  }, 60_000);
});
