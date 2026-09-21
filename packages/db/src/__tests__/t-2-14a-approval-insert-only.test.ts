import { describe, it, expect } from 'vitest';
import { allUpSql, upMigrations } from '../migration-corpus.js';

/**
 * T-2.14a, critère d'acceptation nº 9 — insertion seule des approbations.
 *
 * « La table des approbations est en insertion seule, garanti au niveau de la
 * base et non par convention applicative. Une tentative de modification ou de
 * suppression échoue même avec le rôle d'administration. »
 *
 * La migration 0009 pose deux déclencheurs, BEFORE UPDATE et BEFORE DELETE,
 * tous deux par ligne. Éprouvés sur une base réelle avec le rôle propriétaire,
 * ils refusent bien les deux tentatives. Mais TRUNCATE ne déclenche aucun
 * déclencheur par ligne, et vidait la table — vérifié, note du préalable K4
 * nº 7. Trois voies, trois barrages.
 */
describe('T-2.14a nº 9 — approval en insertion seule', () => {
  const sql = allUpSql();

  it('refuse la modification et la suppression, par déclencheur de ligne', () => {
    expect(sql).toMatch(/CREATE TRIGGER guard_approval_update\s+BEFORE UPDATE ON azimut\.approval/);
    expect(sql).toMatch(/CREATE TRIGGER guard_approval_delete\s+BEFORE DELETE ON azimut\.approval/);
  });

  it('refuse le vidage, par déclencheur d’instruction', () => {
    expect(sql).toMatch(/BEFORE TRUNCATE ON azimut\.approval/);
    expect(sql).toMatch(/FOR EACH STATEMENT EXECUTE FUNCTION azimut\.block_approval_truncate/);
  });

  /**
   * Un déclencheur se désarme. Les droits, non : le rôle applicatif n'a
   * simplement pas la modification ni la suppression sur cette table. Les deux
   * barrages sont voulus, l'un ne remplace pas l'autre.
   */
  it('retire aussi la modification et la suppression des droits du rôle', () => {
    expect(sql).toContain('REVOKE UPDATE, DELETE ON azimut.approval FROM authenticated');
  });

  /**
   * La politique de `approval` ne doit jamais être un `FOR ALL` : une table en
   * insertion seule dont la politique autorise tout se contredit elle-même.
   */
  it('n’accorde qu’une politique de lecture et une d’insertion', () => {
    expect(sql).toMatch(/CREATE POLICY approval_org_select ON azimut\.approval\s+FOR SELECT/);
    expect(sql).toMatch(/CREATE POLICY approval_org_insert ON azimut\.approval\s+FOR INSERT/);
    expect(sql).not.toMatch(/CREATE POLICY \S+ ON azimut\.approval\s+FOR ALL/);
  });

  it('la migration 0025 ne transforme aucune donnée', () => {
    const m = upMigrations().find(x => x.name.startsWith('0025_'));
    expect(m).toBeDefined();
    // A2.2-7 : elle pose des politiques, des droits et un déclencheur. Elle
    // n'ajoute ni ne retire de colonne, et ne touche à aucune ligne.
    for (const forbidden of ['UPDATE azimut.', 'DELETE FROM', 'DROP TABLE', 'DROP COLUMN', 'ADD COLUMN']) {
      expect(m?.sql).not.toContain(forbidden);
    }
  });
});
