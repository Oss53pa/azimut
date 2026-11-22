import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createConnection, createDb, applyCommands, enrolFixtureMembers } from '@azimut/db';
import { startPostgrest, signToken, installPlatformStubs } from '@azimut/db/harness';
import type { Harness } from '@azimut/db/harness';
import type { EntityCommand, Outcome } from '@azimut/core-model';
import { createPostgrestRepository } from '../../data/postgrest-repository.js';
import { setAccessTokenSource } from '../../auth/access-token.js';
import { sessionFromSite } from '../session-from-site.js';
import { rowsOf, writeToSession } from '../session-store.js';
import type { SessionState } from '../session-store.js';
import { createJournaledSink } from '../journaled-sink.js';
import {
  follow, isJournaledWrite, readJournalHead, readJournalSince, recordOwnWrite, startCursor,
} from '../journal-follower.js';
import type { JournalCursor } from '../journal-follower.js';
import { applyReceived } from '../journal-session.js';
import { renameCommands } from '../site-structure.js';
import type { SinkConfig } from '../postgrest-sink.js';

/**
 * S6.6b — deux postes sur le même site, par le chemin réel : PostgREST, le
 * journal de 0078, et les fonctions que `useTrancheSession` et
 * `useJournalFollow` assemblent.
 *
 * Ce qui s'éprouve : ce qu'un poste écrit, l'autre le reçoit et l'applique ;
 * un poste ne reçoit pas ses propres écritures ; une écriture fondée sur un
 * état que l'autre a changé est refusée, ne part pas en file, et laisse la
 * session telle qu'avant le geste.
 *
 * **Décor qui ne se retire pas**, comme celui des passages de validation
 * (`atelier-ecriture`) : le journal est en insertion seule, et sa clé refuse
 * la suppression du site. Chaque exécution prend un site neuf dans une même
 * organisation d'essai, que `db:reset` seul retire.
 */
const dsn = process.env['AZIMUT_TEST_DATABASE_URL'] ?? '';
const postgrestBinary = process.env['AZIMUT_TEST_POSTGREST'] ?? '';
const postgrestDbUri = process.env['AZIMUT_TEST_POSTGREST_DB_URI'] ?? '';
const jwtSecret = process.env['AZIMUT_TEST_JWT_SECRET'] ?? '';
const runnable = dsn !== '' && postgrestBinary !== '' && existsSync(postgrestBinary)
  && postgrestDbUri !== '' && jwtSecret !== '';

const ORG = 'd6600000-0000-4000-8000-0000000000a1';
const POSTE_A = 'd6600000-0000-4000-8000-0000000000d1';
const POSTE_B = 'd6600000-0000-4000-8000-0000000000d2';
const SITE = randomUUID();
const BUILDING = randomUUID();
const T = '2026-11-22T10:00:00.000Z';
const API_KEY = 'cle-publiable-du-banc';

type Poste = {
  readonly config: SinkConfig;
  session: SessionState;
  cursor: JournalCursor;
};

let client: ReturnType<typeof createConnection>;
let db: ReturnType<typeof createDb>;
let rest: Harness;
let a: Poste;
let b: Poste;

function rename(poste: Poste, from: string, to: string): readonly EntityCommand[] {
  const built = renameCommands('building', BUILDING, from, to, [], { orgId: ORG, siteId: SITE, timestamp: T });
  if (!built.ok) throw new Error(built.findings.map(f => f.code).join(','));
  void poste;
  return built.value;
}

/** Ce que fait `useTrancheSession` d'un geste : écrire, noter ses numéros. */
async function write(poste: Poste, commands: readonly EntityCommand[]) {
  const sink = createJournaledSink(poste.config, { siteId: SITE, levelId: null });
  const send = async (cmds: readonly EntityCommand[]): Promise<Outcome<unknown>> => {
    const out = await sink(cmds);
    if (out.ok && isJournaledWrite(out.value)) poste.cursor = recordOwnWrite(poste.cursor, out.value);
    return out;
  };
  const result = await writeToSession(poste.session, commands, send);
  poste.session = result.state;
  return result;
}

/** Ce que fait `useJournalFollow` à chaque interrogation. */
async function poll(poste: Poste): Promise<number> {
  const read = await readJournalSince(poste.config, SITE, poste.cursor.lastSeq);
  if (!read.ok) throw new Error(`lecture : ${read.cause}`);
  const step = follow(poste.cursor, read.entries);
  expect(step.gap).toBe(false);
  poste.session = applyReceived(poste.session, step.received);
  poste.cursor = step.cursor;
  return step.received.length;
}

