import { describe, it, expect } from 'vitest';
import {
  SCHEDULE_ACTORS, SCHEDULE_PERMISSIONS, can, canOpenScreen, permissionOfTrigger,
} from '../message-schedule-permissions.js';
import { SCHEDULE_TRIGGERS, triggersFrom } from '@azimut/engine-graph';

/**
 * R2 (partie R) — la table des droits, recopiée et éprouvée ligne à ligne.
 *
 * Critère 8 de R18 : « Un utilisateur qui a généré une version ne peut pas
 * l'approuver. » Il ne tient pas à une vérification au moment d'approuver : il
 * tient à ce qu'aucun acteur ne porte à la fois les deux droits. C'est ce que
 * le dernier essai de ce fichier vérifie, et il tient même si l'écran change.
 */

describe('R2 (partie R) — la table des droits', () => {
  it('admin et designer produisent, sans décider', () => {
    for (const actor of ['admin', 'designer'] as const) {
      expect(can(actor, 'consult'), actor).toBe(true);
      expect(can(actor, 'generate'), actor).toBe(true);
      expect(can(actor, 'submit_for_review'), actor).toBe(true);
      expect(can(actor, 'annotate'), actor).toBe(true);
      expect(can(actor, 'export'), actor).toBe(true);
      expect(can(actor, 'decide'), actor).toBe(false);
    }
  });

  it('la maîtrise d’ouvrage et le relecteur externe décident, sans produire', () => {
    for (const actor of ['owner_rep', 'external_reviewer'] as const) {
      expect(can(actor, 'decide'), actor).toBe(true);
      expect(can(actor, 'annotate'), actor).toBe(true);
      expect(can(actor, 'generate'), actor).toBe(false);
      expect(can(actor, 'submit_for_review'), actor).toBe(false);
    }
  });

  it('l’auditeur lit et exporte, rien d’autre', () => {
    expect(can('auditor', 'consult')).toBe(true);
    expect(can('auditor', 'export')).toBe(true);
    for (const permission of ['generate', 'submit_for_review', 'annotate', 'decide'] as const) {
      expect(can('auditor', permission), permission).toBe(false);
    }
  });

  /** R16 : « Écran absent pour les rôles sans consultation. » */
  it('trois rôles ne voient pas l’écran du tout', () => {
    for (const actor of ['operator', 'vendor', 'marketing'] as const) {
      expect(canOpenScreen(actor), actor).toBe(false);
      for (const permission of SCHEDULE_PERMISSIONS) {
        expect(can(actor, permission), `${actor}/${permission}`).toBe(false);
      }
    }
  });

  /**
   * Critère 8 de R18, tenu par la table et non par un contrôle de l'écran :
   * aucun acteur ne porte à la fois le droit de générer et celui de décider.
   */
  it('aucun acteur ne produit et ne décide à la fois', () => {
    const both = SCHEDULE_ACTORS.filter(
      actor => can(actor, 'generate') && can(actor, 'decide'),
    );
    expect(both).toEqual([]);
  });

  it('tout acteur qui peut agir peut d’abord consulter', () => {
    for (const actor of SCHEDULE_ACTORS) {
      const acts = SCHEDULE_PERMISSIONS.filter(p => p !== 'consult' && can(actor, p));
      if (acts.length > 0) expect(canOpenScreen(actor), actor).toBe(true);
    }
  });
});

describe('R2 et R12 (partie R) — droit et état se croisent, sans se remplacer', () => {
  it('chaque déclencheur de R12 a son droit, sauf le remplacement', () => {
    for (const trigger of SCHEDULE_TRIGGERS) {
      const permission = permissionOfTrigger(trigger);
      if (trigger === 'supersede') expect(permission).toBeNull();
      else expect(permission, trigger).not.toBeNull();
    }
  });

  /**
   * L'exemple qui compte : depuis `in_review`, la machine permet approuver et
   * rejeter ; un `designer` n'en obtient aucun des deux, et R4 (partie R) veut alors que
   * l'action soit absente, jamais grisée.
   */
  it('un designer devant une version en revue n’a aucune action', () => {
    const offered = triggersFrom('in_review').filter(trigger => {
      const permission = permissionOfTrigger(trigger);
      return permission !== null && can('designer', permission);
    });
    expect(offered).toEqual([]);
  });

  it('la maîtrise d’ouvrage devant une version en revue a les deux', () => {
    const offered = triggersFrom('in_review').filter(trigger => {
      const permission = permissionOfTrigger(trigger);
      return permission !== null && can('owner_rep', permission);
    });
    expect(offered).toEqual(['reject', 'approve']);
  });

  it('la maîtrise d’ouvrage ne génère pas, même sur un brouillon', () => {
    const offered = triggersFrom('draft').filter(trigger => {
      const permission = permissionOfTrigger(trigger);
      return permission !== null && can('owner_rep', permission);
    });
    expect(offered).toEqual([]);
  });
});
