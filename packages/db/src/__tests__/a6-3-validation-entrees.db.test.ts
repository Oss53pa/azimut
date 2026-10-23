import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { provisionStatements } from '../provision-organization.js';

/**
 * Lot 4 de l'audit (A6.3, 0082) : la base refuse elle-même une entrée mal
 * formée, quel que soit le chemin d'écriture. Les essais écrivent sous le rôle
 * `authenticated`, comme l'API directe le ferait, sans passer par le modèle.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];

const ORG = 'a6300000-0000-0000-0000-0000000000a1';
const ADMIN = 'a6300000-0000-0000-0000-00000000a001';
const SITE = 'a6300000-0000-0000-0000-00000000c001';
const BUILDING = 'a6300000-0000-0000-0000-00000000c002';
const LEVEL = 'a6300000-0000-0000-0000-00000000c003';
const NODE = 'a6300000-0000-0000-0000-00000000c004';

const RLO = String.fromCodePoint(0x202e);
const BEL = String.fromCodePoint(7);
const C1 = String.fromCodePoint(0x9b);
const NFD = 'Café';

let sql: postgres.Sql;

beforeAll(() => {
  if (URL === undefined || URL === '') {
    throw new Error('AZIMUT_TEST_DATABASE_URL absente. Voir packages/db/migrations/ORDRE.md.');
  }
  sql = postgres(URL, { onnotice: () => undefined });
});

afterAll(async () => { await sql.end(); });

type Tx = postgres.TransactionSql;

/** Le motif du refus : code et détail, ou `accepté`. */
async function outcome(tx: Tx, attempt: () => Promise<unknown>): Promise<string> {
  try {
    await tx.savepoint(async () => { await attempt(); });
    return 'accepté';
  } catch (e: unknown) {
    if (e instanceof postgres.PostgresError) return [e.message, e.detail].filter(Boolean).join(' ');
    return e instanceof Error ? e.message : String(e);
  }
}

/** Une organisation, un site, un bâtiment, un niveau et un nœud, sous l'admin. */
async function inRolledBack(check: (tx: Tx) => Promise<void>, before?: (tx: Tx) => Promise<void>): Promise<void> {
  const done = new Error('annulation voulue');
  await sql.begin(async tx => {
    for (const text of provisionStatements({ id: ORG, name: 'A63', slug: 'a63', adminId: ADMIN })) {
      await tx.unsafe(text);
    }
    if (before !== undefined) await before(tx);
    await tx`set local role authenticated`;
    await tx`select set_config('azimut.current_user_id', ${ADMIN}, true)`;
    await tx`insert into azimut.site(id, org_id, name, country_code, timezone)
             values (${SITE}, ${ORG}, 'Centre Plateau', 'CI', 'Africa/Abidjan')`;
    await tx`insert into azimut.building(id, org_id, site_id, name) values (${BUILDING}, ${ORG}, ${SITE}, 'Tour A')`;
    await tx`insert into azimut.level(id, org_id, building_id, name, ordinal, elevation_m)
             values (${LEVEL}, ${ORG}, ${BUILDING}, 'RDC', 0, 0)`;
    await tx`insert into azimut.node(id, org_id, level_id, kind, position, label)
             values (${NODE}, ${ORG}, ${LEVEL}, 'junction', '{"x_m":0,"y_m":0}', 'Hall')`;
    await check(tx);
    throw done;
  }).catch((e: unknown) => { if (e !== done) throw e; });
}

const rename = (tx: Tx, label: string) => () => tx`update azimut.node set label = ${label} where id = ${NODE}`;

