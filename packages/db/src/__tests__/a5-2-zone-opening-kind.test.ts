import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ZONE_KINDS, isSiteZoneKind, OPENING_KINDS, isOpeningKind,
} from '@azimut/core-model';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION = resolve(
  HERE, '..', '..', 'migrations', '0029_a5_2_zone_opening_kind.up.sql',
);

/**
 * A5.2 — `zone.kind` et `opening.kind` ont désormais leurs valeurs au schéma.
 *
 * Les deux colonnes sont restées en texte libre depuis la migration 0003 :
 * le document ne les énumérait pas, et en inventer aurait été une faute. Il
 * les déclare, et ce contrôle tient les deux listes ensemble — celle de la
 * base et celle du modèle — comme le fait déjà `footprint.kind`. Si elles
 * divergeaient, une des deux mentirait, et c'est celle qu'un développeur lit
 * qui le tromperait.
 */
function kindsIn(table: string): readonly string[] {
  const sql = readFileSync(MIGRATION, 'utf-8');
  const clause = new RegExp(
    `ALTER TABLE azimut\\.${table}[\\s\\S]*?CHECK \\(kind IN \\(([^)]+)\\)\\)`,
  ).exec(sql);
  if (clause === null) throw new Error(`CHECK de ${table} introuvable`);
  return (clause[1] ?? '')
    .split(',')
    .map(part => part.trim().replace(/^'|'$/g, ''))
    .filter(part => part.length > 0);
}

describe('A5.2 — natures de zone et d’ouverture', () => {
  it('la base et le modèle déclarent les mêmes natures de zone', () => {
    expect([...kindsIn('zone')].sort()).toEqual([...ZONE_KINDS].sort());
  });

  it('la base et le modèle déclarent les mêmes natures d’ouverture', () => {
    expect([...kindsIn('opening')].sort()).toEqual([...OPENING_KINDS].sort());
  });

  it('chaque nature déclarée en base passe la restriction de type', () => {
    for (const kind of kindsIn('zone')) expect(isSiteZoneKind(kind), kind).toBe(true);
    for (const kind of kindsIn('opening')) expect(isOpeningKind(kind), kind).toBe(true);
  });

  /**
   * La zone du socle et la zone d'orientation du module 02 portent le même mot
   * et deux listes différentes. Les confondre ferait ranger une galerie parmi
   * les locaux techniques.
   */
  it('ne confond pas les natures de zone du socle et celles du module 02', () => {
    expect(isSiteZoneKind('mall')).toBe(false);
    expect(isSiteZoneKind('entrance')).toBe(false);
    expect(isSiteZoneKind('core')).toBe(false);
  });

  it('refuse une nature d’ouverture inventée', () => {
    for (const kind of ['window', 'gate', 'porte']) {
      expect(isOpeningKind(kind), kind).toBe(false);
    }
  });
});
