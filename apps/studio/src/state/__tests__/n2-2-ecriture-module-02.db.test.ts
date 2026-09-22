import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createConnection, createDb, applyCommands } from '@azimut/db';
import { buildCommand } from '@azimut/core-model';
import type { EntityCommand } from '@azimut/core-model';
import type { MessageLine, MessageSchedule } from '@azimut/engine-graph';
import {
  createOrientationZone, createNamingRule,
  createInformationLevel, createSequenceStep, setSupportCode,
} from '../wayfinding-commands.js';
import { writeScheduleCommands } from '../message-schedule-commands.js';

/**
 * N2.2 — le chemin d'écriture du module 02, contre une base réelle.
 *
 * Les essais unitaires prouvent que les commandes ont la forme voulue. Ils ne
 * prouvent pas qu'elles s'écrivent : les contraintes qui portent les règles du
 * module — `decision_point_id` non nul pour M02.W4, le motif obligatoire pour M02.W9,
 * les politiques de cloisonnement — sont en base et nulle part ailleurs. Le
 * préalable K4 nº 7 a montré que ces trois points se décident à l'exécution.
 *
 * Il demande donc `pnpm test:db`. Mise en place dans
 * `packages/db/migrations/ORDRE.md`. Sans base, la suite s'arrête avec le mode
 * d'emploi plutôt que de passer en silence.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];
const ALICE = '11111111-1111-1111-1111-111111111111';
const BOB = '22222222-2222-2222-2222-222222222222';
const ORG = 'aaaaaaaa-0000-0000-0000-000000000001';
const ORG_B = 'bbbbbbbb-0000-0000-0000-000000000002';

const SITE = 'a2000000-0000-0000-0000-000000000201';
const BUILDING = 'a2000000-0000-0000-0000-000000000202';
const LEVEL = 'a2000000-0000-0000-0000-000000000203';
const NODE = 'a2000000-0000-0000-0000-000000000204';
const TYPOLOGY = 'a2000000-0000-0000-0000-000000000205';
const SUPPORT = 'a2000000-0000-0000-0000-000000000206';
const SUPPORT_2 = 'a2000000-0000-0000-0000-000000000207';
const PROFILE = 'a2000000-0000-0000-0000-000000000208';
const ABSENT = 'a2000000-0000-0000-0000-0000000002ff';

const T = '2026-09-22T10:00:00.000Z';
const WRITE = { orgId: ORG, siteId: SITE, timestamp: T };

let client: ReturnType<typeof createConnection>;
let db: ReturnType<typeof createDb>;
let alice: Awaited<ReturnType<typeof client.reserve>>;
let bob: Awaited<ReturnType<typeof client.reserve>>;

/**
 * Une connexion réservée, tenue sous une identité pour toute la suite.
 *
 * Les lectures de contrôle doivent voir ce que verrait la personne, politiques
 * comprises. Réserver la connexion plutôt qu'ouvrir une transaction par
 * lecture garde l'identité posée sans la faire fuir vers les autres
 * connexions du pool : `set role` et le réglage ne valent que pour celle-ci.
 */
async function reserveAs(userId: string) {
  const held = await client.reserve();
  await held`set role authenticated`;
  await held`select set_config('azimut.current_user_id', ${userId}, false)`;
  return held;
}

function command(
  module: '01-socle' | '03-parcours' | '04-signaletique',
  table: string,
  id: string,
  after: Readonly<Record<string, string | number | boolean>>,
): EntityCommand {
  const out = buildCommand({
    operation: 'create', module, table, id, org_id: ORG,
    after: { id, org_id: ORG, ...after }, timestamp: T,
  });
  if (!out.ok) throw new Error(JSON.stringify(out.findings));
  return out.value;
}

