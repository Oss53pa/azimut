import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createConnection, createDb, applyCommands, enrolFixtureMembers } from '@azimut/db';
import { startPostgrest, signToken, installPlatformStubs } from '@azimut/db/harness';
import type { Harness } from '@azimut/db/harness';
import {
  declareClosureCommand, updateFaceCommand, updateFreeTextCommand, withdrawBlockCommand, withdrawClosureCommand,
} from '@azimut/core-model';
import type { EntityCommand, FormOutcome, SiteData } from '@azimut/core-model';
import { createPostgrestRepository } from '../../data/postgrest-repository.js';
import { setAccessTokenSource } from '../../auth/access-token.js';
import { createJournaledSink } from '../journaled-sink.js';
import {
  follow, readJournalHead, readJournalSince, startCursor, trackOwnWrites,
} from '../journal-follower.js';
import type { JournalCursor } from '../journal-follower.js';
import type { SinkConfig } from '../postgrest-sink.js';

/**
 * S6.6c — les écrans de la coquille (fermetures, faces, blocs libres) sur le
 * chemin journalisé, par PostgREST, comme `useShellJournal` les assemble.
 *
 * Deux choses s'éprouvent :
 *  · Q11 pour ces familles : leur `before` vient de `SiteData`, relu par le
 *    dépôt du studio, et non d'une session de commandes. Une valeur que la
 *    lecture transforme (horodatage local, liste jsonb, texte par langue)
 *    ferait échouer chaque retrait et chaque modification en 409 ;
 *  · le partage : ce qu'un poste écrit, l'autre le voit passer au journal et
 *    le retrouve en relisant le site ; une écriture fondée sur un site que
 *    l'autre a changé est refusée en 409.
 *
 * Décor qui ne se retire pas (journal en insertion seule) : un site neuf par
 * exécution, dans une organisation d'essai que `db:reset` seul retire.
 */
const dsn = process.env['AZIMUT_TEST_DATABASE_URL'] ?? '';
const postgrestBinary = process.env['AZIMUT_TEST_POSTGREST'] ?? '';
const postgrestDbUri = process.env['AZIMUT_TEST_POSTGREST_DB_URI'] ?? '';
const jwtSecret = process.env['AZIMUT_TEST_JWT_SECRET'] ?? '';
const runnable = dsn !== '' && postgrestBinary !== '' && existsSync(postgrestBinary)
  && postgrestDbUri !== '' && jwtSecret !== '';

const ORG = 'd6c00000-0000-4000-8000-0000000000a1';
const POSTE_A = 'd6c00000-0000-4000-8000-0000000000d1';
const POSTE_B = 'd6c00000-0000-4000-8000-0000000000d2';
const SITE = randomUUID();
const BUILDING = randomUUID();
const LEVEL = randomUUID();
const NODE_A = randomUUID();
const NODE_B = randomUUID();
const EDGE = randomUUID();
const SUPPORT = randomUUID();
const FACE = randomUUID();
const BLOCK = randomUUID();
const CLOSURE = randomUUID();
const T = '2026-11-22T10:00:00.000Z';
const API_KEY = 'cle-publiable-du-banc';

type Poste = {
  readonly userId: string;
  readonly config: SinkConfig;
  readonly cursor: { current: JournalCursor | null };
  readonly inFlight: { current: number };
};

let client: ReturnType<typeof createConnection>;
let db: ReturnType<typeof createDb>;
let rest: Harness;
let a: Poste;
let b: Poste;

function one(built: FormOutcome<EntityCommand>): readonly EntityCommand[] {
  if (!built.ok) throw new Error([...built.findings.map(f => f.code), ...built.notices.map(n => n.key)].join(', '));
  return [built.value];
}

/** Le site tel que le poste le relit : PostgREST, sous son identité. */
async function load(poste: Poste): Promise<SiteData> {
  const release = setAccessTokenSource(() => signToken(poste.userId));
  try {
    return await createPostgrestRepository({ url: rest.url, apiKey: API_KEY, schema: 'azimut' }).loadSite(SITE);
  } finally {
    release();
  }
}

