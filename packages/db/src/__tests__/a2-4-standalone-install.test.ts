import { describe, it, expect } from 'vitest';
import { upMigrations } from '../migration-corpus.js';

/**
 * A2.4 — « Utiliser une fonctionnalité de la plateforme d'hébergement non
 * disponible en installation autonome » est une interdiction permanente.
 *
 * Le socle en portait deux : trois clés étrangères vers `auth.users`, et
 * `auth.uid()` au cœur du cloisonnement. Sur une base autonome, neuf
 * migrations sur vingt-sept échouaient en cascade faute de cette table —
 * vérifié, note du préalable K4 nº 7.
 *
 * La migration 0024 retire les trois renvois et substitue à `auth.uid()` une
 * fonction qui lit d'abord un réglage de session. Éprouvé sur une base d'où le
 * schéma `auth` avait été entièrement supprimé : le cloisonnement continue de
 * rendre les valeurs de la seule organisation de l'utilisateur.
 */
describe('A2.4 — le socle s’installe sans la plateforme', () => {
  const migrations = upMigrations();
  const a24 = migrations.find(m => m.name.startsWith('0024_'));
  const sql = migrations.map(m => m.sql).join('\n');

  it('la migration 0024 existe et vise l’installation autonome', () => {
    expect(a24?.name).toBe('0024_a2_4_no_platform_dependency.up.sql');
  });

  it('retire les trois clés étrangères vers la table de comptes de la plateforme', () => {
    for (const constraint of [
      'membership_user_id_fkey',
      'proof_reviewer_id_fkey',
      'audit_log_actor_id_fkey',
    ]) {
      expect(a24?.sql).toContain(`DROP CONSTRAINT IF EXISTS ${constraint}`);
    }
  });

  /**
   * A5.1 donne `membership (id, org_id, user_id, role, created_at)` sans
   * cible à `user_id`. Retirer ces renvois aligne le schéma sur le cahier ;
   * inventer une table de comptes propre au produit aurait été un choix de
   * modèle non prévu, donc A2.2-2.
   */
  it('n’invente aucune table de comptes', () => {
    expect(a24?.sql).not.toMatch(/CREATE TABLE\s+(IF NOT EXISTS\s+)?azimut\.(user|account|app_user)/);
  });

  it('la dernière définition du cloisonnement n’appelle plus la plateforme', () => {
    const definitions = [...sql.matchAll(/CREATE OR REPLACE FUNCTION azimut\.user_org_ids\(\)[\s\S]*?\$\$;/g)];
    expect(definitions.length).toBeGreaterThanOrEqual(2);
    const last = definitions[definitions.length - 1]?.[0] ?? '';
    expect(last).toContain('azimut.current_user_id()');
    expect(last).not.toContain('auth.uid()');
  });

  /**
   * Sans réglage de session et sans plateforme, l'identité est nulle,
   * `user_org_ids()` ne rend aucune organisation et rien n'est visible. Le
   * défaut est fermé, jamais ouvert : vérifié à l'essai, 0 site au lieu de 1.
   */
  it('lit l’identité depuis un réglage de session, la plateforme en secours', () => {
    expect(a24?.sql).toContain("current_setting('azimut.current_user_id', true)");
    expect(a24?.sql).toMatch(/EXCEPTION WHEN undefined_function OR invalid_schema_name THEN\s+RETURN NULL;/);
  });

  it('ne transforme aucune donnée', () => {
    // A2.2-7 : retirer une contrainte ne touche à aucune ligne. Les colonnes,
    // leur type et leur caractère obligatoire sont inchangés.
    for (const forbidden of ['UPDATE azimut.', 'DELETE FROM', 'DROP TABLE', 'DROP COLUMN', 'TRUNCATE']) {
      expect(a24?.sql).not.toContain(forbidden);
    }
  });
});
