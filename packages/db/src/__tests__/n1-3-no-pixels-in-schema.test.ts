import { describe, it, expect } from 'vitest';
import { allUpSql } from '../migration-corpus.js';

/**
 * M01.S2 : « Aucune coordonnée **de géométrie du site** n'est stockée en
 * pixels. La conversion se fait à l'affichage, jamais en base. Seule
 * exception, le calage d'une source de plan, qui décrit l'image et non le
 * site : ses points sont conservés en pixels de l'image, suffixe `_px`, dans
 * les tables `plan_calibration` et `plan_calibration_point`. »
 *
 * N1.7, critère 2, dit comment le vérifier : « Aucune coordonnée en pixels en
 * base, **vérifié par analyse du schéma**. » Un essai qui n'inspecterait que
 * les commandes d'écriture laisserait passer une colonne créée par migration
 * et jamais écrite par elles — c'est-à-dire le cas qui s'installe en silence.
 *
 * Le motif recherché est la coordonnée, `x_px` et `y_px`, et non le pixel en
 * général : une échelle s'exprime légitimement en pixels par mètre, et une
 * dimension de fond de plan en pixels est la mesure d'un fichier, pas une
 * position dans le site.
 */

const COORDINATE_IN_PIXELS = /(^|_)[xy]_px$/;

/**
 * Infraction constatée, déclarée, et non corrigée ici.
 *
 * `control_point` vient de la migration `0018_atelier_m1_4_measured_calibration`,
 * écrite d'après le complément « atelier ». Ce document ne fait plus foi
 * depuis la consolidation, et M01.S2 ne souffre aucune exception : « Aucune
 * coordonnée en pixels n'est stockée. »
 *
 * La retirer est une migration destructrice, donc un cas d'arrêt de A2.2,
 * point 7. Elle est donc nommée ici plutôt que corrigée en silence : le garde
 * refuse toute occurrence nouvelle, et celle-ci reste visible jusqu'à
 * l'arbitrage.
 */
const DECLARED_BREACHES: Readonly<Record<string, string>> = {
  'control_point.source_x_px':
    'Migration 0018, complément « atelier », document sans autorité depuis la consolidation. Retrait destructeur : A2.2 point 7.',
  'control_point.source_y_px':
    'Migration 0018, même origine et même motif que `source_x_px`.',
};

/**
 * Les deux tables que A5.2 autorise nommément à porter des pixels.
 *
 * Ce n'est pas une tolérance mais une exception écrite : « Seules colonnes en
 * pixels de la base : elles décrivent l'image source, jamais le site. » Le
 * garde continue de refuser toute autre occurrence, y compris dans ces deux
 * tables si une colonne nouvelle y apparaissait sans figurer ici.
 */
const AUTHORISED_BY_A5_2: ReadonlySet<string> = new Set([
  'plan_calibration.origin_x_px',
  'plan_calibration.origin_y_px',
  'plan_calibration_point.image_x_px',
  'plan_calibration_point.image_y_px',
]);

/** Les colonnes créées par les migrations, table par table. */
function migratedColumns(): ReadonlyMap<string, readonly string[]> {
  const out = new Map<string, string[]>();
  const sql = allUpSql();

  for (const created of sql.matchAll(
    /CREATE TABLE (?:IF NOT EXISTS )?azimut\.(\w+)\s*\(([\s\S]*?)\n\);/g,
  )) {
    const columns: string[] = [];
    for (const raw of (created[2] ?? '').split('\n')) {
      const name = /^\s*([a-z_][a-z0-9_]*)\s/.exec(raw)?.[1];
      if (name !== undefined && !RESERVED.has(name.toUpperCase())) columns.push(name);
    }
    out.set(created[1] ?? '', columns);
  }

  for (const altered of sql.matchAll(/ALTER TABLE azimut\.(\w+)([\s\S]*?);/g)) {
    const table = out.get(altered[1] ?? '') ?? [];
    for (const added of (altered[2] ?? '').matchAll(/ADD COLUMN ([a-z_][a-z0-9_]*)/g)) {
      table.push(added[1] ?? '');
    }
    out.set(altered[1] ?? '', table);
  }
  return out;
}

/** Mots qui ouvrent une contrainte de table, jamais une colonne. */
const RESERVED = new Set([
  'PRIMARY', 'FOREIGN', 'UNIQUE', 'CHECK', 'CONSTRAINT', 'EXCLUDE', 'LIKE',
]);

describe('M01.S2 (partie N) — aucune coordonnée en pixels en base', () => {
  it('le schéma se lit, sans quoi l’essai ne prouverait rien', () => {
    const tables = migratedColumns();
    expect(tables.size).toBeGreaterThan(40);
    expect(tables.get('site')).toContain('country_code');
  });

  it('aucune colonne ne porte une coordonnée en pixels', () => {
    const offenders: string[] = [];
    for (const [table, columns] of migratedColumns()) {
      for (const column of columns) {
        const qualified = `${table}.${column}`;
        if (!COORDINATE_IN_PIXELS.test(column)) continue;
        if (AUTHORISED_BY_A5_2.has(qualified)) continue;
        if (qualified in DECLARED_BREACHES) continue;
        offenders.push(qualified);
      }
    }
    expect(
      offenders,
      'M01.S2 (partie N) : ces colonnes stockent une position en pixels. '
      + 'Le repère de stockage est le repère site, en mètres (D1.1).\n'
      + offenders.join('\n'),
    ).toHaveLength(0);
  });

  it('les infractions déclarées existent encore, sans quoi la dette serait fictive', () => {
    const columns = new Set<string>();
    for (const [table, names] of migratedColumns()) {
      for (const name of names) columns.add(`${table}.${name}`);
    }
    for (const declared of Object.keys(DECLARED_BREACHES)) {
      expect(columns, `${declared} : déclarée en infraction mais absente du schéma`)
        .toContain(declared);
    }
  });

  it('la mesure reconnaît une colonne fautive, sinon elle ne mesure rien', () => {
    expect(COORDINATE_IN_PIXELS.test('origin_x_px')).toBe(true);
    expect(COORDINATE_IN_PIXELS.test('y_px')).toBe(true);
    // Une échelle et une dimension de fichier ne sont pas des coordonnées.
    expect(COORDINATE_IN_PIXELS.test('scale_m_per_px')).toBe(false);
    expect(COORDINATE_IN_PIXELS.test('width_px')).toBe(false);
  });
});

/**
 * L'exception de A5.2 est une exception, et une exception se vérifie dans les
 * deux sens : si les quatre colonnes disparaissaient, l'autorisation
 * deviendrait un commentaire sans objet, et le garde cesserait de dire quoi
 * que ce soit sur elles.
 */
describe('A5.2 — les quatre colonnes autorisées existent', () => {
  it('chacune est bien créée par une migration', () => {
    const tables = migratedColumns();
    for (const qualified of AUTHORISED_BY_A5_2) {
      const [table, column] = qualified.split('.');
      expect(tables.get(table ?? ''), qualified).toContain(column);
    }
  });
});
