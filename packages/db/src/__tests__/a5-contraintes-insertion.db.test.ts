import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { enrolFixtureMembers } from '../fixture-membership.js';

/**
 * T-0.4, T-1.3, T-1.8 — les contraintes de A5 éprouvées par insertion réelle,
 * et non par lecture du SQL : pour chacune, une ligne valide passe et une ligne
 * qui la viole est refusée par la base.
 *
 * Seules les contraintes que la base porte sont éprouvées. `edge.width_m > 0`
 * et une borne sur `level.ordinal`, que l'audit d'avancement citait, n'existent
 * pas en base, et A5 ne les pose pas ; elles ne sont pas inventées ici.
 *
 * Tout se fait dans une transaction annulée.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];
const ORG = 'a5c00000-0000-4000-8000-0000000000a1';
const USER = 'a5c00000-0000-4000-8000-0000000000d1';
const SITE = 'a5c00000-0000-4000-8000-0000000000b1';
const BUILDING = 'a5c00000-0000-4000-8000-0000000000b2';
const LEVEL = 'a5c00000-0000-4000-8000-0000000000b3';
const FOOTPRINT = 'a5c00000-0000-4000-8000-0000000000c1';
const NODE_A = 'a5c00000-0000-4000-8000-0000000000e1';
const NODE_B = 'a5c00000-0000-4000-8000-0000000000e2';
const EDGE = 'a5c00000-0000-4000-8000-0000000000e3';
const SOURCE = 'a5c00000-0000-4000-8000-0000000000f1';
const CATEGORY = 'a5c00000-0000-4000-8000-0000000000f2';
const PACK = 'a5c00000-0000-4000-8000-0000000000f3';
const SAFETY = 'a5c00000-0000-4000-8000-0000000000f4';
const SQUARE = '{"vertices":[{"x_m":0,"y_m":0},{"x_m":4,"y_m":0},{"x_m":4,"y_m":4},{"x_m":0,"y_m":4}]}';

type Tx = postgres.TransactionSql;
let sql: postgres.Sql;

beforeAll(() => {
  if (URL === undefined || URL === '') {
    throw new Error('AZIMUT_TEST_DATABASE_URL absente. Voir packages/db/migrations/ORDRE.md.');
  }
  sql = postgres(URL, { onnotice: () => undefined });
});

afterAll(async () => { await sql.end(); });

async function inRolledBack(check: (tx: Tx) => Promise<void>): Promise<void> {
  const done = new Error('annulation voulue');
  await sql.begin(async tx => {
    await tx`select set_config('azimut.current_user_id', ${USER}, true)`;
    await tx`insert into azimut.organization(id,name,slug) values (${ORG},'A5','contraintes-a5')`;
    await enrolFixtureMembers(text => tx.unsafe(text), [{ orgId: ORG, userId: USER, role: 'designer' }]);
    await tx`insert into azimut.site(id,org_id,name,country_code,timezone) values (${SITE},${ORG},'Site','FR','Europe/Paris')`;
    await tx`insert into azimut.building(id,org_id,site_id,name) values (${BUILDING},${ORG},${SITE},'B')`;
    await tx`insert into azimut.level(id,org_id,building_id,name,ordinal,elevation_m) values (${LEVEL},${ORG},${BUILDING},'RDC',0,0)`;
    await tx`insert into azimut.footprint(id,org_id,level_id,kind,unit_code,geometry) values (${FOOTPRINT},${ORG},${LEVEL},'cell','C-1',${SQUARE}::text::jsonb)`;
    await tx`insert into azimut.node(id,org_id,level_id,kind,label,position) values
             (${NODE_A},${ORG},${LEVEL},'entrance','A','{"x_m":0,"y_m":0}'),
             (${NODE_B},${ORG},${LEVEL},'junction','B','{"x_m":5,"y_m":0}')`;
    await tx`insert into azimut.edge(id,org_id,from_node_id,to_node_id,length_m,width_m,slope_pct,accessible,direction)
             values (${EDGE},${ORG},${NODE_A},${NODE_B},5,1.4,0,true,'both')`;
    await tx`insert into azimut.plan_source(id,org_id,level_id,storage_path,media_type,content_kind)
             values (${SOURCE},${ORG},${LEVEL},'plans/essai.png','image/png','raster')`;
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

describe('A5.2 — le socle', () => {
  it('T-1.3 : un volume sans hauteur est refusé', async () => {
    await inRolledBack(async tx => {
      const volume = (h: number) => (sp: Tx) =>
        sp`insert into azimut.volume(org_id,footprint_id,base_elevation_m,height_m,material_key) values (${ORG},${FOOTPRINT},0,${h},'concrete')`;
      expect(await codeOf(tx, volume(3))).toBe('accepté');
      expect(await codeOf(tx, volume(0))).toBe('23514');
      expect(await codeOf(tx, volume(-1))).toBe('23514');
    });
  });

  it('une cellule sans code d’unité est refusée ; une circulation n’en demande pas', async () => {
    await inRolledBack(async tx => {
      const fp = (kind: string, code: string | null) => (sp: Tx) =>
        sp`insert into azimut.footprint(org_id,level_id,kind,unit_code,geometry) values (${ORG},${LEVEL},${kind},${code},${SQUARE}::text::jsonb)`;
      expect(await codeOf(tx, fp('circulation', null))).toBe('accepté');
      expect(await codeOf(tx, fp('cell', null))).toBe('23514');
      expect(await codeOf(tx, fp('cell', '  '))).toBe('23514');
      expect(await codeOf(tx, fp('salle', 'X'))).toBe('23514');
    });
  });

  it('les langues actives d’un site sont prises dans la liste, et l’origine va par paire', async () => {
    await inRolledBack(async tx => {
      expect(await codeOf(tx, sp => sp`update azimut.site set active_langs = '{fr,en}' where id = ${SITE}`)).toBe('accepté');
      expect(await codeOf(tx, sp => sp`update azimut.site set active_langs = '{fr,de}' where id = ${SITE}`)).toBe('23514');
      expect(await codeOf(tx, sp => sp`update azimut.site set active_langs = '{}' where id = ${SITE}`)).toBe('23514');
      expect(await codeOf(tx, sp => sp`update azimut.site set origin_x_m = 1, origin_y_m = null where id = ${SITE}`)).toBe('23514');
    });
  });

  it('une source de plan porte une nature connue ; un calage affine est complet, ses résidus ordonnés', async () => {
    await inRolledBack(async tx => {
      expect(await codeOf(tx, sp => sp`update azimut.plan_source set content_kind = 'pdf' where id = ${SOURCE}`)).toBe('23514');
      const calibration = (affineA: number | null, referenceM: number | null) => (sp: Tx) =>
        sp`insert into azimut.plan_calibration(org_id,plan_source_id,scale_m_per_px,rotation_deg,affine_a,reference_distance_m)
           values (${ORG},${SOURCE},0.05,0,${affineA},${referenceM})`;
      expect(await codeOf(tx, calibration(null, null))).toBe('accepté');
      expect(await codeOf(tx, calibration(1, null))).toBe('23514');
      expect(await codeOf(tx, calibration(null, 0))).toBe('23514');
      expect(await codeOf(tx, sp => sp`insert into azimut.plan_calibration(org_id,plan_source_id,scale_m_per_px,rotation_deg,mean_residual_m,max_residual_m)
                                       values (${ORG},${SOURCE},0.05,0,0.2,0.1)`)).toBe('23514');
    });
  });
});

describe('A5.3 — la circulation', () => {
  it('une arête ne boucle pas sur son nœud, et son sens est pris dans la liste', async () => {
    await inRolledBack(async tx => {
      const edge = (from: string, to: string, direction: string) => (sp: Tx) =>
        sp`insert into azimut.edge(org_id,from_node_id,to_node_id,length_m,width_m,slope_pct,accessible,direction)
           values (${ORG},${from},${to},5,1.4,0,true,${direction})`;
      expect(await codeOf(tx, edge(NODE_B, NODE_A, 'forward'))).toBe('accepté');
      expect(await codeOf(tx, edge(NODE_A, NODE_A, 'both'))).toBe('23514');
      expect(await codeOf(tx, edge(NODE_A, NODE_B, 'sideways'))).toBe('23514');
    });
  });

  it('une liaison verticale est d’une nature connue', async () => {
    await inRolledBack(async tx => {
      const link = (kind: string) => (sp: Tx) =>
        sp`insert into azimut.vertical_link(org_id,edge_id,kind,accessible) values (${ORG},${EDGE},${kind},true)`;
      expect(await codeOf(tx, link('ramp'))).toBe('accepté');
      expect(await codeOf(tx, link('toboggan'))).toBe('23514');
    });
  });
});

describe('A5.4 et T-1.8 — le registre de sécurité est en lecture seule en base', () => {
  it('un pictogramme de sécurité ne se modifie ni ne se supprime ; un pictogramme d’orientation, si', async () => {
    await inRolledBack(async tx => {
      await tx`insert into azimut.rules_pack(id,key,version,jurisdiction,effective_from,source_ref,checksum)
               values (${PACK},'essai-a5','0.0.0','XX','2026-01-01','essai','essai')`;
      await tx`insert into azimut.category(id,org_id,sector_key,code) values (${CATEGORY},${ORG},'common','exit')`;
      await tx`insert into azimut.pictogram(id,org_id,category_id,source,standard_ref,svg_path,registry,rules_pack_id)
               values (${SAFETY},${ORG},${CATEGORY},'internal','SF-001','M0 0h1','safety',${PACK})`;
      const [wayfinding] = await tx<{ id: string }[]>`
        insert into azimut.pictogram(org_id,category_id,source,standard_ref,svg_path,registry)
        values (${ORG},${CATEGORY},'internal','WF-001','M0 0h1','wayfinding') returning id`;
      expect(await codeOf(tx, sp => sp`update azimut.pictogram set svg_path = 'M0 0h2' where id = ${SAFETY}`)).toBe('P0001');
      expect(await codeOf(tx, sp => sp`delete from azimut.pictogram where id = ${SAFETY}`)).toBe('P0001');
      expect(await codeOf(tx, sp => sp`update azimut.pictogram set svg_path = 'M0 0h2' where id = ${wayfinding?.id ?? ''}`)).toBe('accepté');
      // Un pictogramme de sécurité vient d'un paquet de règles, jamais d'un import.
      expect(await codeOf(tx, sp => sp`insert into azimut.pictogram(org_id,category_id,source,standard_ref,svg_path,registry)
                                       values (${ORG},${CATEGORY},'import','SF-002','M0 0h1','safety')`)).toBe('23514');
    });
  });
});