const buildingName = (poste: Poste) =>
  rowsOf(poste.session, 'building').find(r => r.id === BUILDING)?.values['name'];

describe.runIf(runnable)('S6.6b — deux postes sur le même site', () => {
  beforeAll(async () => {
    client = createConnection(dsn);
    db = createDb(dsn);
    await client.unsafe('alter table azimut.organization no force row level security');
    await client`insert into azimut.organization(id,name,slug) values (${ORG},'S6.6b','s6-6b-deux-postes')
                 on conflict (id) do nothing`;
    await client.unsafe('alter table azimut.organization force row level security');
    await enrolFixtureMembers(text => client.unsafe(text), [
      { orgId: ORG, userId: POSTE_A, role: 'designer' },
      { orgId: ORG, userId: POSTE_B, role: 'designer' },
    ]);
    const decor = [
      { table: 'site', id: SITE, after: { id: SITE, org_id: ORG, name: 'Site partagé', country_code: 'FR', timezone: 'Europe/Paris' } },
      { table: 'building', id: BUILDING, after: { id: BUILDING, org_id: ORG, site_id: SITE, name: 'Bâtiment A' } },
    ].map(d => ({ operation: 'create', module: '01-socle', org_id: ORG, timestamp: T, groupKey: null, before: null, ...d }) as EntityCommand);
    const written = await applyCommands(db, { userId: POSTE_A }, decor);
    if (!written.ok) throw new Error(written.findings.map(f => f.code).join(', '));

    await installPlatformStubs(client);
    rest = await startPostgrest({ binary: postgrestBinary, dbUri: postgrestDbUri, port: 3993 });

    const open = async (userId: string): Promise<Poste> => {
      const config: SinkConfig = { url: rest.url, apiKey: API_KEY, schema: 'azimut', accessToken: signToken(userId) };
      const head = await readJournalHead(config, SITE);
      if (head === null) throw new Error('tête du journal illisible');
      const release = setAccessTokenSource(() => signToken(userId));
      try {
        const site = await createPostgrestRepository({ url: rest.url, apiKey: API_KEY, schema: 'azimut' }).loadSite(SITE);
        return { config, session: sessionFromSite(site), cursor: startCursor(SITE, head) };
      } finally {
        release();
      }
    };
    a = await open(POSTE_A);
    b = await open(POSTE_B);
  }, 60_000);

  afterAll(async () => {
    await rest.stop();
    await client.end();
    await db.$client.end();
  });

  it('les deux postes partent du même état', () => {
    expect(buildingName(a)).toBe('Bâtiment A');
    expect(buildingName(b)).toBe('Bâtiment A');
  });

  it('ce que le poste A écrit, le poste B le reçoit ; A ne reçoit pas le sien', async () => {
    const result = await write(a, rename(a, 'Bâtiment A', 'Bâtiment Nord'));
    expect(result.refused).toBeNull();
    expect(buildingName(a)).toBe('Bâtiment Nord');

    expect(await poll(b)).toBe(1);
    expect(buildingName(b)).toBe('Bâtiment Nord');
    expect(await poll(a)).toBe(0);
  });

  it('deux gestes concurrents : le second est refusé, sans file, sans trace locale', async () => {
    const fromA = rename(a, 'Bâtiment Nord', 'Bâtiment Est');
    const fromB = rename(b, 'Bâtiment Nord', 'Bâtiment Ouest');

    expect((await write(a, fromA)).refused).toBeNull();
    const refused = await write(b, fromB);
    expect(refused.refused?.[0]?.params['cause']).toBe('409');
    expect(b.session.queued).toEqual([]);
    expect(buildingName(b)).toBe('Bâtiment Nord');

    expect(await poll(b)).toBe(1);
    expect(buildingName(b)).toBe('Bâtiment Est');
  });

  it('les deux postes finissent sur l’état de la base', async () => {
    await poll(a);
    // La lecture passe sous l'identité d'un membre : le cloisonnement ne
    // rend rien à une connexion qui n'en a pas.
    const row = await client.begin(async tx => {
      await tx`select set_config('azimut.current_user_id', ${POSTE_A}, true)`;
      const [found] = await tx<{ name: string }[]>`select name from azimut.building where id = ${BUILDING}`;
      return found;
    });
    expect(row?.name).toBe('Bâtiment Est');
    expect(buildingName(a)).toBe(row?.name);
    expect(buildingName(b)).toBe(row?.name);
  });
});
