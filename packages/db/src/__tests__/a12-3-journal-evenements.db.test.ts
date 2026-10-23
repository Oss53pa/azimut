import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { provisionStatements } from '../provision-organization.js';

/**
 * Lot 9 de l'audit (A12.3, 0083) : chaque événement minimal laisse une ligne
 * au journal, écrite par la base sous l'identité de la requête, et le journal
 * ne s'écrit par aucun autre chemin.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];

const ORG = 'a1239000-0000-0000-0000-0000000000a1';
const ADMIN = 'a1239000-0000-0000-0000-00000000a001';
const OWNER_REP = 'a1239000-0000-0000-0000-00000000a002';
const MEMBER = 'a1239000-0000-0000-0000-00000000a003';
const SITE = 'a1239000-0000-0000-0000-00000000c001';
const BUILDING = 'a1239000-0000-0000-0000-00000000c002';
const LEVEL = 'a1239000-0000-0000-0000-00000000c003';
const NODE = 'a1239000-0000-0000-0000-00000000c004';
const SUPPORT = 'a1239000-0000-0000-0000-00000000c005';
const FACE = 'a1239000-0000-0000-0000-00000000c006';
const PROOF = 'a1239000-0000-0000-0000-00000000c007';
const PACK = 'a1239000-0000-0000-0000-00000000c008';

/** Les seules clés qu'une entrée du journal peut porter dans `before` et `after`. */
const LOGGED_KEYS = new Set([
  'approval_id', 'decision', 'reviewer_id', 'rules_pack_id', 'role', 'site_id', 'version',
  'content_hash', 'deleted_at', 'user_id',
]);

let sql: postgres.Sql;

beforeAll(() => {
  if (URL === undefined || URL === '') {
    throw new Error('AZIMUT_TEST_DATABASE_URL absente. Voir packages/db/migrations/ORDRE.md.');
  }
  sql = postgres(URL, { onnotice: () => undefined });
});

afterAll(async () => { await sql.end(); });

type Tx = postgres.TransactionSql;
type Entry = { action: string; entity: string; entity_id: string | null; actor_id: string | null;
  before: Record<string, unknown> | null; after: Record<string, unknown> | null };

async function as(tx: Tx, userId: string): Promise<void> {
  await tx`select set_config('azimut.current_user_id', ${userId}, true)`;
}

