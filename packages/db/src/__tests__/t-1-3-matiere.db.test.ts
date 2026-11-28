import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { VOLUME_MATERIALS } from '../reference/index.js';

/**
 * T-1.3 — la liste fermée des matières a deux lecteurs : la base (0088), et le
 * studio sur un poste sans base, qui lit `volume-material.json`. INV-1 ne
 * tolère pas deux listes qui divergent : une matière ajoutée à l'une sans
 * l'autre ferait proposer à l'écran ce que la base refuse, ou l'inverse.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];
let sql: postgres.Sql;

beforeAll(() => {
  if (URL === undefined || URL === '') {
    throw new Error('AZIMUT_TEST_DATABASE_URL absente. Voir packages/db/migrations/ORDRE.md.');
  }
  sql = postgres(URL, { onnotice: () => undefined });
});

afterAll(async () => { await sql.end(); });

describe('T-1.3 — la liste des matières en base concorde avec son fichier', () => {
  it('mêmes clés, mêmes libellés, même ordre', async () => {
    const rows = await sql.begin(async tx => {
      await tx`select set_config('azimut.current_user_id', '00000000-0000-4000-8000-000000000000', true)`;
      await tx`set local role authenticated`;
      return tx<{ key: string; name_fr: string; name_en: string; ordinal: number }[]>`
        select key, name_fr, name_en, ordinal from azimut.volume_material order by ordinal`;
    });
    expect(rows.map(r => ({ ...r }))).toEqual(VOLUME_MATERIALS.map(m => ({
      key: m.key, name_fr: m.name_fr, name_en: m.name_en, ordinal: m.ordinal,
    })));
  });

  it('l’application la lit et ne l’écrit pas', async () => {
    const granted = await sql<{ privilege_type: string }[]>`
      select privilege_type from information_schema.role_table_grants
      where table_schema = 'azimut' and table_name = 'volume_material' and grantee = 'authenticated'`;
    expect(granted.map(g => g.privilege_type)).toEqual(['SELECT']);
  });
});
