import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { FIXTURE_ROLE } from '../fixture-role.js';

/**
 * Migration 0084, lot Q16 — la base valide la forme des colonnes `jsonb`
 * (décisions Q17 à Q21, `docs/decoupage-validation-jsonb.md`).
 *
 * Les fonctions de forme sont pures : elles s'éprouvent par une simple
 * lecture. La garde de catalogue interdit qu'une colonne `jsonb` soit ajoutée
 * sans contrainte.
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

async function check(fn: string, value: unknown): Promise<boolean> {
  const [row] = await sql.unsafe<{ ok: boolean }[]>(
    `select azimut.${fn}($1::text::jsonb) as ok`, [JSON.stringify(value)]);
  return row?.ok ?? false;
}

const square = { vertices: [{ x_m: 0, y_m: 0 }, { x_m: 4, y_m: 0 }, { x_m: 4, y_m: 3 }, { x_m: 0, y_m: 3 }] };

describe('Q18, Q21 — une empreinte est un polygone simple', () => {
  it('un carré, un triangle passent', async () => {
    expect(await check('polygon_m_valid', square)).toBe(true);
    expect(await check('polygon_m_valid', { vertices: square.vertices.slice(0, 3) })).toBe(true);
  });

  it('un nœud papillon, deux sommets, un côté nul, une autre forme sont refusés', async () => {
    const bowtie = { vertices: [{ x_m: 0, y_m: 0 }, { x_m: 2, y_m: 2 }, { x_m: 2, y_m: 0 }, { x_m: 0, y_m: 2 }] };
    for (const bad of [
      bowtie,
      { vertices: square.vertices.slice(0, 2) },
      { vertices: [{ x_m: 0, y_m: 0 }, { x_m: 0, y_m: 0 }, { x_m: 1, y_m: 1 }] },
      { vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] },
      { vertices: square.vertices, extra: 1 },
      square.vertices,
    ]) expect(await check('polygon_m_valid', bad)).toBe(false);
  });

  it('1 000 sommets au plus', async () => {
    const ring = (n: number) => ({
      vertices: Array.from({ length: n }, (_, k) => ({
        x_m: Math.round(Math.cos((2 * Math.PI * k) / n) * 50_000) / 1000,
        y_m: Math.round(Math.sin((2 * Math.PI * k) / n) * 50_000) / 1000,
      })),
    });
    expect(await check('polygon_m_valid', ring(1000))).toBe(true);
    expect(await check('polygon_m_valid', ring(1001))).toBe(false);
  });
});

describe('Q17 — le contenu d’une ligne de message, tel que le code l’écrit', () => {
  const entry = { destination_id: 'a5840000-0000-4000-8000-0000000000e1', text: { fr: 'Accueil', en: 'Reception' }, direction: 'left', distance_m: 12.5 };

  it('la forme écrite par le tableau des messages passe, mentions nulles comprises', async () => {
    expect(await check('message_content_valid', { block_kind: 'destination_list', entries: [entry] })).toBe(true);
    expect(await check('message_content_valid', {
      block_kind: 'arrow', entries: [{ destination_id: null, text: {}, direction: null, distance_m: null }],
    })).toBe(true);
  });

  it('une valeur par langue à plat, un type de bloc inconnu, une mention incomplète sont refusés', async () => {
    for (const bad of [
      { fr: 'Accueil', en: 'Reception' },
      { block_kind: 'banniere', entries: [] },
      { block_kind: 'arrow', entries: [{ text: { fr: 'x' } }] },
      { block_kind: 'arrow', entries: [{ ...entry, distance_m: '12' }] },
      { block_kind: 'arrow', entries: [{ ...entry, text: { fr: 3 } }] },
    ]) expect(await check('message_content_valid', bad)).toBe(false);
  });
});

describe('Formes fixées par le cahier', () => {
  it('texte libre : une valeur non vide par langue du site (N4.2, 0020)', async () => {
    expect(await check('lang_texts_valid', { fr: 'Hall', en: 'Lobby' })).toBe(true);
    for (const bad of [{}, { fr: '  ' }, { de: 'Halle' }, { fr: 1 }, ['Hall']]) {
      expect(await check('lang_texts_valid', bad)).toBe(false);
    }
  });

  it('empreintes couvertes : des identifiants (N2.2)', async () => {
    expect(await check('uuid_array_valid', ['a5840000-0000-4000-8000-0000000000f1'])).toBe(true);
    expect(await check('uuid_array_valid', [])).toBe(true);
    for (const bad of [['x'], [1], { id: 'a5840000-0000-4000-8000-0000000000f1' }]) {
      expect(await check('uuid_array_valid', bad)).toBe(false);
    }
  });

  it('constats : un code et une gravité de A7', async () => {
    expect(await check('findings_valid', [{ code: 'GRAPH.X', severity: 'warning', entity: null, params: {}, ruleRef: null }])).toBe(true);
    for (const bad of [[{ code: 'GRAPH.X' }], [{ code: 'GRAPH.X', severity: 'fatal' }], [{ severity: 'info' }], 'x']) {
      expect(await check('findings_valid', bad)).toBe(false);
    }
  });

  it('paramètres d’une règle : textes, nombres, booléens (D3.3)', async () => {
    expect(await check('scalar_params_valid', { expression: 'd/250', factor: 4, minimum_mm: 15, strict: true })).toBe(true);
    for (const bad of [{ nested: { a: 1 } }, { list: [1] }, { none: null }, [1]]) {
      expect(await check('scalar_params_valid', bad)).toBe(false);
    }
  });
});

describe('Q19 — contenant et taille', () => {
  it('le contenant attendu passe ; un scalaire, une chaîne, un excès de taille non', async () => {
    const [row] = await sql<{ ok: boolean; scalar: boolean; big: boolean }[]>`
      select azimut.jsonb_contained('{"a":1}'::jsonb, array['object']) as ok,
             azimut.jsonb_contained('"texte"'::jsonb, array['object','array']) as scalar,
             azimut.jsonb_contained(jsonb_build_object('a', repeat('x', 1048577)), array['object']) as big`;
    expect(row).toEqual({ ok: true, scalar: false, big: false });
  });
});

describe('0084 — les contraintes sont posées sur leurs tables', () => {
  it('une empreinte auto-intersectante est refusée par la table', async () => {
    const done = new Error('annulation voulue');
    let code = 'accepté';
    await sql.begin(async tx => {
      await tx.unsafe(`set local role ${FIXTURE_ROLE}`);
      try {
        await tx.savepoint(async sp => {
          await sp`insert into azimut.footprint(org_id, level_id, unit_code, kind, geometry)
                   values (gen_random_uuid(), gen_random_uuid(), 'X', 'cell',
                   '{"vertices":[{"x_m":0,"y_m":0},{"x_m":2,"y_m":2},{"x_m":2,"y_m":0},{"x_m":0,"y_m":2}]}')`;
        });
      } catch (e: unknown) {
        code = String((e as { code?: unknown }).code);
      }
      throw done;
    }).catch((e: unknown) => { if (e !== done) throw e; });
    expect(code).toBe('23514');
  });

  it('aucune colonne jsonb du schéma n’est sans contrainte', async () => {
    const free = await sql<{ col: string }[]>`
      select c.relname || '.' || a.attname as col
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'azimut' and c.relkind in ('r','p') and not c.relispartition
        and a.atttypid = 'jsonb'::regtype and not a.attisdropped
        and not exists (select 1 from pg_constraint k
                        where k.conrelid = c.oid and k.contype = 'c' and a.attnum = any(k.conkey))
      order by 1`;
    expect(free.map(r => r.col)).toEqual([]);
  });
});