beforeAll(async () => {
  if (URL === undefined || URL === '') {
    throw new Error(
      'AZIMUT_TEST_DATABASE_URL absente. Voir packages/db/migrations/ORDRE.md.',
    );
  }
  client = createConnection(URL);
  db = createDb(URL);

  // L'organisation et l'adhésion s'amorcent hors politique, comme le ferait un
  // import d'administration : sans adhésion, personne n'a d'identité à poser.
  // Le cloisonnement est rétabli aussitôt, et tout le reste de la suite passe
  // par lui.
  for (const table of ['membership', 'organization']) {
    await client`alter table azimut.${client(table)} no force row level security`;
  }
  await client`insert into azimut.organization(id,name,slug)
    values (${ORG},'A','a'),(${ORG_B},'B','b') on conflict (id) do nothing`;
  await client`insert into azimut.membership(org_id,user_id,role)
    values (${ORG},${ALICE},'admin'),(${ORG_B},${BOB},'admin') on conflict do nothing`;
  for (const table of ['membership', 'organization']) {
    await client`alter table azimut.${client(table)} force row level security`;
  }

  alice = await reserveAs(ALICE);
  bob = await reserveAs(BOB);

  // Un passage antérieur a pu laisser ses lignes. La suppression du site
  // emporte en cascade tout ce qui s'y rattache, module 02 compris ; la
  // typologie, qui ne porte pas de site, se supprime à part.
  await alice`delete from azimut.site where id = ${SITE}`;
  await alice`delete from azimut.support_typology where id = ${TYPOLOGY}`;

  // Le décor : il appartient aux modules 01, 03 et 04, et s'écrit par leurs
  // commandes. `support` fait exception — L0 le scinde colonne par colonne, et
  // aucun module ne possède aujourd'hui sa création. Les deux supports sont
  // donc posés en SQL, sous l'identité et sous les politiques. C'est un manque
  // constaté du modèle de commande, pas un contournement du cloisonnement.
  const decor = await applyCommands(db, { userId: ALICE }, [
    command('01-socle', 'site', SITE, {
      name: 'Site du module 02', country_code: 'FR', timezone: 'Europe/Paris',
    }),
    command('01-socle', 'building', BUILDING, { site_id: SITE, name: 'Bâtiment A' }),
    command('01-socle', 'level', LEVEL, {
      building_id: BUILDING, name: 'RDC', ordinal: 0, elevation_m: 0,
    }),
    command('01-socle', 'node', NODE, {
      level_id: LEVEL, kind: 'junction', label: 'Hall',
      position: JSON.stringify({ x_m: 1, y_m: 1 }),
    }),
    command('03-parcours', 'travel_profile', PROFILE, {
      site_id: SITE, key: 'pieton', name: 'Piéton',
    }),
    command('04-signaletique', 'support_typology', TYPOLOGY, {
      key: 'totem', name: 'Totem', face_count: 2,
    }),
  ]);
  if (!decor.ok) throw new Error(JSON.stringify(decor.findings));

  for (const id of [SUPPORT, SUPPORT_2]) {
    await alice`insert into azimut.support(id,org_id,site_id,node_id,kind)
      values (${id},${ORG},${SITE},${NODE},'totem')`;
  }
});

afterAll(async () => {
  await alice`delete from azimut.site where id = ${SITE}`;
  await alice`delete from azimut.support_typology where id = ${TYPOLOGY}`;
  await alice.release();
  await bob.release();
  await client.end();
  await db.$client.end();
});

describe('les quatre entités du zonage et du jalonnement', () => {
  it('s’écrivent par le chemin d’écriture et se relisent', async () => {
    const zone = createOrientationZone({
      id: 'a2000000-0000-0000-0000-000000000210',
      code: 'GAL-N', nameFr: 'Galerie nord', nameEn: 'North mall',
      kind: 'mall', footprintIds: [],
    }, WRITE);
    const rule = createNamingRule({
      id: 'a2000000-0000-0000-0000-000000000211',
      target: 'door', pattern: 'P-{n}', maxLength: 12, uniquenessScope: 'building',
    }, WRITE);
    const level = createInformationLevel({
      id: 'a2000000-0000-0000-0000-000000000212',
      typologyId: TYPOLOGY, level: 2,
    }, WRITE);
    const step = createSequenceStep({
      id: 'a2000000-0000-0000-0000-000000000213',
      profileId: PROFILE, ordinal: 0, nodeId: NODE, expectedLevel: 2,
    }, WRITE);

    for (const out of [zone, rule, level, step]) {
      if (!out.ok) throw new Error(JSON.stringify(out.findings));
      const applied = await applyCommands(db, { userId: ALICE }, out.value);
      expect(applied.ok, JSON.stringify(applied)).toBe(true);
    }

    const zones = await alice`select code, name_en, kind from azimut.orientation_zone
      where site_id = ${SITE}`;
    expect(zones[0]?.['code']).toBe('GAL-N');
    expect(zones[0]?.['name_en']).toBe('North mall');

    const levels = await alice`select level from azimut.information_level
      where typology_id = ${TYPOLOGY}`;
    expect(levels[0]?.['level']).toBe(2);

    const steps = await alice`select ordinal from azimut.wayfinding_sequence
      where profile_id = ${PROFILE}`;
    expect(steps[0]?.['ordinal']).toBe(0);
  });

  it('ne franchissent pas la frontière d’organisation', async () => {
    const out = createOrientationZone({
      id: 'a2000000-0000-0000-0000-000000000219',
      code: 'VOL', nameFr: 'Volée', nameEn: 'Stolen',
      kind: 'core', footprintIds: [],
    }, { ...WRITE, orgId: ORG_B });
    if (!out.ok) throw new Error(JSON.stringify(out.findings));

    const applied = await applyCommands(db, { userId: ALICE }, out.value);
    expect(applied.ok).toBe(false);
    if (!applied.ok) expect(applied.findings[0]?.code).toBe('EDIT.WRITE_REFUSED');
  });

  it('restent invisibles à l’organisation voisine', async () => {
    const seen = await bob`select id from azimut.orientation_zone where site_id = ${SITE}`;
    expect(seen.length).toBe(0);
  });
});

