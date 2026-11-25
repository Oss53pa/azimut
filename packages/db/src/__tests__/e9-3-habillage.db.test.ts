import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { enrolFixtureMembers } from '../fixture-membership.js';

/**
 * Migration 0086 — l'habillage en base (E9.3, décisions Q6 et Q7).
 *
 * Ce qui s'éprouve : une couche et une forme bien formées s'écrivent ; une
 * géométrie ou un style hors de leur forme, une couleur à la place d'un rôle,
 * une nature qui ne suit pas la géométrie sont refusés ; une couche ne se
 * rattache pas au niveau d'un autre site, une forme pas à la couche d'une
 * autre organisation ; un auditeur n'écrit pas.
 *
 * Tout se fait dans des transactions annulées.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];
const ORG = 'e9300000-0000-4000-8000-0000000000a1';
const OTHER_ORG = 'e9300000-0000-4000-8000-0000000000a2';
const SITE = 'e9300000-0000-4000-8000-0000000000b1';
const OTHER_SITE = 'e9300000-0000-4000-8000-0000000000b4';
const BUILDING = 'e9300000-0000-4000-8000-0000000000b2';
const LEVEL = 'e9300000-0000-4000-8000-0000000000b3';
const LAYER = 'e9300000-0000-4000-8000-0000000000c1';
const DESIGNER = 'e9300000-0000-4000-8000-0000000000d1';
const AUDITOR = 'e9300000-0000-4000-8000-0000000000d2';
const OUTSIDER = 'e9300000-0000-4000-8000-0000000000d3';

const RECT = '{"type":"rectangle","origin":{"x_m":0,"y_m":0},"width_m":2,"height_m":1}';
const STYLE = '{"fill_role":"decoration.fill","stroke_role":null,"stroke_width_m":0.02,"opacity":1}';

let sql: postgres.Sql;

beforeAll(() => {
  if (URL === undefined || URL === '') {
    throw new Error('AZIMUT_TEST_DATABASE_URL absente. Voir packages/db/migrations/ORDRE.md.');
  }
  sql = postgres(URL, { onnotice: () => undefined });
});

afterAll(async () => { await sql.end(); });

type Tx = postgres.TransactionSql;

async function inRolledBack(check: (tx: Tx) => Promise<void>): Promise<void> {
  const done = new Error('annulation voulue');
  await sql.begin(async tx => {
    await tx`select set_config('azimut.current_user_id', ${DESIGNER}, true)`;
    await tx`insert into azimut.organization(id,name,slug) values (${ORG},'0086','habillage-0086'), (${OTHER_ORG},'0086 bis','habillage-0086-bis')`;
    await enrolFixtureMembers(text => tx.unsafe(text), [
      { orgId: ORG, userId: DESIGNER, role: 'designer' },
      { orgId: ORG, userId: AUDITOR, role: 'auditor' },
      { orgId: OTHER_ORG, userId: OUTSIDER, role: 'designer' },
    ]);
    await tx`insert into azimut.site(id,org_id,name,country_code,timezone) values
             (${SITE},${ORG},'Site','FR','Europe/Paris'), (${OTHER_SITE},${ORG},'Autre site','FR','Europe/Paris')`;
    await tx`insert into azimut.building(id,org_id,site_id,name) values (${BUILDING},${ORG},${SITE},'B')`;
    await tx`insert into azimut.level(id,org_id,building_id,name,ordinal,elevation_m) values (${LEVEL},${ORG},${BUILDING},'RDC',0,0)`;
    await tx`insert into azimut.decoration_layer(id,org_id,site_id,level_id,name) values (${LAYER},${ORG},${SITE},${LEVEL},'Habillage')`;
    await check(tx);
    throw done;
  }).catch((e: unknown) => { if (e !== done) throw e; });
}

async function codeOf(tx: Tx, run: (sp: Tx) => Promise<unknown>): Promise<string> {
  try {
    await tx.savepoint(async sp => { await run(sp); });
  } catch (e: unknown) {
    const code = (e as { code?: unknown }).code;
    return typeof code === 'string' ? code : '?';
  }
  return 'accepté';
}

const shape = (tx: Tx, kind: string, geometry: string, style = STYLE, org = ORG, layer = LAYER) =>
  tx`insert into azimut.decoration_shape(org_id, layer_id, kind, geometry, style)
     values (${org}, ${layer}, ${kind}, ${geometry}::text::jsonb, ${style}::text::jsonb)`;

describe('0086 — les formes de la géométrie et du style', () => {
  it('une forme bien formée s’écrit, pour chaque géométrie', async () => {
    await inRolledBack(async tx => {
      expect(await codeOf(tx, sp => shape(sp, 'area', RECT))).toBe('accepté');
      expect(await codeOf(tx, sp => shape(sp, 'area', '{"type":"polygon","points":[{"x_m":0,"y_m":0},{"x_m":1,"y_m":0},{"x_m":0,"y_m":1}]}'))).toBe('accepté');
      expect(await codeOf(tx, sp => shape(sp, 'area', '{"type":"ellipse","center":{"x_m":0,"y_m":0},"rx_m":1,"ry_m":2}'))).toBe('accepté');
      expect(await codeOf(tx, sp => shape(sp, 'path', '{"type":"polyline","points":[{"x_m":0,"y_m":0},{"x_m":1,"y_m":0}]}'))).toBe('accepté');
      expect(await codeOf(tx, sp => shape(sp, 'symbol', '{"type":"symbol_ref","position":{"x_m":0,"y_m":0},"symbol_id":"arbre.feuillu","scale":1}'))).toBe('accepté');
    });
  });

  it('refuse une géométrie hors de sa forme', async () => {
    await inRolledBack(async tx => {
      const refused = [
        '{"type":"rectangle","origin":{"x_m":0,"y_m":0},"width_m":0,"height_m":1}',
        '{"type":"rectangle","origin":{"x_m":0,"y_m":0},"width_m":1,"height_m":1,"extra":1}',
        '{"type":"polygon","points":[{"x_m":0,"y_m":0},{"x_m":1,"y_m":0}]}',
        '{"type":"polyline","points":[{"x_m":0,"y_m":"0"},{"x_m":1,"y_m":0}]}',
        '{"type":"circle","center":{"x_m":0,"y_m":0}}',
        '[]',
      ];
      for (const geometry of refused) {
        const kind = geometry.includes('polyline') ? 'path' : 'area';
        expect(await codeOf(tx, sp => shape(sp, kind, geometry))).toBe('23514');
      }
    });
  });

  it('refuse une couleur à la place d’un rôle, et un style hors de sa forme', async () => {
    await inRolledBack(async tx => {
      const refused = [
        '{"fill_role":"#rouge","stroke_role":null,"stroke_width_m":0.02,"opacity":1}',
        '{"fill_role":"rgb(255,0,0)","stroke_role":null,"stroke_width_m":0.02,"opacity":1}',
        '{"fill_role":"hsl(0,100%,50%)","stroke_role":null,"stroke_width_m":0.02,"opacity":1}',
        '{"fill_role":null,"stroke_role":null,"stroke_width_m":0.02,"opacity":1.5}',
        '{"fill_role":null,"stroke_role":null,"stroke_width_m":0.02,"opacity":1,"couleur":"noir"}',
        '{"fill_role":null,"stroke_role":null}',
      ];
      for (const style of refused) {
        expect(await codeOf(tx, sp => shape(sp, 'area', RECT, style))).toBe('23514');
      }
    });
  });

  it('refuse une nature qui ne suit pas la géométrie', async () => {
    await inRolledBack(async tx => {
      expect(await codeOf(tx, sp => shape(sp, 'path', RECT))).toBe('23514');
      expect(await codeOf(tx, sp => shape(sp, 'symbol', RECT))).toBe('23514');
      expect(await codeOf(tx, sp => shape(sp, 'decor', RECT))).toBe('23514');
    });
  });
});

describe('0086 — les rattachements et le cloisonnement', () => {
  it('une couche ne se rattache pas au niveau d’un autre site', async () => {
    await inRolledBack(async tx => {
      expect(await codeOf(tx, sp => sp`insert into azimut.decoration_layer(org_id,site_id,level_id,name)
                                       values (${ORG},${OTHER_SITE},${LEVEL},'Ailleurs')`)).toBe('23514');
      expect(await codeOf(tx, sp => sp`update azimut.decoration_layer set site_id = ${OTHER_SITE} where id = ${LAYER}`)).toBe('23514');
    });
  });

  it('sous le rôle des postes : un membre d’une autre organisation ne vise pas la couche, un auditeur n’écrit pas', async () => {
    await inRolledBack(async tx => {
      await tx`set local role authenticated`;
      await tx`select set_config('azimut.current_user_id', ${OUTSIDER}, true)`;
      const outsider = await codeOf(tx, sp => shape(sp, 'area', RECT, STYLE, OTHER_ORG));
      const unseen = await tx<{ n: number }[]>`select count(*)::int as n from azimut.decoration_layer`;
      await tx`select set_config('azimut.current_user_id', ${AUDITOR}, true)`;
      const auditor = await codeOf(tx, sp => shape(sp, 'area', RECT));
      await tx`select set_config('azimut.current_user_id', ${DESIGNER}, true)`;
      const designer = await codeOf(tx, sp => shape(sp, 'area', RECT));
      expect([outsider, unseen[0]?.n, auditor, designer]).toEqual(['23514', 0, '42501', 'accepté']);
    });
  });
});
