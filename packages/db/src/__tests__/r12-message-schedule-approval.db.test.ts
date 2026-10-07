import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';

/**
 * R12 et H11 — `message_schedule_approval` sur une base réelle (0074).
 *
 * Ce qui s'éprouve : l'approbateur et la date sont pris en base ; un rejet
 * sans motif est refusé ; un approbateur autre que l'utilisateur de la session
 * est refusé sous le rôle applicatif ; une décision ne se modifie pas, et le
 * tableau qu'elle juge ne se supprime pas sous elle.
 *
 * Tout se passe dans des transactions annulées : une décision ne se supprime
 * pas, une ligne d'essai qui survivrait encombrerait la base pour toujours.
 * Le décor entre par le chemin de l'application (identité posée, membre
 * inscrit), jamais en levant le cloisonnement (A2.4).
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];
const ORG = 'a1200000-0000-0000-0000-0000000000a1';
const SITE = 'a1200000-0000-0000-0000-0000000000b1';
const SCHEDULE = 'a1200000-0000-0000-0000-0000000000c1';
const OWNER_REP = 'a1200000-0000-0000-0000-0000000000d1';
const SOMEONE_ELSE = 'a1200000-0000-0000-0000-0000000000d2';

let sql: postgres.Sql;

beforeAll(() => {
  if (URL === undefined || URL === '') {
    throw new Error('AZIMUT_TEST_DATABASE_URL absente. Voir packages/db/migrations/ORDRE.md.');
  }
  sql = postgres(URL, { onnotice: () => undefined });
});

afterAll(async () => { await sql.end(); });

/** Le décor, puis l'essai, puis l'annulation de tout. */
async function inRolledBack(check: (tx: postgres.TransactionSql) => Promise<void>): Promise<void> {
  const done = new Error('annulation voulue');
  await sql.begin(async tx => {
    await tx`select set_config('azimut.current_user_id', ${OWNER_REP}, true)`;
    await tx`insert into azimut.organization(id,name,slug) values (${ORG},'R12','r12-approbation')`;
    await tx`insert into azimut.membership(org_id,user_id,role) values (${ORG},${OWNER_REP},'owner_rep')`;
    await tx`insert into azimut.site(id,org_id,name,country_code,timezone)
             values (${SITE},${ORG},'Site de revue','FR','Europe/Paris')`;
    await tx`insert into azimut.message_schedule(id,org_id,site_id,version,state,generated_at,inputs_hash)
             values (${SCHEDULE},${ORG},${SITE},1,'in_review',now(),'sha256:entrees')`;
    await check(tx);
    throw done;
  }).catch((e: unknown) => { if (e !== done) throw e; });
}

/** Le motif du refus, tel que la base le donne, ou « accepté ». */
async function refusal(tx: postgres.TransactionSql, run: () => Promise<unknown>): Promise<string> {
  try {
    await tx.savepoint(async () => { await run(); });
  } catch (e: unknown) {
    return e instanceof Error ? e.message : String(e);
  }
  return 'accepté';
}

/** Le refus levé, ou le nombre de lignes que la tentative a atteintes. */
async function reached(
  tx: postgres.TransactionSql, run: () => Promise<{ readonly count: number }>,
): Promise<string> {
  try {
    let count = 0;
    await tx.savepoint(async () => { count = (await run()).count; });
    return `${String(count)} ligne(s) atteinte(s)`;
  } catch (e: unknown) {
    return e instanceof Error ? e.message : String(e);
  }
}

describe('R12 — une décision sur un tableau, en base', () => {
  it('l’approbation prend l’approbateur et la date en base', async () => {
    await inRolledBack(async tx => {
      await tx`insert into azimut.message_schedule_approval(org_id,schedule_id,decision,inputs_hash)
               values (${ORG},${SCHEDULE},'approved','sha256:entrees')`;
      const rows = await tx<{ user_id: string; decided: boolean; comment: string | null }[]>`
        select user_id, decided_at is not null as decided, comment
        from azimut.message_schedule_approval where schedule_id = ${SCHEDULE}`;
      expect(rows).toEqual([{ user_id: OWNER_REP, decided: true, comment: null }]);
    });
  });

  it('un rejet sans motif, ou avec un motif blanc, est refusé ; avec un motif, il passe', async () => {
    await inRolledBack(async tx => {
      const reject = (comment: string | null) => () => tx`
        insert into azimut.message_schedule_approval(org_id,schedule_id,decision,comment,inputs_hash)
        values (${ORG},${SCHEDULE},'rejected',${comment},'sha256:entrees')`;
      expect(await refusal(tx, reject(null))).toMatch(/message_schedule_approval_rejection_reason/);
      expect(await refusal(tx, reject('   '))).toMatch(/message_schedule_approval_rejection_reason/);
      expect(await refusal(tx, reject('Le pictogramme de la ligne 4 est faux.'))).toBe('accepté');
    });
  });

  it('une décision hors des deux valeurs de H11, ou sans empreinte, est refusée', async () => {
    await inRolledBack(async tx => {
      expect(await refusal(tx, () => tx`
        insert into azimut.message_schedule_approval(org_id,schedule_id,decision,inputs_hash)
        values (${ORG},${SCHEDULE},'pending','sha256:entrees')`)).toMatch(/check constraint/);
      expect(await refusal(tx, () => tx`
        insert into azimut.message_schedule_approval(org_id,schedule_id,decision,inputs_hash)
        values (${ORG},${SCHEDULE},'approved',' ')`)).toMatch(/check constraint/);
    });
  });

  it('sous le rôle applicatif, un approbateur autre que l’utilisateur de la session est refusé', async () => {
    await inRolledBack(async tx => {
      await tx`set local role authenticated`;
      expect(await refusal(tx, () => tx`
        insert into azimut.message_schedule_approval(org_id,schedule_id,user_id,decision,inputs_hash)
        values (${ORG},${SCHEDULE},${SOMEONE_ELSE},'approved','sha256:entrees')`))
        .toMatch(/row-level security/);
      expect(await refusal(tx, () => tx`
        insert into azimut.message_schedule_approval(org_id,schedule_id,decision,inputs_hash)
        values (${ORG},${SCHEDULE},'approved','sha256:entrees')`)).toBe('accepté');
    });
  });

  it('une décision ne se modifie pas, et le tableau jugé ne se supprime pas sous elle', async () => {
    await inRolledBack(async tx => {
      await tx`insert into azimut.message_schedule_approval(org_id,schedule_id,decision,inputs_hash)
               values (${ORG},${SCHEDULE},'approved','sha256:entrees')`;
      // Deux barrages, selon le rôle, comme pour `audit_log` (A12.3) : sous le
      // propriétaire soumis aux politiques, aucune ne lui ouvre la
      // modification et la tentative n'atteint aucune ligne ; sous un rôle qui
      // passe outre les politiques, le déclencheur la refuse. Dans les deux
      // cas la décision reste intacte, et c'est ce qui est vérifié en dernier.
      expect(await reached(tx, () => tx`
        update azimut.message_schedule_approval set decision = 'rejected', comment = 'après coup'
        where schedule_id = ${SCHEDULE}`)).toMatch(/insert-only|^0 ligne\(s\) atteinte\(s\)$/);
      const kept = await tx<{ decision: string; comment: string | null }[]>`
        select decision, comment from azimut.message_schedule_approval where schedule_id = ${SCHEDULE}`;
      expect(kept).toEqual([{ decision: 'approved', comment: null }]);
      expect(await refusal(tx, () => tx`
        delete from azimut.message_schedule where id = ${SCHEDULE}`))
        .toMatch(/foreign key|insert-only/);
    });
  });
});
