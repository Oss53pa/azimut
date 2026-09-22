import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { buildCommand } from '@azimut/core-model';
import type { EntityCommand } from '@azimut/core-model';
import { applyCommands } from '../write-path.js';
import { loadSiteData } from '../load-site-data.js';

/**
 * N1.7, critère 1 : « Un site modélisé se recharge à l'identique, géométrie et
 * graphe compris. »
 *
 * Le critère ne se prouve que contre une base. Un essai en mémoire vérifierait
 * que le modèle se recopie, ce qui n'est pas la question : ce qui s'éprouve
 * ici est l'aller-retour complet, écriture par le chemin d'écriture du module
 * 01, relecture par `loadSiteData`.
 *
 * Il demande donc `pnpm test:db`. Mise en place dans
 * `packages/db/migrations/ORDRE.md`. Sans base, la suite s'arrête avec le mode
 * d'emploi plutôt que de passer en silence.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];
const USER = '11111111-1111-1111-1111-111111111111';
const ORG = 'aaaaaaaa-0000-0000-0000-000000000001';

const SITE = 'a7000000-0000-0000-0000-000000000001';
const BUILDING = 'a7000000-0000-0000-0000-0000000000b1';
const LEVEL = 'a7000000-0000-0000-0000-0000000000c1';
const FOOTPRINT = 'a7000000-0000-0000-0000-0000000000d1';
const NODE_A = 'a7000000-0000-0000-0000-0000000000e1';
const NODE_B = 'a7000000-0000-0000-0000-0000000000e2';
const EDGE = 'a7000000-0000-0000-0000-0000000000f1';

const T = '2026-09-22T00:00:00.000Z';

/** Le contour écrit, et celui qu'on attend au retour. Angles droits, mètres. */
const GEOMETRY = {
  vertices: [
    { x_m: 0, y_m: 0 },
    { x_m: 12.345, y_m: 0 },
    { x_m: 12.345, y_m: 8.5 },
    { x_m: 0, y_m: 8.5 },
  ],
};

const POSITION_A = { x_m: 1.5, y_m: 2.25 };
const POSITION_B = { x_m: 11.5, y_m: 2.25 };

let client: postgres.Sql;
let db: ReturnType<typeof drizzle>;

/**
 * Relit sous l'identité de l'utilisateur, comme le chemin d'écriture écrit
 * sous la sienne.
 *
 * `loadSiteData` ne pose ni rôle ni identité : sous `FORCE ROW LEVEL
 * SECURITY`, appelé tel quel, il ne voit rien et lève « organization not
 * found ». C'est l'appelant qui doit ouvrir la transaction identifiée — et
 * c'est un manque du côté production, relevé en « constaté, non traité ».
 */
