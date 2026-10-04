import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCommand } from '@azimut/core-model';
import { applyCommands, createConnection, createDb, deleteOrgFixture } from '@azimut/db';
import { createService, kioskPackagePath, readServiceConfig } from '../service.js';
import type { Service } from '../service.js';
import { processNextJob } from '../worker.js';

/**
 * T-0.11 — le service assemblé comme en production, contre la base réelle.
 *
 * Un utilisateur dépose un travail `build_kiosk_package` ; le service le prend
 * par la file en base, lit le site sous l'identité du demandeur, écrit le
 * paquet dans son répertoire, et enregistre la ligne `kiosk_package` sous la
 * même identité. Rien n'est lu ni écrit hors cloisonnement.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];

const USER = 'a0120000-0000-0000-0000-0000000000a1';
const ORG = 'a0120000-0000-0000-0000-00000000a0a0';
const SITE = 'a0120000-0000-0000-0000-0000000005a1';
const BUILDING = 'a0120000-0000-0000-0000-0000000006a1';
const LEVEL = 'a0120000-0000-0000-0000-0000000007a1';

let client: ReturnType<typeof createConnection>;
let db: ReturnType<typeof createDb>;
let dir: string;
let service: Service | undefined;

type Row = Readonly<Record<string, unknown>>;

/** Une transaction sous l'identité de l'utilisateur. */
async function asUser(text: string, params: readonly string[] = []): Promise<readonly Row[]> {
  const rows: Row[] = [];
  await client.begin(async (tx) => {
    await tx.unsafe('set local role authenticated');
    await tx.unsafe(`select set_config('azimut.current_user_id', $1, true)`, [USER]);
    rows.push(...await tx.unsafe(text, [...params]));
  });
  return rows;
}

async function enqueue(kind: string, payload: Record<string, unknown>): Promise<string> {
  const [row] = await asUser(`
    insert into azimut.job(org_id, kind, payload) values ($1, $2, $3::text::jsonb)
    returning id`, [ORG, kind, JSON.stringify(payload)]);
  return String(row?.['id']);
}

async function job(id: string): Promise<Row | undefined> {
  const [row] = await asUser('select state, attempts, error, result from azimut.job where id = $1', [id]);
  return row;
}

beforeAll(async () => {
  if (URL === undefined || URL === '') {
    throw new Error('AZIMUT_TEST_DATABASE_URL absente. Voir packages/db/migrations/ORDRE.md.');
  }
  client = createConnection(URL);
  db = createDb(URL);
  await deleteOrgFixture(text => client.unsafe(text), text => client.unsafe(text), [ORG]);

  await asUser('insert into azimut.organization(id,name,slug) values ($1, $2, $2)', [ORG, 't011-service']);
  await asUser(`insert into azimut.membership(org_id,user_id,role) values ($1, $2, 'admin')`, [ORG, USER]);
  const creations = [
    { table: 'site', id: SITE, after: {
      id: SITE, org_id: ORG, name: 'Site du service', country_code: 'FR', timezone: 'Europe/Paris' } },
    { table: 'building', id: BUILDING, after: {
      id: BUILDING, org_id: ORG, site_id: SITE, name: 'Bâtiment 1' } },
    { table: 'level', id: LEVEL, after: {
      id: LEVEL, org_id: ORG, building_id: BUILDING, name: 'Niveau 0', ordinal: 0, elevation_m: 0 } },
  ].map(({ table, id, after }) => {
    const out = buildCommand({
      operation: 'create', module: '01-socle', table, id, org_id: ORG, after,
      timestamp: '2026-10-04T00:00:00.000Z',
    });
    if (!out.ok) throw new Error(JSON.stringify(out.findings));
    return out.value;
  });
  const applied = await applyCommands(db, { userId: USER }, creations);
  if (!applied.ok) throw new Error(JSON.stringify(applied.findings));

  dir = await mkdtemp(join(tmpdir(), 'azimut-service-'));
  await mkdir(join(dir, 'bundle', 'assets'), { recursive: true });
  await writeFile(join(dir, 'bundle', 'index.html'), '<!doctype html><title>Borne</title>');
  await writeFile(join(dir, 'bundle', 'assets', 'app.js'), 'export const boot = () => {};');
  await writeFile(join(dir, 'bundle', 'assets', 'app.css'), 'body{margin:0}');

  const read = readServiceConfig({
    AZIMUT_COMPILER_DATABASE_URL: URL,
    AZIMUT_KIOSK_BUNDLE_DIR: join(dir, 'bundle'),
    AZIMUT_PACKAGE_DIR: join(dir, 'packages'),
    AZIMUT_KIOSK_MIN_RUNTIME: '1.0.0',
  });
  if (!read.ok) throw new Error(read.problems.join(', '));
  service = createService(read.config, () => new Date('2026-10-04T09:00:00.000Z'));
});

afterAll(async () => {
  await service?.close();
  await deleteOrgFixture(text => client.unsafe(text), text => client.unsafe(text), [ORG]);
  await client.end();
  await db.$client.end();
  await rm(dir, { recursive: true, force: true });
});

function loop(): Service['loop'] {
  if (service === undefined) throw new Error('service non assemblé');
  return service.loop;
}

describe('T-0.11 — le service assemblé sur la base', () => {
  it('fabrique un paquet de borne sous l’identité du demandeur', async () => {
    const id = await enqueue('build_kiosk_package', {
      site_id: SITE, version: 1, built_at: '2026-10-04T09:00:00.000Z',
    });

    expect(await processNextJob(loop())).toBe(true);

    const done = await job(id);
    expect(done?.['error']).toBeNull();
    expect(done).toMatchObject({ state: 'succeeded', attempts: 1, error: null });
    const result = done?.['result'];
    expect(result).toMatchObject({ site_id: SITE, version: 1, storage_path: kioskPackagePath(SITE, 1) });

    const [row] = await asUser(
      'select storage_path, content_hash from azimut.kiosk_package where site_id = $1', [SITE]);
    expect(row?.['storage_path']).toBe(kioskPackagePath(SITE, 1));
    expect(row?.['content_hash']).toBe((result as Row)['content_hash']);

    const index = await readFile(join(dir, 'packages', kioskPackagePath(SITE, 1), 'index.html'), 'utf8');
    expect(index).toContain('Borne');
  });

  it('un travail sans gestionnaire est remis en file avec la raison, sans arrêter le service', async () => {
    const id = await enqueue('audit_site', { mode: 'complet' });

    expect(await processNextJob(loop())).toBe(true);

    expect(await job(id)).toMatchObject({ state: 'queued', attempts: 1 });
    expect(String((await job(id))?.['error'])).toMatch(/No handler registered for job kind: audit_site/);
  });
});