describe('lot 4 : la garde de chaque table', () => {
  it.each([
    ['un forçage de direction', `Sortie${RLO}tros`, 'node.label bidi'],
    ['une sonnerie', `Hall${BEL}`, 'node.label control'],
    ['un caractère C1', `Hall${C1}`, 'node.label control'],
    ['une forme non NFC', NFD, 'node.label not_nfc'],
  ])('refuse %s dans un texte', async (_label, value, detail) => {
    await inRolledBack(async tx => {
      expect(await outcome(tx, rename(tx, value))).toBe(`EDIT.COMMAND_SHAPE_INVALID ${detail}`);
    });
  });

  it('refuse un texte au-delà du plafond configuré', async () => {
    await inRolledBack(async tx => {
      expect(await outcome(tx, rename(tx, 'x'.repeat(65537)))).toBe('EDIT.COMMAND_SHAPE_INVALID node.label too_long');
      expect(await outcome(tx, rename(tx, 'x'.repeat(65536)))).toBe('accepté');
    });
  });

  it('refuse une chaîne piégée dans une structure, valeur ou clé', async () => {
    await inRolledBack(async tx => {
      // `::text::jsonb` : sans le premier transtypage, le client enverrait la
      // chaîne comme un scalaire JSON, et non comme la structure qu'elle décrit.
      const move = (position: string) => () =>
        tx`update azimut.node set position = ${position}::text::jsonb where id = ${NODE}`;
      expect(await outcome(tx, move(JSON.stringify({ x_m: 1, y_m: 2, note: [`a${RLO}b`] }))))
        .toBe('EDIT.COMMAND_SHAPE_INVALID node.position bidi');
      expect(await outcome(tx, move(JSON.stringify({ x_m: 1, y_m: 2, [`k${BEL}`]: 1 }))))
        .toBe('EDIT.COMMAND_SHAPE_INVALID node.position control');
    });
  });

  it('refuse une structure au-delà du plafond configuré', async () => {
    await inRolledBack(async tx => {
      const big = JSON.stringify({ x_m: 1, y_m: 2, pad: 'x'.repeat(2048) });
      expect(await outcome(tx, () => tx`update azimut.node set position = ${big}::text::jsonb where id = ${NODE}`))
        .toBe('EDIT.COMMAND_SHAPE_INVALID node.position too_large');
    }, async tx => { await tx`update azimut.security_setting set value = 1024 where key = 'input.json.max_bytes'`; });
  });

  it('refuse de même par apply_commands, l’autre chemin d’écriture', async () => {
    await inRolledBack(async tx => {
      const commands = JSON.stringify([{
        operation: 'update', table: 'node', id: NODE, after: { org_id: ORG, label: `Hall${RLO}` },
      }]);
      expect(await outcome(tx, () => tx`select azimut.apply_commands(${commands}::text::jsonb)`))
        .toBe('EDIT.COMMAND_SHAPE_INVALID node.label bidi');
    });
  });

  it('ne rejuge pas une valeur que la mise à jour ne change pas', async () => {
    await inRolledBack(async tx => {
      await tx`reset role`;
      await tx`alter table azimut.node disable trigger guard_input`;
      await tx`update azimut.node set label = ${`Ancien${BEL}`} where id = ${NODE}`;
      await tx`alter table azimut.node enable trigger guard_input`;
      await tx`set local role authenticated`;
      expect(await outcome(tx, () => tx`update azimut.node set kind = 'landing' where id = ${NODE}`)).toBe('accepté');
      expect(await outcome(tx, rename(tx, `Nouveau${BEL}`))).toBe('EDIT.COMMAND_SHAPE_INVALID node.label control');
    });
  });
});

describe('lot 4 : les longueurs que le cahier fixe', () => {
  const siteName = (tx: Tx, name: string) => () => tx`update azimut.site set name = ${name} where id = ${SITE}`;

  it.each([
    ['trop court', 'A'],
    ['trop long', 'x'.repeat(121)],
    ['avec une espace de bord', ' Centre'],
    ['sur deux lignes', 'Centre\nPlateau'],
  ])('refuse un nom de site %s', async (_label, name) => {
    await inRolledBack(async tx => {
      expect(await outcome(tx, siteName(tx, name))).toMatch(/site_name_input/);
    });
  });

  it('accepte les bornes exactes, et borne aussi le nom d’un bâtiment', async () => {
    await inRolledBack(async tx => {
      expect(await outcome(tx, siteName(tx, 'AB'))).toBe('accepté');
      expect(await outcome(tx, siteName(tx, 'x'.repeat(120)))).toBe('accepté');
      expect(await outcome(tx, () => tx`update azimut.building set name = ${'x'.repeat(81)} where id = ${BUILDING}`))
        .toMatch(/building_name_input/);
    });
  });
});