/** L'émetteur que `useShellJournal` fournit aux écrans. */
function send(poste: Poste, commands: readonly EntityCommand[]) {
  const sink = trackOwnWrites(createJournaledSink(poste.config, { siteId: SITE, levelId: null }), poste.cursor, poste.inFlight);
  return sink(commands);
}

/** Une interrogation de `useShellJournal` : rend le nombre d'écritures d'autres postes. */
async function poll(poste: Poste): Promise<number> {
  const cursor = poste.cursor.current;
  if (cursor === null) throw new Error('curseur absent');
  const read = await readJournalSince(poste.config, SITE, cursor.lastSeq);
  if (!read.ok) throw new Error(`lecture : ${read.cause}`);
  const step = follow(cursor, read.entries);
  expect(step.gap).toBe(false);
  poste.cursor.current = step.cursor;
  return step.received.length;
}

const cause = (out: Awaited<ReturnType<typeof send>>) =>
  out.ok ? null : out.findings[0]?.params['cause'];

describe.runIf(runnable)('S6.6c — la coquille sur le journal', () => {
  beforeAll(async () => {
    client = createConnection(dsn);
    db = createDb(dsn);
    await client.unsafe('alter table azimut.organization no force row level security');
    await client`insert into azimut.organization(id,name,slug) values (${ORG},'S6.6c','s6-6c-coquille')
                 on conflict (id) do nothing`;
    await client.unsafe('alter table azimut.organization force row level security');
    await enrolFixtureMembers(text => client.unsafe(text), [
      { orgId: ORG, userId: POSTE_A, role: 'designer' },
      { orgId: ORG, userId: POSTE_B, role: 'designer' },
    ]);
    const decor = [
      { module: '01-socle', table: 'site', id: SITE, after: { id: SITE, org_id: ORG, name: 'Site S6.6c', country_code: 'FR', timezone: 'Europe/Paris', active_langs: '{fr}' } },
      { module: '01-socle', table: 'building', id: BUILDING, after: { id: BUILDING, org_id: ORG, site_id: SITE, name: 'Bâtiment A' } },
      { module: '01-socle', table: 'level', id: LEVEL, after: { id: LEVEL, org_id: ORG, building_id: BUILDING, name: 'RDC', ordinal: 0, elevation_m: 0 } },
      { module: '01-socle', table: 'node', id: NODE_A, after: { id: NODE_A, org_id: ORG, level_id: LEVEL, kind: 'entrance', position: '{"x":0,"y":0}' } },
      { module: '01-socle', table: 'node', id: NODE_B, after: { id: NODE_B, org_id: ORG, level_id: LEVEL, kind: 'junction', position: '{"x":10.25,"y":0}' } },
      { module: '01-socle', table: 'edge', id: EDGE, after: { id: EDGE, org_id: ORG, from_node_id: NODE_A, to_node_id: NODE_B, length_m: 10.25, width_m: 1.4, slope_pct: 0, accessible: true, direction: 'both' } },
      { module: '04-signaletique', table: 'support', id: SUPPORT, after: { id: SUPPORT, org_id: ORG, site_id: SITE, node_id: NODE_A, kind: 'directional' } },
      { module: '04-signaletique', table: 'support_face', id: FACE, after: { id: FACE, org_id: ORG, support_id: SUPPORT, face_index: 0, template_key: 'tpl-essai', langs: '["fr"]' } },
      { module: '04-signaletique', table: 'support_content_block', id: BLOCK, after: { id: BLOCK, org_id: ORG, face_id: FACE, block_index: 0, kind: 'free', free_text: '{"fr":"Accueil"}' } },
    ].map(d => ({ operation: 'create', org_id: ORG, timestamp: T, groupKey: null, before: null, ...d }) as EntityCommand);
    const written = await applyCommands(db, { userId: POSTE_A }, decor);
    if (!written.ok) throw new Error(written.findings.map(f => f.code).join(', '));

    await installPlatformStubs(client);
    rest = await startPostgrest({ binary: postgrestBinary, dbUri: postgrestDbUri, port: 3995 });

    const open = async (userId: string): Promise<Poste> => {
      const config: SinkConfig = { url: rest.url, apiKey: API_KEY, schema: 'azimut', accessToken: signToken(userId) };
      const head = await readJournalHead(config, SITE);
      if (head === null) throw new Error('tête du journal illisible');
      return { userId, config, cursor: { current: startCursor(SITE, head) }, inFlight: { current: 0 } };
    };
    a = await open(POSTE_A);
    b = await open(POSTE_B);
  }, 60_000);

  afterAll(async () => {
    await rest.stop();
    await client.end();
    await db.$client.end();
  });

  it('déclarer une fermeture : B la voit passer et la relit ; A ne reçoit pas la sienne', async () => {
    const site = await load(a);
    const out = await send(a, one(declareClosureCommand(site, {
      edgeIds: [EDGE], from: '2026-12-01T08:00:00', to: '2026-12-01T18:30:00', reason: 'Travaux',
    }, { newId: () => CLOSURE, timestamp: T })));
    expect(cause(out)).toBeNull();

    expect(await poll(b)).toBe(1);
    expect(await poll(a)).toBe(0);
    const seen = await load(b);
    expect((seen.temporary_closures ?? []).map(c => c.id)).toEqual([CLOSURE]);
  });

  it('modifier une face, depuis le site relu', async () => {
    const site = await load(a);
    const face = site.support_faces.find(f => f.id === FACE);
    if (face === undefined) throw new Error('face absente');
    const out = await send(a, one(updateFaceCommand(site, face, { template_key: null, langs: ['fr'] }, T)));
    expect(cause(out)).toBeNull();
    expect(await poll(b)).toBe(1);
  });

  it('réécrire un texte libre, depuis le site relu', async () => {
    const site = await load(a);
    const face = site.support_faces.find(f => f.id === FACE);
    const block = site.content_blocks.find(k => k.id === BLOCK);
    if (face === undefined || block === undefined) throw new Error('face ou bloc absent');
    const out = await send(a, one(updateFreeTextCommand(site, face, block, { fr: 'Accueil général' }, T)));
    expect(cause(out)).toBeNull();
    expect(await poll(b)).toBe(1);
  });

  it('un poste qui n’a pas relu est refusé en 409, puis passe après relecture', async () => {
    // B a relu le site avant que A réécrive le texte une seconde fois.
    const stale = await load(b);
    const fresh = await load(a);
    const faceA = fresh.support_faces.find(f => f.id === FACE);
    const blockA = fresh.content_blocks.find(k => k.id === BLOCK);
    if (faceA === undefined || blockA === undefined) throw new Error('face ou bloc absent');
    expect(cause(await send(a, one(updateFreeTextCommand(fresh, faceA, blockA, { fr: 'Hall' }, T))))).toBeNull();

    const blockB = stale.content_blocks.find(k => k.id === BLOCK);
    if (blockB === undefined) throw new Error('bloc absent');
    expect(cause(await send(b, one(withdrawBlockCommand(blockB, T))))).toBe('409');

    expect(await poll(b)).toBe(1);
    const reread = (await load(b)).content_blocks.find(k => k.id === BLOCK);
    if (reread === undefined) throw new Error('bloc absent');
    expect(cause(await send(b, one(withdrawBlockCommand(reread, T))))).toBeNull();
    expect(await poll(a)).toBe(1);
  });

  it('retirer la fermeture, depuis le site relu', async () => {
    const site = await load(b);
    const closure = (site.temporary_closures ?? []).find(c => c.id === CLOSURE);
    if (closure === undefined) throw new Error('fermeture absente');
    expect(cause(await send(b, one(withdrawClosureCommand(closure, T))))).toBeNull();
    expect(await poll(a)).toBe(1);
    expect((await load(a)).temporary_closures ?? []).toEqual([]);
  });
});
