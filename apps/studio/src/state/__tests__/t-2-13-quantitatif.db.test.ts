import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createConnection, createDb, applyCommands, enrolFixtureMembers, withFixtureRole } from '@azimut/db';
import { startPostgrest, signToken, installPlatformStubs } from '@azimut/db/harness';
import type { Harness } from '@azimut/db/harness';
import type { EntityCommand } from '@azimut/core-model';
import { computeQuantities } from '@azimut/engine-graph';
import { createPostgrestRepository } from '../../data/postgrest-repository.js';
import { setAccessTokenSource } from '../../auth/access-token.js';
import { placedSupports } from '../../domain/trial-placement.js';

/**
 * T-2.13 — « les totaux se recoupent avec le nombre de supports en base. Écart
 * nul exigé, pas toléré. » Le site est relu au dépôt par le chemin de
 * l'atelier, le quantitatif calculé comme l'écran le calcule, et le total
 * comparé au décompte que la base elle-même rend.
 *
 * **Décor qui ne se retire pas** (supports rattachés à un site que la clé du
 * journal retient) : un site neuf par exécution, dans une organisation d'essai
 * que `db:reset` seul retire.
 */
const dsn = process.env['AZIMUT_TEST_DATABASE_URL'] ?? '';
const postgrestBinary = process.env['AZIMUT_TEST_POSTGREST'] ?? '';
const postgrestDbUri = process.env['AZIMUT_TEST_POSTGREST_DB_URI'] ?? '';
const jwtSecret = process.env['AZIMUT_TEST_JWT_SECRET'] ?? '';
const runnable = dsn !== '' && postgrestBinary !== '' && existsSync(postgrestBinary)
  && postgrestDbUri !== '' && jwtSecret !== '';

const ORG = '72130000-0000-4000-8000-0000000000a1';
const DESIGNER = '72130000-0000-4000-8000-0000000000d1';
const SITE = randomUUID();
const BUILDING = randomUUID();
const [RDC, R1] = [randomUUID(), randomUUID()];
const [N_RDC, N_R1] = [randomUUID(), randomUUID()];
const TYPOLOGY = randomUUID();
const T = '2026-11-28T10:00:00.000Z';
const API_KEY = 'cle-publiable-du-banc';

let client: ReturnType<typeof createConnection>;
let db: ReturnType<typeof createDb>;
let rest: Harness;

const create = (module: EntityCommand['module'], table: string, id: string, after: Record<string, string | number>): EntityCommand =>
  ({ operation: 'create', module, table, id, org_id: ORG, before: null, after: { id, org_id: ORG, ...after }, timestamp: T, groupKey: null });

describe.runIf(runnable)('T-2.13 — le quantitatif recoupe la base, écart nul', () => {
  beforeAll(async () => {
    client = createConnection(dsn);
    db = createDb(dsn);
    await withFixtureRole(client, tx => tx`insert into azimut.organization(id,name,slug) values (${ORG},'T-2.13','t-2-13-quantitatif')
                 on conflict (id) do nothing`);
    await enrolFixtureMembers(text => client.unsafe(text), [{ orgId: ORG, userId: DESIGNER, role: 'designer' }]);
    const supports = [N_RDC, N_RDC, N_R1, N_R1, N_R1].map((node, i) =>
      create('02-wayfinding', 'support', randomUUID(), { site_id: SITE, node_id: node, typology_id: TYPOLOGY, code: `D-${String(i + 1)}`, azimuth_deg: 0 }));
    const written = await applyCommands(db, { userId: DESIGNER }, [
      create('01-socle', 'site', SITE, { name: 'Site du quantitatif', country_code: 'FR', timezone: 'Europe/Paris' }),
      create('01-socle', 'building', BUILDING, { site_id: SITE, name: 'Galerie' }),
      create('01-socle', 'level', RDC, { building_id: BUILDING, name: 'RDC', ordinal: 0, elevation_m: 0 }),
      create('01-socle', 'level', R1, { building_id: BUILDING, name: 'R+1', ordinal: 1, elevation_m: 4 }),
      create('01-socle', 'node', N_RDC, { level_id: RDC, kind: 'junction', label: 'Hall', position: '{"x_m":0,"y_m":0}' }),
      create('01-socle', 'node', N_R1, { level_id: R1, kind: 'junction', label: 'Palier', position: '{"x_m":0,"y_m":0}' }),
      create('04-signaletique', 'support_typology', TYPOLOGY, { key: `dir-${TYPOLOGY.slice(0, 8)}`, name: 'Directionnel', face_count: 2 }),
      ...supports,
    ]);
    if (!written.ok) throw new Error(written.findings.map(f => f.code).join(', '));
    await installPlatformStubs(client);
    rest = await startPostgrest({ binary: postgrestBinary, dbUri: postgrestDbUri, port: 3998 });
  }, 60_000);

  afterAll(async () => {
    await rest.stop();
    await client.end();
    await db.$client.end();
  });

  it('le total, par typologie, par bâtiment et par niveau, égale le décompte de la base', async () => {
    const release = setAccessTokenSource(() => signToken(DESIGNER));
    const site = await createPostgrestRepository({ url: rest.url, apiKey: API_KEY, schema: 'azimut' }).loadSite(SITE).finally(release);
    const quantities = computeQuantities(site, placedSupports(site, ''));
    if (!quantities.ok) throw new Error(quantities.findings.map(f => f.code).join(','));

    const counted = await client.begin(async tx => {
      await tx`select set_config('azimut.current_user_id', ${DESIGNER}, true)`;
      return tx<{ level: string; n: number }[]>`
        select l.name as level, count(*)::int as n from azimut.support s
        join azimut.node n on n.id = s.node_id join azimut.level l on l.id = n.level_id
        where s.site_id = ${SITE} and s.deleted_at is null group by l.name order by l.name`;
    });
    const total = counted.reduce((sum, r) => sum + r.n, 0);
    expect(total).toBe(5);
    expect(quantities.value.total_supports).toBe(total);
    expect(quantities.value.cross_check_ok).toBe(true);
    expect(quantities.value.by_level.map(l => [l.level_name, l.count]).sort()).toEqual(counted.map(r => [r.level, r.n]));
    expect(quantities.value.total_faces).toBe(total * 2);
  });
});
