import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createConnection, createDb, applyCommands, enrolFixtureMembers } from '@azimut/db';
import { startPostgrest, signToken, installPlatformStubs } from '@azimut/db/harness';
import type { Harness } from '@azimut/db/harness';
import type { EntityCommand, SiteData } from '@azimut/core-model';
import { importSupports } from '@azimut/engine-graph';
import { createPostgrestRepository } from '../../data/postgrest-repository.js';
import { setAccessTokenSource } from '../../auth/access-token.js';
import { createJournaledSink } from '../journaled-sink.js';
import type { SinkConfig } from '../postgrest-sink.js';
import { carnetCommands, resolveCarnet } from '../carnet-import.js';

/**
 * T-1.13, décision Q11 — la reprise du carnet, sur base réelle, par le chemin
 * de l'atelier : PostgREST et le journal (0078). Les lignes prêtes s'écrivent
 * (support par le module 02, cotes par le 04, pose par le 08, QI5 ; version de pose vide, QI3), se
 * relisent dans le site, et le rapport dit le reste ligne à ligne.
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

const ORG = '71130000-0000-4000-8000-0000000000a1';
const DESIGNER = '71130000-0000-4000-8000-0000000000d1';
const SITE = randomUUID();
const BUILDING = randomUUID();
const LEVEL = randomUUID();
const NODE = randomUUID();
const TYPOLOGY = randomUUID();
// La typologie est à l'organisation, qui survit aux exécutions : une clé par
// exécution, pour que la clé désigne une seule typologie.
const TYPOLOGY_KEY = `directional-${TYPOLOGY.slice(0, 8)}`;
const T = '2026-11-28T10:00:00.000Z';
const API_KEY = 'cle-publiable-du-banc';

let client: ReturnType<typeof createConnection>;
let db: ReturnType<typeof createDb>;
let rest: Harness;

async function siteOf(): Promise<SiteData> {
  const release = setAccessTokenSource(() => signToken(DESIGNER));
  try {
    return await createPostgrestRepository({ url: rest.url, apiKey: API_KEY, schema: 'azimut' }).loadSite(SITE);
  } finally {
    release();
  }
}

describe.runIf(runnable)('T-1.13 — le carnet repris, écrit et relu par le journal', () => {
  beforeAll(async () => {
    client = createConnection(dsn);
    db = createDb(dsn);
    await client.unsafe('alter table azimut.organization no force row level security');
    await client`insert into azimut.organization(id,name,slug) values (${ORG},'T-1.13','t-1-13-carnet')
                 on conflict (id) do nothing`;
    await client.unsafe('alter table azimut.organization force row level security');
    await enrolFixtureMembers(text => client.unsafe(text), [{ orgId: ORG, userId: DESIGNER, role: 'designer' }]);
    const decor = [
      { table: 'site', id: SITE, after: { id: SITE, org_id: ORG, name: 'Site du carnet', country_code: 'FR', timezone: 'Europe/Paris' } },
      { table: 'building', id: BUILDING, after: { id: BUILDING, org_id: ORG, site_id: SITE, name: 'Galerie' } },
      { table: 'level', id: LEVEL, after: { id: LEVEL, org_id: ORG, building_id: BUILDING, name: 'RDC', ordinal: 0, elevation_m: 0 } },
      { table: 'node', id: NODE, after: { id: NODE, org_id: ORG, level_id: LEVEL, kind: 'junction', label: 'Hall', position: '{"x_m":0,"y_m":0}' } },
    ].map(d => ({ operation: 'create', module: '01-socle', org_id: ORG, timestamp: T, groupKey: null, before: null, ...d }) as EntityCommand);
    const typology = {
      operation: 'create', module: '04-signaletique', org_id: ORG, timestamp: T, groupKey: null, before: null,
      table: 'support_typology', id: TYPOLOGY, after: { id: TYPOLOGY, org_id: ORG, key: TYPOLOGY_KEY, name: 'Directionnel', face_count: 2 },
    } as EntityCommand;
    const written = await applyCommands(db, { userId: DESIGNER }, [...decor, typology]);
    if (!written.ok) throw new Error(written.findings.map(f => f.code).join(', '));
    await installPlatformStubs(client);
    rest = await startPostgrest({ binary: postgrestBinary, dbUri: postgrestDbUri, port: 3997 });
  }, 60_000);

  afterAll(async () => {
    await rest.stop();
    await client.end();
    await db.$client.end();
  });

  it('les lignes prêtes s’écrivent et se relisent ; les autres restent au rapport', async () => {
    const site = await siteOf();
    const csv = [
      'reference;typology;building;level;node_ref;x_m;y_m;azimuth_deg;width_mm;height_mm;condition;installed_at',
      `D-001;${TYPOLOGY_KEY};Galerie;RDC;${NODE};;;90;;;good;2024-05-02`,
      `D-002;${TYPOLOGY_KEY};Galerie;RDC;${NODE};;;270;600;900;;`,
      `D-003;${TYPOLOGY_KEY};Galerie;RDC;;3;4;90;;;;`,
      `D-004;totem;Galerie;RDC;${NODE};;;90;;;;`,
    ].join('\n');
    const report = importSupports(site, csv);
    if (!report.ok) throw new Error(report.findings.map(f => f.code).join(','));
    const lines = resolveCarnet(report.value, site);
    expect(lines.map(l => l.status)).toEqual(['ready', 'ready', 'pending', 'rejected']);

    const commands = carnetCommands(lines, site, {
      orgId: ORG, siteId: SITE, timestamp: T, groupKey: 'carnet', newId: () => randomUUID(),
    });
    if (!commands.ok) throw new Error(commands.findings.map(f => f.code).join(','));
    const config: SinkConfig = { url: rest.url, apiKey: API_KEY, schema: 'azimut', accessToken: signToken(DESIGNER) };
    const sent = await createJournaledSink(config, { siteId: SITE, levelId: null })(commands.value);
    if (!sent.ok) throw new Error(sent.findings.map(f => `${f.code}:${String(f.params['cause'])}`).join(','));

    const reread = await siteOf();
    const byCode = new Map(reread.supports.map(s => [s.code, s]));
    expect([...byCode.keys()].sort()).toEqual(['D-001', 'D-002']);
    expect(byCode.get('D-001')).toMatchObject({ node_id: NODE, azimuth_deg: 90, typology_id: TYPOLOGY });
    expect(byCode.get('D-002')).toMatchObject({ width_mm: 600, height_mm: 900, dimensions_source: 'overridden' });

    const installed = await client.begin(async tx => {
      await tx`select set_config('azimut.current_user_id', ${DESIGNER}, true)`;
      return tx<{ code: string; installed_version: number | null; condition: string; installed_at: Date }[]>`
        select s.code, i.installed_version, i.condition, i.installed_at
        from azimut.installed_support i join azimut.support s on s.id = i.support_id
        where s.site_id = ${SITE}`;
    });
    expect(installed.map(r => [r.code, r.installed_version, r.condition])).toEqual([['D-001', null, 'good']]);

    // Le journal porte les commandes, dans l'ordre : l'autre poste les reçoit.
    const journal = await client.begin(async tx => {
      await tx`select set_config('azimut.current_user_id', ${DESIGNER}, true)`;
      return tx<{ t: string; m: string }[]>`
        select command->>'table' as t, command->>'module' as m from azimut.command_journal
        where site_id = ${SITE} order by seq`;
    });
    expect(journal.map(r => `${r.m}:${r.t}`)).toEqual([
      '02-wayfinding:support', '08-exploitation:installed_support', '02-wayfinding:support', '04-signaletique:support',
    ]);
  });
});