function line(over: Partial<MessageLine> = {}): MessageLine {
  return {
    id: `${SUPPORT}#0#0`,
    support_id: SUPPORT,
    face_index: 0,
    block_index: 0,
    block_kind: 'destination_list',
    entries: [{
      destination_id: 'dest-1',
      text: { fr: 'Bureau RDC', en: 'Ground floor office' },
      direction: null,
      distance_m: 15.811,
    }],
    pictogram_id: null,
    direction: 'ahead',
    information_level: 2,
    decision_point_id: NODE,
    stale: false,
    ...over,
  };
}

function schedule(version: number, lines: readonly MessageLine[]): MessageSchedule {
  return {
    site_id: SITE,
    version,
    state: 'pending',
    generated_at: '2026-09-22T09:00:00.000Z',
    inputs_hash: 'sha256:abc',
    lines,
  };
}

describe('le tableau des messages et ses lignes', () => {
  const SCHEDULE = 'a2000000-0000-0000-0000-000000000220';
  const LINE_1 = 'a2000000-0000-0000-0000-000000000221';
  const LINE_2 = 'a2000000-0000-0000-0000-000000000222';

  it('s’écrivent en une seule transaction, et entrent en brouillon', async () => {
    const out = writeScheduleCommands(
      schedule(1, [line(), line({ id: `${SUPPORT}#0#1`, block_index: 1 })]),
      { orgId: ORG, siteId: SITE, scheduleId: SCHEDULE, timestamp: T,
        lineIds: [LINE_1, LINE_2] },
      new Map([[`${SUPPORT}#0#1`, {
        cap: 4, ruleRef: 'WAYFIND.MAX_DESTINATIONS',
        excludedPriority: 7, lastKeptPriority: 3,
      }]]),
    );
    if (!out.ok) throw new Error(JSON.stringify(out.findings));

    const applied = await applyCommands(db, { userId: ALICE }, out.value);
    expect(applied.ok, JSON.stringify(applied)).toBe(true);

    const head = await alice`select state, version from azimut.message_schedule
      where id = ${SCHEDULE}`;
    expect(head[0]?.['state']).toBe('draft');

    const lines = await alice`select id, excluded, exclusion_reason
      from azimut.message_line where schedule_id = ${SCHEDULE} order by block_index`;
    expect(lines.length).toBe(2);
    expect(lines[0]?.['excluded']).toBe(false);
    expect(lines[1]?.['excluded']).toBe(true);
    // M02.W9 : l'écartement est tracé. Le motif traverse l'aller-retour entier.
    expect(lines[1]?.['exclusion_reason']).toEqual({
      cap: 4, rule_ref: 'WAYFIND.MAX_DESTINATIONS',
      excluded_priority: 7, last_kept_priority: 3,
    });
  });

  it('tombent ensemble : une ligne refusée laisse la base sans tableau', async () => {
    const absent = 'a2000000-0000-0000-0000-000000000230';
    const out = writeScheduleCommands(
      schedule(2, [line(), line({ support_id: ABSENT, block_index: 1 })]),
      { orgId: ORG, siteId: SITE, scheduleId: absent, timestamp: T,
        lineIds: ['a2000000-0000-0000-0000-000000000231',
                  'a2000000-0000-0000-0000-000000000232'] },
    );
    if (!out.ok) throw new Error(JSON.stringify(out.findings));

    const applied = await applyCommands(db, { userId: ALICE }, out.value);
    expect(applied.ok).toBe(false);

    const head = await alice`select id from azimut.message_schedule where id = ${absent}`;
    expect(head.length).toBe(0);
  });
});

