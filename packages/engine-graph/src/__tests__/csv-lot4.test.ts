import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { refMultilevel } from '@azimut/testkit';
import { parseCsvRecords, readCsv } from '../csv-utils.js';
import { importOccupancy } from '../import-occupancy.js';
import { importSupports } from '../import-supports.js';
import { CSV_LIMITS } from './csv-limits.js';

/**
 * Lot 4 de l'audit (A6.3) : un import de tableur se lit dans ses bornes, ligne
 * par ligne, par le même contrôle que la saisie, avec un rapport d'erreurs.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION = resolve(HERE, '..', '..', '..', 'db', 'migrations', '0082_a6_3_validation_des_entrees.up.sql');
const RLO = String.fromCodePoint(0x202e);
const BEL = String.fromCodePoint(7);
const HEADER = 'unit_code;building;level;occupancy_status';

describe('lot 4 : les bornes des essais sont celles de la migration', () => {
  it('0082 inscrit les valeurs que les essais emploient', () => {
    const sql = readFileSync(MIGRATION, 'utf8');
    const seeded = (key: string): number => Number(new RegExp(`\\('${key.replace(/\./g, '\\.')}', (\\d+),`).exec(sql)?.[1]);
    expect(seeded('import.csv.max_bytes')).toBe(CSV_LIMITS.maxBytes);
    expect(seeded('import.csv.max_rows')).toBe(CSV_LIMITS.maxRows);
    expect(seeded('input.text.max_chars')).toBe(CSV_LIMITS.maxChars);
  });
});

describe('lot 4 : le parseur suit la RFC 4180', () => {
  it('un champ entre guillemets porte séparateur, guillemet doublé et fin de ligne', () => {
    const { records } = parseCsvRecords('a;"b;""c""\nd";e\nf;g;h', ';');
    expect(records).toEqual([
      { line: 1, fields: ['a', 'b;"c"\nd', 'e'] },
      { line: 3, fields: ['f', 'g', 'h'] },
    ]);
  });

  it('numérote les lignes physiques, lignes vides comprises', () => {
    const read = readCsv(`${HEADER}\n\nU1;A;RDC;vacant\r\n\r\nU2;A;RDC;vacant`, CSV_LIMITS);
    expect(read.ok && read.rows.map(r => r.line)).toEqual([3, 5]);
  });

  it('signale un guillemet jamais refermé, et rejette sa ligne', () => {
    const out = importOccupancy(refMultilevel, `${HEADER}\nU1;"A;RDC;vacant`, CSV_LIMITS);
    expect(out.ok && out.value.lines[0]?.findings[0]?.params['reason']).toBe('unterminated_quote');
  });
});

describe('lot 4 : un fichier hors de ses bornes est refusé en entier', () => {
  it('au-delà de la taille', () => {
    const out = importOccupancy(refMultilevel, `${HEADER}\nU1;A;RDC;vacant`, { ...CSV_LIMITS, maxBytes: 10 });
    expect(out.ok ? null : out.findings[0]?.code).toBe('IMPORT.FILE_TOO_LARGE');
  });

  it('au-delà du nombre de lignes, sans lecture partielle', () => {
    const rows = Array.from({ length: 4 }, (_, i) => `U${String(i)};A;RDC;vacant`);
    const out = importSupports(refMultilevel, ['reference;typology;building;level;node_ref', ...rows].join('\n'),
      { limits: { ...CSV_LIMITS, maxRows: 3 } });
    expect(out.ok ? null : out.findings[0]).toMatchObject({ code: 'IMPORT.FILE_TOO_LARGE', params: { rows: 4, max_rows: 3 } });
  });
});

describe('lot 4 : chaque ligne passe le contrôle de la saisie', () => {
  const reasons = (content: string): readonly unknown[] => {
    const out = importOccupancy(refMultilevel, content, CSV_LIMITS);
    return out.ok ? out.value.lines.map(l => l.findings[0]?.params['reason'] ?? l.status) : [];
  };

  it.each([
    ['un forçage de direction', `U1${RLO};A;RDC;vacant`, 'unit_code bidi'],
    ['un caractère de contrôle', `U1;A${BEL};RDC;vacant`, 'building control'],
    ['un code d’unité au-delà de M3', `${'U'.repeat(21)};A;RDC;vacant`, 'unit_code too_long'],
    ['une fin de ligne dans un champ d’une ligne', `"U\n1";A;RDC;vacant`, 'unit_code line_break'],
  ])('rejette %s, et le dit', (_label, line, reason) => {
    expect(reasons(`${HEADER}\n${line}`)).toEqual([reason]);
  });

  it('rejette une cellule au-delà du plafond de caractères', () => {
    const out = importOccupancy(refMultilevel, `${HEADER};name_fr\nU1;A;RDC;vacant;${'x'.repeat(11)}`,
      { ...CSV_LIMITS, maxChars: 10 });
    expect(out.ok && out.value.lines[0]?.findings[0]?.params['reason']).toBe('name_fr too_long');
  });

  it('normalise en NFC et retire les espaces de bord, sans rien réécrire d’autre', () => {
    const out = importOccupancy(refMultilevel, `${HEADER};name_fr\nU1;A;RDC;vacant;  Café  `, CSV_LIMITS);
    expect(out.ok && out.value.lines[0]?.entry?.name_fr).toBe('Café');
  });

  it('une ligne rejetée n’empêche pas la suivante', () => {
    expect(reasons(`${HEADER}\nU1${RLO};A;RDC;vacant\nU2;A;RDC;vacant`)).toEqual(['unit_code bidi', 'pending']);
  });
});
