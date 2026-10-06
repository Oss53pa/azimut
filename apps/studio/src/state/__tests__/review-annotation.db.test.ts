import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildCommand, inverseCommand } from '@azimut/core-model';
import type { EntityCommand } from '@azimut/core-model';
import { applyCommands, createConnection, createDb, deleteOrgFixture } from '@azimut/db';
import { annotateCommands, replyCommand, setStateCommand } from '../review-annotation.js';
import type { ReviewAnnotation } from '../review-annotation.js';

/**
 * J4 (partie J) — l'annotation en révision contre la base réelle (0073), par
 * le chemin d'écriture ordinaire et sous cloisonnement forcé.
 *
 * Ce qui s'éprouve : l'auteur et la signature de clôture sont posés par la
 * base ; le tracé revient tel quel ; le fil de réponses s'écrit ; une autre
 * organisation n'en voit rien ; une annotation flottante, à deux ancres ou
 * vide est refusée.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];
const ALICE = 'a5000000-0000-0000-0000-0000000000a1';
const BOB = 'a5000000-0000-0000-0000-0000000000b1';
const ORG = 'a5000000-0000-0000-0000-00000000a0a0';
const ORG_B = 'a5000000-0000-0000-0000-00000000b0b0';
const SITE = 'a5000000-0000-0000-0000-0000000005a1';
const BUILDING = 'a5000000-0000-0000-0000-0000000006a1';
const LEVEL = 'a5000000-0000-0000-0000-0000000007a1';
const ZONE = 'a5000000-0000-0000-0000-0000000008a1';
const NOTE = 'a5000000-0000-0000-0000-0000000009a1';
const REPLY = 'a5000000-0000-0000-0000-0000000009b1';
const T = '2026-10-04T10:00:00.000Z';
const INK = [[{ x: 0.1, y: 0.2, p: 0.4 }, { x: 0.35, y: 0.25, p: 0.8 }]];

let client: ReturnType<typeof createConnection>;
let db: ReturnType<typeof createDb>;

type Row = Readonly<Record<string, unknown>>;

async function asUser(userId: string, text: string, params: readonly string[] = []): Promise<readonly Row[]> {
  const rows: Row[] = [];
  await client.begin(async (tx) => {
    await tx.unsafe('set local role authenticated');
    await tx.unsafe(`select set_config('azimut.current_user_id', $1, true)`, [userId]);
    rows.push(...await tx.unsafe(text, [...params]));
  });
  return rows;
}

function command(table: string, id: string, after: Record<string, string>): EntityCommand {
  const out = buildCommand({ operation: 'create', module: '01-socle', table, id, org_id: ORG, after, timestamp: T });
  if (!out.ok) throw new Error(JSON.stringify(out.findings));
  return out.value;
}

async function apply(userId: string, commands: readonly EntityCommand[]): Promise<void> {
  const applied = await applyCommands(db, { userId }, commands);
  if (!applied.ok) throw new Error(JSON.stringify(applied.findings));
}

beforeAll(async () => {
  if (URL === undefined || URL === '') {
    throw new Error('AZIMUT_TEST_DATABASE_URL absente. Voir packages/db/migrations/ORDRE.md.');
  }
  client = createConnection(URL);
  db = createDb(URL);
  await deleteOrgFixture(text => client.unsafe(text), text => client.unsafe(text), [ORG, ORG_B]);
  for (const [user, org, slug] of [[ALICE, ORG, 'j4-a'], [BOB, ORG_B, 'j4-b']] as const) {
    await asUser(user, 'insert into azimut.organization(id,name,slug) values ($1, $2, $2)', [org, slug]);
    await asUser(user, `insert into azimut.membership(org_id,user_id,role) values ($1, $2, 'admin')`, [org, user]);
  }
  await apply(ALICE, [
    command('site', SITE, { id: SITE, org_id: ORG, name: 'Site revue', country_code: 'FR', timezone: 'Europe/Paris' }),
    command('building', BUILDING, { id: BUILDING, org_id: ORG, site_id: SITE, name: 'Bâtiment 1' }),
    command('level', LEVEL, { id: LEVEL, org_id: ORG, building_id: BUILDING, name: 'Niveau 0', ordinal: '0', elevation_m: '0' }),
  ]);
  await asUser(ALICE, `insert into azimut.zone(id, org_id, level_id, name, kind) values ($1, $2, $3, 'Mail', 'commercial')`,
    [ZONE, ORG, LEVEL]);
});

afterAll(async () => {
  await deleteOrgFixture(text => client.unsafe(text), text => client.unsafe(text), [ORG, ORG_B]);
  await client.end();
  await db.$client.end();
});

const W = { orgId: ORG, siteId: SITE, timestamp: T };

function open(): ReviewAnnotation {
  return { id: NOTE, anchor: { kind: 'zone', id: ZONE }, state: 'open', body: '', ink: null, created_at: '', replies: [] };
}

describe('J4 — l’annotation en révision, en base', () => {
  it('s’écrit sur sa zone ; l’auteur est posé par la base, le tracé revient tel quel', async () => {
    const out = annotateCommands([{ id: NOTE, anchor: { kind: 'zone', id: ZONE } }], { body: 'Flèche à inverser', ink: INK }, W);
    if (out.kind !== 'written') throw new Error(out.kind);
    await apply(ALICE, out.commands);
    const [row] = await asUser(ALICE, 'select author_id, state, body, ink, resolved_by from azimut.review_annotation where id = $1', [NOTE]);
    expect(row).toMatchObject({ author_id: ALICE, state: 'open', body: 'Flèche à inverser', ink: INK, resolved_by: null });
  });

  it('traitée, elle porte qui l’a close et quand ; rouverte, la signature s’efface', async () => {
    const close = setStateCommand(open(), 'resolved', { orgId: ORG, timestamp: '2026-10-06T09:00:00.000Z' });
    if (close === null) throw new Error('commande attendue');
    await apply(ALICE, [close]);
    const [closed] = await asUser(ALICE, 'select state, resolved_by, resolved_at from azimut.review_annotation where id = $1', [NOTE]);
    expect(closed).toMatchObject({ state: 'resolved', resolved_by: ALICE });
    expect(closed?.['resolved_at']).not.toBeNull();

    await apply(ALICE, [inverseCommand(close, '2026-10-06T09:01:00.000Z')]);
    const [reopened] = await asUser(ALICE, 'select state, resolved_by, resolved_at from azimut.review_annotation where id = $1', [NOTE]);
    expect(reopened).toMatchObject({ state: 'open', resolved_by: null, resolved_at: null });
  });

  it('le fil de réponses s’écrit, et une autre organisation ne voit rien', async () => {
    const reply = replyCommand(NOTE, REPLY, 'Corrigé à la source', { orgId: ORG, timestamp: T });
    if (reply === null) throw new Error('commande attendue');
    await apply(ALICE, [reply]);
    expect(await asUser(ALICE, 'select id from azimut.review_annotation_reply where annotation_id = $1', [NOTE])).toHaveLength(1);
    expect(await asUser(BOB, 'select id from azimut.review_annotation where id = $1', [NOTE])).toHaveLength(0);
    expect(await asUser(BOB, 'select id from azimut.review_annotation_reply where id = $1', [REPLY])).toHaveLength(0);
  });

  it('une annotation flottante, à deux ancres ou vide est refusée par la base', async () => {
    const forged = (id: string, after: Record<string, string | null>): EntityCommand => {
      const out = buildCommand({
        operation: 'create', module: '02-wayfinding', table: 'review_annotation', id, org_id: ORG, timestamp: T,
        after: { id, org_id: ORG, site_id: SITE, ...after },
      });
      if (!out.ok) throw new Error(JSON.stringify(out.findings));
      return out.value;
    };
    const floating = forged('a5000000-0000-0000-0000-0000000009c1', { body: 'Sans ancre' });
    const twice = forged('a5000000-0000-0000-0000-0000000009c2', { body: 'Deux ancres', zone_id: ZONE, support_id: ZONE });
    const empty = forged('a5000000-0000-0000-0000-0000000009c3', { body: '  ', zone_id: ZONE });
    for (const bad of [floating, twice, empty]) {
      expect((await applyCommands(db, { userId: ALICE }, [bad])).ok).toBe(false);
    }
  });
});
