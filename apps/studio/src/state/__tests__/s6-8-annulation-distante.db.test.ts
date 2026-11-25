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
import { EMPTY_STORE, canUndo, discardTop, dispatch, undo } from '../command-store.js';
import type { CommandSink, StoreState } from '../command-store.js';
import { isStaleRefusal, locateConflict } from '../undo-conflict.js';
import type { SinkConfig } from '../postgrest-sink.js';

/**
 * S6.8, décision Q3 d'Oss53pa — annuler pendant que d'autres postes
 * écrivent, par le chemin réel : PostgREST, le journal de 0078, et les
 * fonctions que `useTrancheSession`, `useSessionUndo` et `useJournalFollow`
 * assemblent.
 *
 * Ce qui s'éprouve : recevoir des commandes d'ailleurs ne vide pas la pile ;
 * l'annulation part comme une commande et l'autre poste la reçoit ; quand
 * l'objet a changé ailleurs, la base refuse, rien n'est écrit, le geste reste
 * dans la pile, et le conflit se situe sur le site relu à la seule colonne
 * changée — la position, relue en objet, ne se confond pas avec un écart.
 *
 * **Décor qui ne se retire pas** (journal en insertion seule) : un site neuf
 * par exécution, dans une organisation d'essai que `db:reset` seul retire.
 */
const dsn = process.env['AZIMUT_TEST_DATABASE_URL'] ?? '';
const postgrestBinary = process.env['AZIMUT_TEST_POSTGREST'] ?? '';
const postgrestDbUri = process.env['AZIMUT_TEST_POSTGREST_DB_URI'] ?? '';
const jwtSecret = process.env['AZIMUT_TEST_JWT_SECRET'] ?? '';
const runnable = dsn !== '' && postgrestBinary !== '' && existsSync(postgrestBinary)
  && postgrestDbUri !== '' && jwtSecret !== '';

const ORG = 'd6800000-0000-4000-8000-0000000000a1';
const POSTE_A = 'd6800000-0000-4000-8000-0000000000d1';
const POSTE_B = 'd6800000-0000-4000-8000-0000000000d2';
const SITE = randomUUID();
const BUILDING = randomUUID();
const LEVEL = randomUUID();
const NODE = randomUUID();
const T = '2026-11-25T10:00:00.000Z';
const API_KEY = 'cle-publiable-du-banc';

type Poste = {
  readonly userId: string;
  readonly config: SinkConfig;
  session: SessionState;
  cursor: JournalCursor;
  store: StoreState;
};

let client: ReturnType<typeof createConnection>;
let db: ReturnType<typeof createDb>;
let rest: Harness;
let a: Poste;
let b: Poste;

/** Un déplacement et un renommage du nœud, comme `graph-update-commands`. */
function moveNode(
  from: { label: string; x: number }, to: { label: string; x: number },
): readonly EntityCommand[] {
  const values = (p: { label: string; x: number }) =>
    ({ kind: 'junction', label: p.label, position: JSON.stringify({ x_m: p.x, y_m: 0 }) });
  return [{
    operation: 'update', module: '01-socle', table: 'node', id: NODE, org_id: ORG,
    before: values(from), after: values(to), timestamp: T, groupKey: null,
  }];
}

/** L'émetteur de `useTrancheSession` : la session, le journal, les numéros. */
function sinkOf(poste: Poste): CommandSink {
  const journaled = createJournaledSink(poste.config, { siteId: SITE, levelId: null });
  const send = async (cmds: readonly EntityCommand[]): Promise<Outcome<unknown>> => {
    const out = await journaled(cmds);
    if (out.ok && isJournaledWrite(out.value)) poste.cursor = recordOwnWrite(poste.cursor, out.value);
    return out;
  };
  return async commands => {
    const result = await writeToSession(poste.session, commands, send);
    if (result.refused !== null) return { ok: false, findings: [...result.refused] };
    poste.session = result.state;
    return { ok: true, value: null, warnings: [] };
  };
}