/**
 * Ce que la base refuse quand le constructeur est contourné.
 *
 * Les commandes du module produisent des lignes conformes ; ces essais posent
 * la question inverse — si quelque chose d'autre écrivait, la règle tiendrait-
 * elle ? M02.W4 et M02.W9 ne sont des règles opposables que si la réponse est oui.
 */
describe('M02.W4 et M02.W9 tenues par la base, et non par l’appelant', () => {
  const SCHEDULE = 'a2000000-0000-0000-0000-000000000240';

  beforeAll(async () => {
    const out = writeScheduleCommands(schedule(3, []), {
      orgId: ORG, siteId: SITE, scheduleId: SCHEDULE, timestamp: T, lineIds: [],
    });
    if (!out.ok) throw new Error(JSON.stringify(out.findings));
    const applied = await applyCommands(db, { userId: ALICE }, out.value);
    if (!applied.ok) throw new Error(JSON.stringify(applied.findings));
  });

  function rawLine(id: string, over: Readonly<Record<string, unknown>>): EntityCommand {
    const out = buildCommand({
      operation: 'create', module: '02-wayfinding', table: 'message_line',
      id, org_id: ORG,
      after: {
        id, org_id: ORG, schedule_id: SCHEDULE, support_id: SUPPORT,
        face_index: 0, block_index: 0, content: '{}', pictogram_id: null,
        direction: 'ahead', information_level: 2, decision_point_id: NODE,
        stale: false, excluded: false, exclusion_reason: null,
        ...over,
      } as Readonly<Record<string, string | number | boolean | null>>,
      timestamp: T,
    });
    if (!out.ok) throw new Error(JSON.stringify(out.findings));
    return out.value;
  }

  it('refuse une ligne sans point de décision (M02.W4)', async () => {
    const applied = await applyCommands(db, { userId: ALICE }, [
      rawLine('a2000000-0000-0000-0000-000000000241', { decision_point_id: null }),
    ]);
    expect(applied.ok).toBe(false);
  });

  it('refuse une ligne écartée sans motif (M02.W9)', async () => {
    const applied = await applyCommands(db, { userId: ALICE }, [
      rawLine('a2000000-0000-0000-0000-000000000242', {
        excluded: true, exclusion_reason: null,
      }),
    ]);
    expect(applied.ok).toBe(false);
  });

  it('refuse une direction hors des six de N2.2', async () => {
    const applied = await applyCommands(db, { userId: ALICE }, [
      rawLine('a2000000-0000-0000-0000-000000000243', { direction: 'nord' }),
    ]);
    expect(applied.ok).toBe(false);
  });
});

/**
 * `support.code` — la colonne que le module 02 possède dans une table qu'il ne
 * possède pas (L0), et que l'annexe Z rend requise.
 */
describe('le code d’un support', () => {
  it('s’écrit par la commande du module 02', async () => {
    const out = setSupportCode({ supportId: SUPPORT, previousCode: null, code: 'D-042' }, WRITE);
    if (!out.ok) throw new Error(JSON.stringify(out.findings));
    const applied = await applyCommands(db, { userId: ALICE }, out.value);
    expect(applied.ok, JSON.stringify(applied)).toBe(true);

    const rows = await alice`select code from azimut.support where id = ${SUPPORT}`;
    expect(rows[0]?.['code']).toBe('D-042');
  });

  it('ne se répète pas dans un même site', async () => {
    const out = setSupportCode({ supportId: SUPPORT_2, previousCode: null, code: 'D-042' }, WRITE);
    if (!out.ok) throw new Error(JSON.stringify(out.findings));
    const applied = await applyCommands(db, { userId: ALICE }, out.value);
    expect(applied.ok).toBe(false);
    if (!applied.ok) expect(applied.findings[0]?.code).toBe('EDIT.WRITE_REFUSED');
  });
});