async function outcome(tx: Tx, attempt: () => Promise<unknown>): Promise<string> {
  try {
    await tx.savepoint(async () => { await attempt(); });
    return 'accepté';
  } catch (e: unknown) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** Les entrées du journal de l'organisation, lues hors cloisonnement par le propriétaire. */
async function journal(tx: Tx): Promise<readonly Entry[]> {
  await tx`reset role`;
  const rows = await tx<Entry[]>`select action, entity, entity_id, actor_id, before, after
    from azimut.audit_log where org_id = ${ORG} order by occurred_at, action`;
  await tx`set local role authenticated`;
  return rows;
}

async function inRolledBack(check: (tx: Tx) => Promise<void>): Promise<void> {
  const done = new Error('annulation voulue');
  await sql.begin(async tx => {
    for (const text of provisionStatements({ id: ORG, name: 'J123', slug: 'j123', adminId: ADMIN })) {
      await tx.unsafe(text);
    }
    await tx`insert into azimut.rules_pack(id, key, version, jurisdiction, effective_from, checksum, source_ref)
             values (${PACK}, 'essai-j123', '1', 'CI', '2026-01-01', 'sha256:0', 'essai')`;
    await tx`set local role authenticated`;
    await as(tx, ADMIN);
    await tx`select azimut.set_member(${ORG}, ${OWNER_REP}, 'owner_rep')`;
    await tx`select azimut.set_member(${ORG}, ${MEMBER}, 'designer')`;
    await tx`insert into azimut.site(id, org_id, name, country_code, timezone)
             values (${SITE}, ${ORG}, 'Centre Plateau', 'CI', 'Africa/Abidjan')`;
    await tx`insert into azimut.building(id, org_id, site_id, name) values (${BUILDING}, ${ORG}, ${SITE}, 'Tour A')`;
    await tx`insert into azimut.level(id, org_id, building_id, name, ordinal, elevation_m)
             values (${LEVEL}, ${ORG}, ${BUILDING}, 'RDC', 0, 0)`;
    await tx`insert into azimut.node(id, org_id, level_id, kind, position)
             values (${NODE}, ${ORG}, ${LEVEL}, 'junction', ${tx.json({ x_m: 1, y_m: 1 })})`;
    await tx`insert into azimut.support(id, org_id, site_id, node_id, kind)
             values (${SUPPORT}, ${ORG}, ${SITE}, ${NODE}, 'totem')`;
    await tx`insert into azimut.support_face(id, org_id, support_id) values (${FACE}, ${ORG}, ${SUPPORT})`;
    await tx`insert into azimut.proof(id, org_id, face_id, version, storage_path)
             values (${PROOF}, ${ORG}, ${FACE}, 1, 'epreuves/a.pdf')`;
    await check(tx);
    throw done;
  }).catch((e: unknown) => { if (e !== done) throw e; });
}

describe('lot 9 : le journal ne s’écrit que par la base', () => {
  it('l’application n’insère pas une entrée, et n’appelle pas la fonction d’écriture', async () => {
    await inRolledBack(async tx => {
      expect(await outcome(tx, () => tx`insert into azimut.audit_log(org_id, actor_id, action, entity)
        values (${ORG}, ${MEMBER}, 'proof.approved', 'proof')`)).toMatch(/permission denied/);
      expect(await outcome(tx, () => tx`select azimut.write_audit(${ORG}, 'proof.approved', 'proof',
        ${PROOF}, null, null)`)).toMatch(/permission denied/);
    });
  });

  it('le rôle d’écriture du journal ne le modifie ni ne le supprime', async () => {
    await inRolledBack(async tx => {
      await tx`select azimut.set_member(${ORG}, ${MEMBER}, 'operator')`;
      await tx`reset role`;
      await tx`set local role azimut_audit`;
      expect(await outcome(tx, () => tx`update azimut.audit_log set action = 'x' where org_id = ${ORG}`))
        .toMatch(/permission denied|A12\.3|insertion seule/);
      expect(await outcome(tx, () => tx`delete from azimut.audit_log where org_id = ${ORG}`))
        .toMatch(/permission denied|A12\.3|insertion seule/);
    });
  });
});

describe('lot 9 : chaque événement minimal d’A12.3 laisse une ligne', () => {
  it('validation d’un bon à tirer, sous l’identité de qui valide', async () => {
    await inRolledBack(async tx => {
      await as(tx, OWNER_REP);
      await tx`insert into azimut.approval(org_id, proof_id, decision, reviewer_id, comment)
               values (${ORG}, ${PROOF}, 'approved', ${OWNER_REP}, 'Conforme, voir avec M. X')`;
      const entry = (await journal(tx)).find(e => e.action === 'proof.approved');
      expect(entry).toMatchObject({ entity: 'proof', entity_id: PROOF, actor_id: OWNER_REP });
      expect(JSON.stringify(entry)).not.toContain('Conforme');
    });
  });

  it('changement de paquet de règles rattaché à un site', async () => {
    await inRolledBack(async tx => {
      await tx`insert into azimut.site_rules_binding(org_id, site_id, rules_pack_id, role)
               values (${ORG}, ${SITE}, ${PACK}, 'base')`;
      await tx`delete from azimut.site_rules_binding where site_id = ${SITE}`;
      const entries = (await journal(tx)).filter(e => e.action === 'site.rules_binding_changed');
      expect(entries.map(e => [e.entity_id, e.before?.['rules_pack_id'] ?? null, e.after?.['rules_pack_id'] ?? null]))
        .toEqual([[SITE, null, PACK], [SITE, PACK, null]]);
    });
  });

  it('publication d’un paquet de borne', async () => {
    await inRolledBack(async tx => {
      await tx`reset role`;
      await tx`insert into azimut.kiosk_package(org_id, site_id, version, storage_path, checksum, content_hash)
               values (${ORG}, ${SITE}, 1, 'paquets/1.zip', 'sha256:a', 'sha256:b')`;
      await tx`set local role authenticated`;
      expect((await journal(tx)).find(e => e.action === 'kiosk_package.published')?.after)
        .toEqual({ site_id: SITE, version: 1, content_hash: 'sha256:b' });
    });
  });

  it('suppression logique d’une entité, et sa levée', async () => {
    await inRolledBack(async tx => {
      await tx`update azimut.site set deleted_at = now() where id = ${SITE}`;
      await tx`update azimut.site set name = 'Centre Plateau Nord' where id = ${SITE}`;
      await tx`update azimut.site set deleted_at = null where id = ${SITE}`;
      const actions = (await journal(tx)).filter(e => e.entity === 'site').map(e => `${e.action} ${String(e.actor_id)}`);
      expect(actions).toEqual([`entity.soft_deleted ${ADMIN}`, `entity.restored ${ADMIN}`]);
    });
  });

  it('changement de rôle d’un membre, et rien quand le rôle ne change pas', async () => {
    await inRolledBack(async tx => {
      await tx`select azimut.set_member(${ORG}, ${MEMBER}, 'designer')`;
      await tx`select azimut.set_member(${ORG}, ${MEMBER}, 'operator')`;
      const entries = (await journal(tx)).filter(e => e.action === 'membership.role_changed');
      expect(entries.map(e => [e.before?.['role'], e.after?.['role'], e.actor_id]))
        .toEqual([['designer', 'operator', ADMIN]]);
    });
  });

  it('aucune entrée ne porte d’autre valeur que celles nommées', async () => {
    await inRolledBack(async tx => {
      await as(tx, OWNER_REP);
      await tx`insert into azimut.approval(org_id, proof_id, decision, reviewer_id, comment)
               values (${ORG}, ${PROOF}, 'rejected', ${OWNER_REP}, 'Motif détaillé')`;
      await as(tx, ADMIN);
      await tx`select azimut.set_member(${ORG}, ${MEMBER}, 'auditor')`;
      await tx`update azimut.site set deleted_at = now() where id = ${SITE}`;
      const keys = (await journal(tx)).flatMap(e => [...Object.keys(e.before ?? {}), ...Object.keys(e.after ?? {})]);
      expect(keys.length).toBeGreaterThan(0);
      expect(keys.filter(k => !LOGGED_KEYS.has(k))).toEqual([]);
    });
  });
});
