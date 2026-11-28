import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createConnection, createDb, applyCommands, enrolFixtureMembers, withFixtureRole } from '@azimut/db';
import { startPostgrest, signToken, installPlatformStubs } from '@azimut/db/harness';
import type { Harness } from '@azimut/db/harness';
import type { EntityCommand, SiteData } from '@azimut/core-model';
import { VOLUME_MATERIALS } from '@azimut/db/reference';
import { createPostgrestRepository } from '../../data/postgrest-repository.js';
import { setAccessTokenSource } from '../../auth/access-token.js';
import { createJournaledSink } from '../journaled-sink.js';
import type { SinkConfig } from '../postgrest-sink.js';
import { sessionRowsFromSite } from '../session-from-site.js';
import { acceptVolume, volumeCommand, volumeDefaults } from '../volume-input.js';

/**
 * T-1.3 — le volume d'une empreinte, sur base réelle, par le chemin de
 * l'atelier : PostgREST et le journal (0078). Le volume se crée avec les
 * valeurs du niveau, se modifie sans se dédoubler, se relit dans le site ; la
 * base refuse une matière hors de la liste même portée par une commande bien
 * formée.
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

const ORG = '71030000-0000-4000-8000-0000000000a1';
const DESIGNER = '71030000-0000-4000-8000-0000000000d1';
const SITE = randomUUID();
const BUILDING = randomUUID();
const [RDC, R1] = [randomUUID(), randomUUID()];
const FOOTPRINT = randomUUID();
const T = '2026-11-28T10:00:00.000Z';
const API_KEY = 'cle-publiable-du-banc';
const KEYS = VOLUME_MATERIALS.map(m => m.key);
const SQUARE = '{"vertices":[{"x_m":0,"y_m":0},{"x_m":4,"y_m":0},{"x_m":4,"y_m":4},{"x_m":0,"y_m":4}]}';

let client: ReturnType<typeof createConnection>;
let db: ReturnType<typeof createDb>;
let rest: Harness;
let config: SinkConfig;

async function siteOf(): Promise<SiteData> {
  const release = setAccessTokenSource(() => signToken(DESIGNER));
  try {
    return await createPostgrestRepository({ url: rest.url, apiKey: API_KEY, schema: 'azimut' }).loadSite(SITE);
  } finally {
    release();
  }
}

const send = (commands: readonly EntityCommand[]) =>
  createJournaledSink(config, { siteId: SITE, levelId: RDC })(commands);

describe.runIf(runnable)('T-1.3 — le volume écrit et relu par le journal', () => {
  beforeAll(async () => {
    client = createConnection(dsn);
    db = createDb(dsn);
    await withFixtureRole(client, tx => tx`insert into azimut.organization(id,name,slug) values (${ORG},'T-1.3','t-1-3-volume')
                 on conflict (id) do nothing`);
    await enrolFixtureMembers(text => client.unsafe(text), [{ orgId: ORG, userId: DESIGNER, role: 'designer' }]);
    const decor = [
      { table: 'site', id: SITE, after: { id: SITE, org_id: ORG, name: 'Site des volumes', country_code: 'FR', timezone: 'Europe/Paris' } },
      { table: 'building', id: BUILDING, after: { id: BUILDING, org_id: ORG, site_id: SITE, name: 'Galerie' } },
      { table: 'level', id: RDC, after: { id: RDC, org_id: ORG, building_id: BUILDING, name: 'RDC', ordinal: 0, elevation_m: 0 } },
      { table: 'level', id: R1, after: { id: R1, org_id: ORG, building_id: BUILDING, name: 'R+1', ordinal: 1, elevation_m: 4.2 } },
      { table: 'footprint', id: FOOTPRINT, after: { id: FOOTPRINT, org_id: ORG, level_id: RDC, kind: 'cell', unit_code: 'V-1', geometry: SQUARE } },
    ].map(d => ({ operation: 'create', module: '01-socle', org_id: ORG, timestamp: T, groupKey: null, before: null, ...d }) as EntityCommand);
    const written = await applyCommands(db, { userId: DESIGNER }, decor);
    if (!written.ok) throw new Error(written.findings.map(f => f.code).join(', '));
    await installPlatformStubs(client);
    rest = await startPostgrest({ binary: postgrestBinary, dbUri: postgrestDbUri, port: 3992 });
    config = { url: rest.url, apiKey: API_KEY, schema: 'azimut', accessToken: signToken(DESIGNER) };
  }, 60_000);

  afterAll(async () => {
    await rest.stop();
    await client.end();
    await db.$client.end();
  });

  it('le volume se crée aux valeurs du niveau, puis se modifie sans se dédoubler', async () => {
    const site = await siteOf();
    const defaults = volumeDefaults(site.levels, RDC);
    expect(defaults).toEqual({ base_elevation_m: 0, height_m: 4.2 });

    const created = acceptVolume({
      footprintId: FOOTPRINT, base_elevation_m: defaults?.base_elevation_m ?? null,
      height_m: defaults?.height_m ?? null, material_key: 'masonry',
    }, KEYS);
    if (!created.ok) throw new Error('volume refusé');
    const create = volumeCommand(created.value, null, { orgId: ORG, timestamp: T, newId: randomUUID() });
    if (!create.ok) throw new Error(create.findings.map(f => f.code).join(','));
    const first = await send([create.value]);
    if (!first.ok) throw new Error(first.findings.map(f => `${f.code}:${String(f.params['cause'])}`).join(','));

    const reread = await siteOf();
    expect(reread.volumes.map(v => [v.footprint_id, v.base_elevation_m, v.height_m, v.material_key]))
      .toEqual([[FOOTPRINT, 0, 4.2, 'masonry']]);

    // La session de l'atelier porte le volume relu : la modification part de lui.
    const row = sessionRowsFromSite(reread).find(r => r.table === 'volume');
    if (row === undefined) throw new Error('volume absent de la session');
    const changed = acceptVolume({ footprintId: FOOTPRINT, base_elevation_m: 0, height_m: 3.5, material_key: 'glass' }, KEYS);
    if (!changed.ok) throw new Error('volume refusé');
    const update = volumeCommand(changed.value, { id: row.id, values: row.values }, { orgId: ORG, timestamp: T, newId: randomUUID() });
    if (!update.ok) throw new Error(update.findings.map(f => f.code).join(','));
    expect(update.value.operation).toBe('update');
    const second = await send([update.value]);
    if (!second.ok) throw new Error(second.findings.map(f => `${f.code}:${String(f.params['cause'])}`).join(','));

    const again = await siteOf();
    expect(again.volumes.map(v => [v.id, v.height_m, v.material_key])).toEqual([[row.id, 3.5, 'glass']]);
  });

  it('la base refuse une matière hors de la liste, même portée par une commande bien formée', async () => {
    const forged = volumeCommand(
      { footprintId: FOOTPRINT, base_elevation_m: 0, height_m: 3, material_key: 'marbre' },
      null, { orgId: ORG, timestamp: T, newId: randomUUID() },
    );
    if (!forged.ok) throw new Error('commande refusée avant la base');
    const sent = await send([forged.value]);
    expect(sent.ok).toBe(false);
    const volumes = (await siteOf()).volumes;
    expect(volumes.map(v => v.material_key)).not.toContain('marbre');
  });
});
