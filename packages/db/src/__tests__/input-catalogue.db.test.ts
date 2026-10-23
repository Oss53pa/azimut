import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { INPUT_COLUMNS } from '@azimut/core-model';
import { inputCatalogue, declarationFiles, inputGuardGaps } from '../input-catalogue.js';

/**
 * Lot 4 de l'audit (A6.3) : le catalogue des colonnes que le modèle déclare
 * est celui de la base migrée, table par table et colonne par colonne.
 *
 * Les schémas stricts d'écriture et de relecture en découlent. Une migration
 * qui ajoute, retire ou retype une colonne sans que la déclaration suive fait
 * échouer cet essai. `AZIMUT_WRITE_INPUT_CATALOGUE=1` réécrit la déclaration
 * depuis la base, à relire avant de la commettre.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];
const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET = resolve(HERE, '..', '..', '..', 'core-model', 'src', 'input');
const TABLES_PER_FILE = 50;

let sql: postgres.Sql;

beforeAll(() => {
  if (URL === undefined || URL === '') {
    throw new Error('AZIMUT_TEST_DATABASE_URL absente. Voir packages/db/migrations/ORDRE.md.');
  }
  sql = postgres(URL, { onnotice: () => undefined });
});

afterAll(async () => { await sql.end(); });

describe('lot 4 : le catalogue des colonnes', () => {
  it('la déclaration du modèle est celle de la base migrée', async () => {
    const actual = await inputCatalogue(text => sql.unsafe(text));
    if (process.env['AZIMUT_WRITE_INPUT_CATALOGUE'] === '1') {
      declarationFiles(actual, TABLES_PER_FILE).forEach((text, i) => {
        writeFileSync(resolve(TARGET, `input-columns-${String(i + 1).padStart(2, '0')}.ts`), text);
      });
    }
    expect(INPUT_COLUMNS).toEqual(actual);
  });

  it('voit une colonne ajoutée, et l’énumération d’une contrainte', async () => {
    const done = new Error('annulation voulue');
    let seen: Readonly<Record<string, string>> | undefined;
    await sql.begin(async tx => {
      await tx.unsafe(`create table azimut.zz_lot4 (id uuid primary key,
        state text not null check (state in ('a', 'b')), note text)`);
      seen = (await inputCatalogue(text => tx.unsafe(text)))['zz_lot4'];
      throw done;
    }).catch((e: unknown) => { if (e !== done) throw e; });
    expect(seen).toEqual({ id: 'uuid', state: '=a|b', note: '?text' });
  });

  it('chaque table porte la garde des entrées, et une table neuve sans elle se voit', async () => {
    expect(await inputGuardGaps(text => sql.unsafe(text))).toEqual([]);
    const done = new Error('annulation voulue');
    let gaps: readonly string[] = [];
    await sql.begin(async tx => {
      await tx.unsafe('create table azimut.zz_lot4_nue (id uuid primary key)');
      gaps = await inputGuardGaps(text => tx.unsafe(text));
      throw done;
    }).catch((e: unknown) => { if (e !== done) throw e; });
    expect(gaps).toEqual(['zz_lot4_nue']);
  });
});