async function loadAs<T>(userId: string, read: (tx: never) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local role authenticated`);
    await tx.execute(sql`select set_config('azimut.current_user_id', ${userId}, true)`);
    return read(tx as never);
  });
}

function command(
  table: string,
  id: string,
  after: Readonly<Record<string, string | number | boolean>>,
): EntityCommand {
  const out = buildCommand({
    operation: 'create', module: '01-socle', table, id, org_id: ORG,
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
  client = postgres(URL);
  db = drizzle(client);

  // La suite se rejoue : elle part d'un état connu. L'amorçage de
  // l'organisation contourne les politiques, comme le ferait un import
  // d'administration, et les rétablit aussitôt.
  // `site` entre dans la liste : sous `FORCE ROW LEVEL SECURITY`, même le
  // propriétaire de la table ne supprime rien sans identité, et le nettoyage
  // échouerait en silence — laissant la suite buter sur une clé en double au
  // second passage.
  const seeded = ['site', 'membership', 'organization'];
  for (const table of seeded) {
    await db.execute(sql`alter table ${sql.identifier('azimut')}.${sql.identifier(table)} no force row level security`);
  }
  await db.execute(sql`delete from azimut.site where id = ${SITE}`);
  await db.execute(sql`insert into azimut.organization(id,name,slug) values (${ORG},'A','a') on conflict (id) do nothing`);
  await db.execute(sql`insert into azimut.membership(org_id,user_id,role) values (${ORG},${USER},'admin') on conflict do nothing`);
  for (const table of seeded) {
    await db.execute(sql`alter table ${sql.identifier('azimut')}.${sql.identifier(table)} force row level security`);
  }
});

afterAll(async () => {
  await db.execute(sql`alter table azimut.site no force row level security`);
  await db.execute(sql`delete from azimut.site where id = ${SITE}`);
  await db.execute(sql`alter table azimut.site force row level security`);
  await client.end();
});

describe('N1.7 critère 1 — un site modélisé se recharge à l’identique', () => {
  it('s’écrit entièrement par le chemin d’écriture du module 01', async () => {
    const written = await applyCommands(db, { userId: USER }, [
      command('site', SITE, {
        name: 'Site du rechargement', country_code: 'FR', timezone: 'Europe/Paris',
      }),
      command('building', BUILDING, { site_id: SITE, name: 'Bâtiment A' }),
      command('level', LEVEL, {
        building_id: BUILDING, name: 'R+1', ordinal: 1, elevation_m: 3.5,
      }),
      command('footprint', FOOTPRINT, {
        level_id: LEVEL, kind: 'cell', unit_code: 'B01',
        geometry: JSON.stringify(GEOMETRY),
      }),
      command('node', NODE_A, {
        level_id: LEVEL, kind: 'entrance', label: 'Entrée principale',
        position: JSON.stringify(POSITION_A),
      }),
      command('node', NODE_B, {
        level_id: LEVEL, kind: 'destination_access', label: 'Accès B01',
        position: JSON.stringify(POSITION_B),
      }),
      command('edge', EDGE, {
        from_node_id: NODE_A, to_node_id: NODE_B,
        width_m: 2.4, slope_pct: 0, accessible: true, direction: 'both',
        evacuation_route: true, length_m: 10,
      }),
    ]);
    expect(
      written.ok,
      written.ok ? '' : written.findings.map(f => f.code).join(', '),
    ).toBe(true);
  });

  it('rend la même géométrie, au millimètre', async () => {
    const site = await loadAs(USER, tx => loadSiteData(tx, ORG, SITE));
    const footprint = site.footprints.find(f => f.id === FOOTPRINT);
    expect(footprint, 'l’empreinte écrite doit revenir').toBeDefined();
    expect(footprint?.geometry).toEqual(GEOMETRY);
    expect(footprint?.kind).toBe('cell');
    expect(footprint?.unit_code).toBe('B01');
  });

  it('rend le même graphe, nœuds et arête compris', async () => {
    const site = await loadAs(USER, tx => loadSiteData(tx, ORG, SITE));

    const a = site.graph.nodes.find(n => n.id === NODE_A);
    const b = site.graph.nodes.find(n => n.id === NODE_B);
    expect(a?.kind).toBe('entrance');
    expect(a?.position).toEqual(POSITION_A);
    expect(b?.kind).toBe('destination_access');
    expect(b?.position).toEqual(POSITION_B);

    const edge = site.graph.edges.find(e => e.id === EDGE);
    expect(edge?.from_node_id).toBe(NODE_A);
    expect(edge?.to_node_id).toBe(NODE_B);
    expect(edge?.width_m).toBe(2.4);
    expect(edge?.accessible).toBe(true);
    expect(edge?.evacuation_route).toBe(true);
    expect(edge?.direction).toBe('both');
  });

  it('rend la même structure de site, bâtiment et niveau', async () => {
    const site = await loadAs(USER, tx => loadSiteData(tx, ORG, SITE));
    expect(site.site.name).toBe('Site du rechargement');
    expect(site.site.country_code).toBe('FR');
    expect(site.buildings.map(b => b.name)).toEqual(['Bâtiment A']);
    const level = site.levels.find(l => l.id === LEVEL);
    expect(level?.ordinal).toBe(1);
    expect(level?.elevation_m).toBe(3.5);
  });

  it('deux rechargements successifs rendent le même état', async () => {
    // C'est la lecture stricte du critère : « à l'identique ». Un chargement
    // qui varierait d'un appel à l'autre, par un tri non déterminé par
    // exemple, échouerait ici et nulle part ailleurs.
    const first = await loadAs(USER, tx => loadSiteData(tx, ORG, SITE));
    const second = await loadAs(USER, tx => loadSiteData(tx, ORG, SITE));
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});
