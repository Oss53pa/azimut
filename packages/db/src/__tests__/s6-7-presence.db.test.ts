import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { buildCommand, serializeCommand } from '@azimut/core-model';
import { enrolFixtureMembers } from '../fixture-membership.js';
import { inFixtureRole } from '../fixture-role.js';

/**
 * S6.7b, migration 0081 — la présence sur un niveau.
 *
 * Ce qui s'éprouve : un membre s'annonce et ses collègues le voient, sous son
 * nom affiché ou, à défaut, son rôle ; la sélection et la zone sont validées
 * par schéma en base ; personne n'écrit la présence d'un autre ni ne
 * s'annonce sur le niveau d'une autre organisation ; l'auditor voit sans
 * s'annoncer ; une présence non renouvelée disparaît ; l'heure de la
 * dernière modification vient du journal.
 *
 * Tout se fait dans une transaction annulée : rien ne reste en base.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];
const ORG = 'a6700000-0000-4000-8000-0000000000a1';
const OTHER_ORG = 'a6700000-0000-4000-8000-0000000000a2';
const SITE = 'a6700000-0000-4000-8000-0000000000b1';
const BUILDING = 'a6700000-0000-4000-8000-0000000000b2';
const LEVEL = 'a6700000-0000-4000-8000-0000000000b3';
const OTHER_SITE = 'a6700000-0000-4000-8000-0000000000c1';
const OTHER_BUILDING = 'a6700000-0000-4000-8000-0000000000c2';
const OTHER_LEVEL = 'a6700000-0000-4000-8000-0000000000c3';
const DESIGNER = 'a6700000-0000-4000-8000-0000000000d1';
const COLLEAGUE = 'a6700000-0000-4000-8000-0000000000d2';
const AUDITOR = 'a6700000-0000-4000-8000-0000000000d3';
const STRANGER = 'a6700000-0000-4000-8000-0000000000d4';
const NODE = 'a6700000-0000-4000-8000-0000000000e1';
const ZONE = { x: 1.5, y: -2, w: 30, h: 18.25 };

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
    await tx`insert into azimut.organization(id,name,slug)
             values (${ORG},'S6.7','s6-presence'),(${OTHER_ORG},'S6.7 bis','s6-presence-bis')`;
    await enrolFixtureMembers(text => tx.unsafe(text), [
      { orgId: ORG, userId: DESIGNER, role: 'designer' },
      { orgId: ORG, userId: COLLEAGUE, role: 'designer' },
      { orgId: ORG, userId: AUDITOR, role: 'auditor' },
      { orgId: OTHER_ORG, userId: STRANGER, role: 'admin' },
    ]);
    // Q12 — le nom affiché se saisit par le chemin d'administration ; ici, par
    // le rôle de décor du banc, le temps de l'écrire.
    await inFixtureRole(tx, () => tx`update azimut.membership set display_name = 'Camille' where user_id = ${COLLEAGUE}`);
    for (const [org, site, building, level] of [
      [ORG, SITE, BUILDING, LEVEL], [OTHER_ORG, OTHER_SITE, OTHER_BUILDING, OTHER_LEVEL],
    ] as const) {
      await tx`select set_config('azimut.current_user_id', ${org === ORG ? DESIGNER : STRANGER}, true)`;
      await tx`insert into azimut.site(id,org_id,name,country_code,timezone) values (${site},${org},'Site','FR','Europe/Paris')`;
      await tx`insert into azimut.building(id,org_id,site_id,name) values (${building},${org},${site},'Bâtiment')`;
      await tx`insert into azimut.level(id,org_id,building_id,name,ordinal,elevation_m) values (${level},${org},${building},'RDC',0,0)`;
    }
    await tx`set local role authenticated`;
    await check(tx);
    throw done;
  }).catch((e: unknown) => { if (e !== done) throw e; });
}

async function as(tx: postgres.TransactionSql, userId: string): Promise<void> {
  await tx`select set_config('azimut.current_user_id', ${userId}, true)`;
}

function touch(tx: postgres.TransactionSql, level: string, selection: unknown, zone: unknown) {
  return tx`select azimut.touch_presence(${level}, ${JSON.stringify(selection)}::text::jsonb,
                                         ${zone === null ? null : JSON.stringify(zone)}::text::jsonb)`;
}

type Present = {
  user_id: string; display_name: string | null; role: string;
  selection: unknown; zone: unknown; last_change_at: Date | null;
};

function list(tx: postgres.TransactionSql, level: string) {
  return tx<Present[]>`select user_id, display_name, role, selection, zone, last_change_at
                       from azimut.level_presence_list(${level})`;
}

async function refusal(tx: postgres.TransactionSql, run: () => Promise<unknown>): Promise<string> {
  try {
    await tx.savepoint(async () => { await run(); });
  } catch (e: unknown) {
    const code = (e as { code?: unknown }).code;
    return typeof code === 'string' ? code : '?';
  }
  return 'accepté';
}

describe('S6.7b — la présence sur un niveau', () => {
  it('un membre s’annonce ; ses collègues le voient, sous son nom ou son rôle', async () => {
    await inRolledBack(async tx => {
      await as(tx, COLLEAGUE);
      await touch(tx, LEVEL, [{ table: 'node', id: NODE }], ZONE);
      await as(tx, DESIGNER);
      await touch(tx, LEVEL, [], null);

      const seen = await list(tx, LEVEL);
      const colleague = seen.find(p => p.user_id === COLLEAGUE);
      expect(colleague?.display_name).toBe('Camille');
      expect(colleague?.role).toBe('designer');
      expect(colleague?.selection).toEqual([{ table: 'node', id: NODE }]);
      expect(colleague?.zone).toEqual(ZONE);
      const designer = seen.find(p => p.user_id === DESIGNER);
      expect(designer?.display_name).toBeNull();
      expect(designer?.zone).toBeNull();
    });
  });

  it('s’annoncer à nouveau remplace, sans doublon', async () => {
    await inRolledBack(async tx => {
      await as(tx, COLLEAGUE);
      await touch(tx, LEVEL, [{ table: 'node', id: NODE }], ZONE);
      await touch(tx, LEVEL, [], null);
      const seen = (await list(tx, LEVEL)).filter(p => p.user_id === COLLEAGUE);
      expect(seen).toHaveLength(1);
      expect(seen[0]?.selection).toEqual([]);
    });
  });

  it('une sélection ou une zone hors schéma est refusée par la base', async () => {
    await inRolledBack(async tx => {
      await as(tx, COLLEAGUE);
      const tooMany = Array.from({ length: 51 }, () => ({ table: 'node', id: NODE }));
      for (const [selection, zone] of [
        [[{}], null],
        [[{ table: 'node', id: NODE, extra: 1 }], null],
        [[{ table: 'Node; drop', id: NODE }], null],
        [[{ table: 'node', id: 'pas-un-uuid' }], null],
        [tooMany, null],
        [{ table: 'node', id: NODE }, null],
        [[], {}],
        [[], { x: 0, y: 0, w: 0, h: 1 }],
        [[], { x: '0', y: 0, w: 1, h: 1 }],
        [[], { x: 0, y: 0, w: 1, h: 1, z: 2 }],
      ] as const) {
        expect(await refusal(tx, () => touch(tx, LEVEL, selection, zone))).toBe('23514');
      }
    });
  });

  it('personne n’écrit la présence d’un autre', async () => {
    await inRolledBack(async tx => {
      await as(tx, COLLEAGUE);
      expect(await refusal(tx, () => tx`
        insert into azimut.level_presence(org_id, level_id, user_id) values (${ORG}, ${LEVEL}, ${DESIGNER})`))
        .toBe('42501');
      await touch(tx, LEVEL, [], null);
      await as(tx, DESIGNER);
      const changed = await tx`update azimut.level_presence set selection = '[]' where user_id = ${COLLEAGUE}`;
      expect(changed.count).toBe(0);
      const removed = await tx`delete from azimut.level_presence where user_id = ${COLLEAGUE}`;
      expect(removed.count).toBe(0);
    });
  });

  it('une autre organisation ne voit rien, et ne s’annonce pas sur ce niveau', async () => {
    await inRolledBack(async tx => {
      await as(tx, COLLEAGUE);
      await touch(tx, LEVEL, [], ZONE);
      await as(tx, STRANGER);
      expect(await list(tx, LEVEL)).toEqual([]);
      expect(await refusal(tx, () => touch(tx, LEVEL, [], null))).toBe('42501');
      expect(await tx`select * from azimut.member_label(${ORG}, ${COLLEAGUE})`).toEqual([]);
      // Sa propre organisation lui reste ouverte.
      await touch(tx, OTHER_LEVEL, [], null);
      expect((await list(tx, OTHER_LEVEL)).map(p => p.user_id)).toEqual([STRANGER]);
    });
  });

  it('le passage vers les noms se referme : membership reste fermée en lecture directe', async () => {
    await inRolledBack(async tx => {
      await as(tx, DESIGNER);
      expect(await tx`select display_name, role from azimut.member_label(${ORG}, ${COLLEAGUE})`)
        .toEqual([{ display_name: 'Camille', role: 'designer' }]);
      const [flag] = await tx<{ v: string | null }[]>`select current_setting('azimut.member_label_org', true) as v`;
      expect(flag?.v ?? '').toBe('');
      const rows = await tx<{ user_id: string }[]>`select user_id from azimut.membership where org_id = ${ORG}`;
      expect(rows.map(r => r.user_id)).toEqual([DESIGNER]);
    });
  });

  it('l’auditor voit qui est présent, et ne s’annonce pas', async () => {
    await inRolledBack(async tx => {
      await as(tx, COLLEAGUE);
      await touch(tx, LEVEL, [], null);
      await as(tx, AUDITOR);
      expect((await list(tx, LEVEL)).map(p => p.user_id)).toEqual([COLLEAGUE]);
      expect(await refusal(tx, () => touch(tx, LEVEL, [], null))).toBe('42501');
    });
  });

  it('l’heure de présence est posée par la base ; une présence ancienne disparaît', async () => {
    await inRolledBack(async tx => {
      await as(tx, COLLEAGUE);
      await tx`insert into azimut.level_presence(org_id, level_id, seen_at)
               values (${ORG}, ${LEVEL}, now() + interval '1 day')`;
      const [row] = await tx<{ future: boolean }[]>`
        select seen_at > now() as future from azimut.level_presence where user_id = ${COLLEAGUE}`;
      expect(row?.future).toBe(false);

      // Vieillir la ligne demande d'écarter le déclencheur : la connexion
      // propriétaire le fait, le temps d'une écriture.
      await tx`reset role`;
      await tx.unsafe('alter table azimut.level_presence disable trigger stamp_level_presence');
      await tx`update azimut.level_presence set seen_at = now() - interval '31 seconds' where user_id = ${COLLEAGUE}`;
      await tx.unsafe('alter table azimut.level_presence enable trigger stamp_level_presence');
      await tx`set local role authenticated`;
      expect(await list(tx, LEVEL)).toEqual([]);
    });
  });

  it('partir retire la présence', async () => {
    await inRolledBack(async tx => {
      await as(tx, COLLEAGUE);
      await touch(tx, LEVEL, [], null);
      await tx`select azimut.leave_presence(${LEVEL})`;
      expect(await list(tx, LEVEL)).toEqual([]);
    });
  });

  it('la dernière modification se lit dans le journal du niveau', async () => {
    await inRolledBack(async tx => {
      await as(tx, DESIGNER);
      await touch(tx, LEVEL, [], null);
      expect((await list(tx, LEVEL))[0]?.last_change_at).toBeNull();

      const built = buildCommand({
        operation: 'update', module: '01-socle', table: 'level', id: LEVEL, org_id: ORG,
        before: { name: 'RDC' }, after: { name: 'Rez-de-chaussée' }, timestamp: '2026-11-22T10:00:00.000Z',
      });
      if (!built.ok) throw new Error('commande');
      const text = serializeCommand(built.value);
      if (!text.ok) throw new Error('écriture');
      await tx`select azimut.apply_journaled_commands(${SITE}, ${LEVEL}, ${JSON.stringify([JSON.parse(text.value)])}::text::jsonb)`;
      expect((await list(tx, LEVEL))[0]?.last_change_at).toBeInstanceOf(Date);
    });
  });
});
