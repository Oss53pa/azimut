import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';

/**
 * A6.3 et O3 — la double authentification exigée en base (0080), vue du
 * catalogue.
 *
 * Le refus lui-même s'éprouve par le chemin de l'application : avec des jetons
 * signés dans `a10-4-etancheite-postgrest`, avec un second facteur réellement
 * vérifié par le service dans `auth-2-connexion-reelle`. Ici, ce qui garde la
 * règle dans le temps : une table nouvelle qui ne la porterait pas fait
 * échouer la suite.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];
const INSERT_ONLY = [
  'approval', 'audit_log', 'command_journal', 'graph_validation', 'message_schedule_approval',
] as const;

let sql: postgres.Sql;

beforeAll(() => {
  if (URL === undefined || URL === '') {
    throw new Error('AZIMUT_TEST_DATABASE_URL absente. Voir packages/db/migrations/ORDRE.md.');
  }
  sql = postgres(URL, { onnotice: () => undefined });
});

afterAll(async () => { await sql.end(); });

describe('0080 — toute table portant org_id exige le second facteur', () => {
  it('une politique restrictive par table, lue dans le catalogue', async () => {
    const missing = await sql<{ relname: string }[]>`
      select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attname = 'org_id' and not a.attisdropped
      where n.nspname = 'azimut' and c.relkind in ('r','p') and c.relname <> 'membership'
        and c.relname not in ${sql(INSERT_ONLY)}
        and not exists (select 1 from pg_policy p
                        where p.polrelid = c.oid and not p.polpermissive
                          and p.polname = c.relname || '_mfa_required')
      order by c.relname`;
    expect(missing.map(r => r.relname)).toEqual([]);
  });

  it('les tables en insertion seule l’exigent dans leurs deux politiques', async () => {
    const rows = await sql<{ tablename: string; cmd: string; expr: string }[]>`
      select tablename, cmd, coalesce(qual, '') || coalesce(with_check, '') as expr
      from pg_policies
      where schemaname = 'azimut' and tablename in ${sql(INSERT_ONLY)} and permissive = 'PERMISSIVE'
      order by 1, 2`;
    expect(rows.length).toBe(INSERT_ONLY.length * 2);
    for (const row of rows) expect(row.expr, `${row.tablename} ${row.cmd}`).toContain('org_ids_lacking_mfa');
  });

  it('une session serveur n’est pas tenue au second facteur, une session à jeton l’est', async () => {
    await sql.begin(async tx => {
      await tx`select set_config('azimut.current_user_id', '00000000-0000-4000-8000-0000000000e1', true)`;
      const [server] = await tx<{ ok: boolean }[]>`select azimut.session_meets_mfa() as ok`;
      expect(server?.ok).toBe(true);
      await tx`select set_config('azimut.current_user_id', '', true)`;
      for (const [claims, expected] of [['{"aal":"aal1"}', false], ['{"aal":"aal2"}', true], ['', false]] as const) {
        await tx`select set_config('request.jwt.claims', ${claims}, true)`;
        const [token] = await tx<{ ok: boolean }[]>`select azimut.session_meets_mfa() as ok`;
        expect(token?.ok, claims).toBe(expected);
      }
    });
  });
});
