import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { buildCommand, serializeCommand } from '@azimut/core-model';
import { enrolFixtureMembers } from '../fixture-membership.js';

/**
 * S6.4, migration 0083 — le verrou ferme (S-20 ; décisions Q1, Q2, Q5).
 *
 * Ce qui s'éprouve : un objet verrouillé par un membre ne se modifie ni ne se
 * supprime par un autre, quel que soit le chemin — la table directement,
 * `apply_commands`, `apply_journaled_commands` — et le refus porte l'état
 * `PT423` ; le détenteur écrit librement ; le verrou d'un autre ne se prend
 * pas, il se reprend une fois expiré ou levé ; une autre organisation ne voit
 * ni ne pose rien ; l'auditor ne verrouille pas.
 *
 * Tout se fait dans une transaction annulée.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];
const ORG = 'a6400000-0000-4000-8000-0000000000a1';
const OTHER_ORG = 'a6400000-0000-4000-8000-0000000000a2';
const SITE = 'a6400000-0000-4000-8000-0000000000b1';
const BUILDING = 'a6400000-0000-4000-8000-0000000000b2';
const LEVEL = 'a6400000-0000-4000-8000-0000000000b3';
const NODE = 'a6400000-0000-4000-8000-0000000000e1';
const HOLDER = 'a6400000-0000-4000-8000-0000000000d1';
const OTHER = 'a6400000-0000-4000-8000-0000000000d2';
const AUDITOR = 'a6400000-0000-4000-8000-0000000000d3';
const STRANGER = 'a6400000-0000-4000-8000-0000000000d4';
const T = '2026-11-24T10:00:00.000Z';

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
    await tx`select set_config('azimut.current_user_id', ${HOLDER}, true)`;
    await tx`insert into azimut.organization(id,name,slug)
             values (${ORG},'S6.4','s6-verrou'),(${OTHER_ORG},'S6.4 bis','s6-verrou-bis')`;
    await enrolFixtureMembers(text => tx.unsafe(text), [
      { orgId: ORG, userId: HOLDER, role: 'designer' },
      { orgId: ORG, userId: OTHER, role: 'designer' },
      { orgId: ORG, userId: AUDITOR, role: 'auditor' },
      { orgId: OTHER_ORG, userId: STRANGER, role: 'admin' },
    ]);
    await tx`insert into azimut.site(id,org_id,name,country_code,timezone) values (${SITE},${ORG},'Site','FR','Europe/Paris')`;
    await tx`insert into azimut.building(id,org_id,site_id,name) values (${BUILDING},${ORG},${SITE},'B')`;
    await tx`insert into azimut.level(id,org_id,building_id,name,ordinal,elevation_m) values (${LEVEL},${ORG},${BUILDING},'RDC',0,0)`;
    await tx`insert into azimut.node(id,org_id,level_id,kind,label,position)
             values (${NODE},${ORG},${LEVEL},'junction','Hall','{"x_m":0,"y_m":0}')`;
    await tx`set local role authenticated`;
    await check(tx);
    throw done;
  }).catch((e: unknown) => { if (e !== done) throw e; });
}

async function as(tx: postgres.TransactionSql, userId: string): Promise<void> {
  await tx`select set_config('azimut.current_user_id', ${userId}, true)`;
}

async function verdict(tx: postgres.TransactionSql, run: () => Promise<unknown>): Promise<string> {
  try {
    await tx.savepoint(async () => { await run(); });
  } catch (e: unknown) {
    const code = (e as { code?: unknown }).code;
    return typeof code === 'string' ? code : '?';
  }
  return 'accepté';
}

const lock = (tx: postgres.TransactionSql, table = 'node', id = NODE) =>
  tx`select azimut.acquire_object_lock(${table}, ${id})`;

function relabel(label: string): unknown[] {
  const built = buildCommand({
    operation: 'update', module: '01-socle', table: 'node', id: NODE, org_id: ORG,
    before: { label: 'Hall' }, after: { label }, timestamp: T,
  });
  if (!built.ok) throw new Error('commande');
  const text = serializeCommand(built.value);
  if (!text.ok) throw new Error('écriture');
  return [JSON.parse(text.value) as unknown];
}

describe('S6.4 — le verrou ferme', () => {
  it('un objet verrouillé se refuse aux autres, par les trois chemins d’écriture', async () => {
    await inRolledBack(async tx => {
      await as(tx, HOLDER);
      await lock(tx);
      await as(tx, OTHER);
      expect(await verdict(tx, () => tx`update azimut.node set label = 'Accueil' where id = ${NODE}`)).toBe('PT423');
      expect(await verdict(tx, () => tx`delete from azimut.node where id = ${NODE}`)).toBe('PT423');
      expect(await verdict(tx, () => tx`
        select azimut.apply_commands(${JSON.stringify(relabel('Accueil'))}::text::jsonb)`)).toBe('PT423');
      expect(await verdict(tx, () => tx`
        select azimut.apply_journaled_commands(${SITE}, ${LEVEL}, ${JSON.stringify(relabel('Accueil'))}::text::jsonb)`))
        .toBe('PT423');
    });
  });

  it('le détenteur écrit librement', async () => {
    await inRolledBack(async tx => {
      await as(tx, HOLDER);
      await lock(tx);
      expect(await verdict(tx, () => tx`
        select azimut.apply_journaled_commands(${SITE}, ${LEVEL}, ${JSON.stringify(relabel('Accueil'))}::text::jsonb)`))
        .toBe('accepté');
    });
  });

  it('le verrou d’un autre ne se prend pas ; levé, il se prend', async () => {
    await inRolledBack(async tx => {
      await as(tx, HOLDER);
      await lock(tx);
      await lock(tx); // renouveler le sien est permis
      await as(tx, OTHER);
      expect(await verdict(tx, () => lock(tx))).toBe('PT423');
      // Lever le verrou d'un autre n'a aucun effet.
      await tx`select azimut.release_object_lock('node', ${NODE})`;
      expect(await verdict(tx, () => lock(tx))).toBe('PT423');
      await as(tx, HOLDER);
      await tx`select azimut.release_object_lock('node', ${NODE})`;
      await as(tx, OTHER);
      expect(await verdict(tx, () => lock(tx))).toBe('accepté');
      expect(await verdict(tx, () => tx`update azimut.node set label = 'Accueil' where id = ${NODE}`)).toBe('accepté');
    });
  });

  it('un verrou expiré tombe de lui-même, sans passage en force', async () => {
    await inRolledBack(async tx => {
      await as(tx, HOLDER);
      await lock(tx);
      await tx`update azimut.object_lock
               set acquired_at = now() - interval '2 minutes', expires_at = now() - interval '1 minute'
               where target_id = ${NODE}`;
      await as(tx, OTHER);
      expect(await verdict(tx, () => tx`update azimut.node set label = 'Accueil' where id = ${NODE}`)).toBe('accepté');
      expect(await verdict(tx, () => lock(tx))).toBe('accepté');
    });
  });

  it('les verrous vivants se lisent avec le nom de leur détenteur', async () => {
    await inRolledBack(async tx => {
      await as(tx, HOLDER);
      await lock(tx);
      await as(tx, OTHER);
      const rows = await tx<{ target_table: string; target_id: string; holder_id: string; role: string }[]>`
        select target_table, target_id, holder_id, role from azimut.live_object_locks(${ORG})`;
      expect(rows).toEqual([{ target_table: 'node', target_id: NODE, holder_id: HOLDER, role: 'designer' }]);
    });
  });

  it('une autre organisation ne voit ni ne pose rien ; l’auditor ne verrouille pas', async () => {
    await inRolledBack(async tx => {
      await as(tx, HOLDER);
      await lock(tx);
      await as(tx, STRANGER);
      expect(await tx`select * from azimut.object_lock`).toEqual([]);
      expect(await tx`select * from azimut.live_object_locks(${ORG})`).toEqual([]);
      expect(await verdict(tx, () => lock(tx))).toBe('42501');
      await as(tx, HOLDER);
      await tx`select azimut.release_object_lock('node', ${NODE})`;
      await as(tx, AUDITOR);
      expect(await verdict(tx, () => lock(tx))).toBe('42501');
    });
  });

  it('une table hors de la liste gardée ne se verrouille pas', async () => {
    await inRolledBack(async tx => {
      await as(tx, HOLDER);
      expect(await verdict(tx, () => lock(tx, 'membership', HOLDER))).toBe('42501');
      expect(await verdict(tx, () => lock(tx, 'node; drop table azimut.node', NODE))).toBe('42501');
    });
  });
});

describe('0083 — toute table que le poste peut modifier porte le déclencheur du verrou', () => {
  it('lu dans le catalogue', async () => {
    const missing = await sql<{ relname: string }[]>`
      select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'azimut' and c.relkind in ('r','p') and not c.relispartition
        and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'org_id' and not a.attisdropped)
        and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'id' and not a.attisdropped)
        and (has_table_privilege('authenticated', c.oid, 'UPDATE')
             or has_table_privilege('authenticated', c.oid, 'DELETE'))
        and c.relname not in ('object_lock','level_presence')
        and not exists (select 1 from pg_trigger t where t.tgrelid = c.oid and t.tgname = 'guard_object_lock')
      order by c.relname`;
    expect(missing.map(r => r.relname)).toEqual([]);
  });
});