async function gesture(poste: Poste, commands: readonly EntityCommand[]): Promise<void> {
  const result = await dispatch(poste.store, sinkOf(poste), commands);
  if (!result.outcome.ok) throw new Error(result.outcome.findings.map(f => f.code).join(','));
  poste.store = result.state;
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

/** Ce que `reload` de la session fait : relire le site au dépôt. */
async function reload(poste: Poste): Promise<SessionState> {
  const release = setAccessTokenSource(() => signToken(poste.userId));
  try {
    const site = await createPostgrestRepository({ url: rest.url, apiKey: API_KEY, schema: 'azimut' }).loadSite(SITE);
    return sessionFromSite(site);
  } finally {
    release();
  }
}

const nodeOf = (poste: Poste) => rowsOf(poste.session, 'node').find(r => r.id === NODE)?.values;

describe.runIf(runnable)('S6.8 — annuler pendant que d’autres postes écrivent', () => {
  beforeAll(async () => {
    client = createConnection(dsn);
    db = createDb(dsn);
    await client.unsafe('alter table azimut.organization no force row level security');
    await client`insert into azimut.organization(id,name,slug) values (${ORG},'S6.8','s6-8-annulation')
                 on conflict (id) do nothing`;
    await client.unsafe('alter table azimut.organization force row level security');
    await enrolFixtureMembers(text => client.unsafe(text), [
      { orgId: ORG, userId: POSTE_A, role: 'designer' },
      { orgId: ORG, userId: POSTE_B, role: 'designer' },
    ]);
    const decor = [
      { table: 'site', id: SITE, after: { id: SITE, org_id: ORG, name: 'Site partagé', country_code: 'FR', timezone: 'Europe/Paris' } },
      { table: 'building', id: BUILDING, after: { id: BUILDING, org_id: ORG, site_id: SITE, name: 'Bâtiment A' } },
      { table: 'level', id: LEVEL, after: { id: LEVEL, org_id: ORG, building_id: BUILDING, name: 'RDC', ordinal: 0, elevation_m: 0 } },
      { table: 'node', id: NODE, after: { id: NODE, org_id: ORG, level_id: LEVEL, kind: 'junction', label: 'Hall', position: '{"x_m":0,"y_m":0}' } },
    ].map(d => ({ operation: 'create', module: '01-socle', org_id: ORG, timestamp: T, groupKey: null, before: null, ...d }) as EntityCommand);
    const written = await applyCommands(db, { userId: POSTE_A }, decor);
    if (!written.ok) throw new Error(written.findings.map(f => f.code).join(', '));

    await installPlatformStubs(client);
    rest = await startPostgrest({ binary: postgrestBinary, dbUri: postgrestDbUri, port: 3994 });

    const open = async (userId: string): Promise<Poste> => {
      const config: SinkConfig = { url: rest.url, apiKey: API_KEY, schema: 'azimut', accessToken: signToken(userId) };
      const head = await readJournalHead(config, SITE);
      if (head === null) throw new Error('tête du journal illisible');
      const poste: Poste = { userId, config, session: { rows: [], queued: [], online: true }, cursor: startCursor(SITE, head), store: EMPTY_STORE };
      poste.session = await reload(poste);
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

  it('recevoir des commandes d’ailleurs ne vide pas la pile ; l’annulation se propage', async () => {
    await gesture(a, moveNode({ label: 'Hall', x: 0 }, { label: 'Hall', x: 5 }));
    // B écrit ailleurs sur le site ; A le reçoit, et garde sa pile.
    const site = b.session.rows.find(r => r.table === 'site')?.values;
    await gesture(b, [{
      operation: 'update', module: '01-socle', table: 'site', id: SITE, org_id: ORG,
      before: { name: String(site?.['name']) }, after: { name: 'Site renommé' }, timestamp: T, groupKey: null,
    }]);
    expect(await poll(a)).toBe(1);
    expect(canUndo(a.store)).toBe(true);

    const undone = await undo(a.store, sinkOf(a), T);
    expect(undone.applied).toBe(true);
    a.store = undone.state;
    expect(await poll(b)).toBe(2);
    expect(nodeOf(b)?.['position']).toBe('{"x_m":0,"y_m":0}');
  });

  it('l’objet changé ailleurs : refus, rien d’écrit, le geste reste, la colonne se nomme', async () => {
    await gesture(a, moveNode({ label: 'Hall', x: 0 }, { label: 'Hall', x: 8 }));
    expect(await poll(b)).toBe(1);
    await gesture(b, moveNode({ label: 'Hall', x: 8 }, { label: 'Accueil', x: 8 }));

    // A n'a pas encore reçu : la base juge seule.
    const refused = await undo(a.store, sinkOf(a), T);
    expect(refused.applied).toBe(false);
    expect(!refused.outcome.ok && isStaleRefusal(refused.outcome.findings)).toBe(true);
    expect(refused.state).toBe(a.store);

    a.session = await reload(a);
    const conflict = locateConflict(a.session, 'undo', refused.attempted);
    expect(conflict).toEqual({
      side: 'undo', reason: 'row_changed', table: 'node', id: NODE,
      columns: [{ column: 'label', current: 'Accueil', wanted: 'Hall' }],
    });

    // La base porte l'écriture de B, intacte.
    const row = await client.begin(async tx => {
      await tx`select set_config('azimut.current_user_id', ${POSTE_A}, true)`;
      const [found] = await tx<{ label: string }[]>`select label from azimut.node where id = ${NODE}`;
      return found;
    });
    expect(row?.label).toBe('Accueil');

    // Écarté à la demande, le geste quitte la pile sans rien écrire.
    expect(a.store.undoStack.length).toBe(1);
    expect(discardTop(a.store, 'undo').undoStack).toEqual([]);
    expect(await poll(b)).toBe(0);
  });
});
