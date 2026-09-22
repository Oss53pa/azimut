import { describe, it, expect } from 'vitest';
import {
  buildCommand,
  inverseCommand,
  changedColumns,
  ownsTable,
} from '../site-commands.js';
import type { CommandDraft } from '../site-commands.js';

const T = '2026-09-21T10:00:00.000Z';
const ORG = 'aaaaaaaa-0000-0000-0000-000000000001';

function draft(over: Partial<CommandDraft> = {}): CommandDraft {
  return {
    operation: 'create',
    module: '01-socle',
    table: 'site',
    id: 'site-1',
    org_id: ORG,
    after: { id: 'site-1', org_id: ORG, name: 'Site', country_code: 'FR' },
    timestamp: T,
    ...over,
  };
}

function built(over: Partial<CommandDraft> = {}) {
  const out = buildCommand(draft(over));
  if (!out.ok) throw new Error(out.findings.map(f => f.code).join(','));
  return out.value;
}

/**
 * E5.1 — « Toute modification de donnée passe par une commande, objet
 * sérialisable comportant : un type, une cible, les valeurs avant et après, et
 * un horodatage fourni par l'appelant, jamais lu par la commande elle-même. »
 */
describe('E5.1 — commande d’écriture', () => {
  it('construit une commande de création', () => {
    const c = built();
    expect(c.operation).toBe('create');
    expect(c.before).toBeNull();
    expect(c.timestamp).toBe(T);
  });

  it('est sérialisable sans perte', () => {
    const c = built();
    expect(JSON.parse(JSON.stringify(c))).toEqual(c);
  });

  /**
   * L'horodatage vient de l'appelant. Une commande qui lirait l'horloge
   * rendrait deux exécutions du même état différentes, contre INV-4.
   */
  it('refuse une commande sans horodatage', () => {
    const out = buildCommand(draft({ timestamp: '  ' }));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.findings.map(f => f.code)).toContain('EDIT.TIMESTAMP_REQUIRED');
  });

  describe('R1 et R2 (partie L) — un module n’écrit que ce qu’il possède', () => {
    it('accepte une table que le module possède', () => {
      expect(ownsTable('01-socle', 'site')).toBe(true);
      expect(built({ table: 'node' }).table).toBe('node');
    });

    /**
     * Le socle ne possède pas `proof` : c'est la signalétique (L3). Une
     * commande du socle qui y toucherait contournerait la propriété unique.
     */
    it('refuse une table que le module ne possède pas', () => {
      const out = buildCommand(draft({ table: 'proof' }));
      expect(out.ok).toBe(false);
      if (!out.ok) expect(out.findings.map(f => f.code)).toContain('EDIT.TABLE_NOT_OWNED');
    });

    it('refuse une table qui n’existe dans aucun module', () => {
      const out = buildCommand(draft({ table: 'pg_catalog' }));
      expect(out.ok).toBe(false);
    });
  });

  describe('forme et opération s’accordent', () => {
    it('une création n’a pas d’état avant', () => {
      const out = buildCommand(draft({ before: { id: 'site-1' } }));
      expect(out.ok).toBe(false);
      if (!out.ok) expect(out.findings[0]?.code).toBe('EDIT.COMMAND_SHAPE_INVALID');
    });

    it('une suppression n’a pas d’état après', () => {
      const out = buildCommand(draft({ operation: 'delete', before: { id: 'site-1' }, after: null }));
      expect(out.ok).toBe(true);
    });

    it('une mise à jour porte les deux états', () => {
      const out = buildCommand(draft({
        operation: 'update',
        before: { name: 'Avant' },
        after: { name: 'Après' },
      }));
      expect(out.ok).toBe(true);
    });

    it('une mise à jour sans état avant est refusée', () => {
      const out = buildCommand(draft({ operation: 'update', before: null, after: { name: 'x' } }));
      expect(out.ok).toBe(false);
    });
  });
});

/**
 * E5.1 — « Une commande est réversible. Une commande non réversible est
 * refusée en revue. » L'inverse se calcule sans relire la base, la commande
 * portant ses deux états.
 */
describe('E5.1 — réversibilité', () => {
  const T2 = '2026-09-21T10:00:01.000Z';

  it('l’inverse d’une création est une suppression', () => {
    const inv = inverseCommand(built(), T2);
    expect(inv.operation).toBe('delete');
    expect(inv.after).toBeNull();
    expect(inv.before).toEqual(built().after);
  });

  it('l’inverse d’une suppression est une création', () => {
    const c = built({ operation: 'delete', before: { id: 'site-1', name: 'x' }, after: null });
    expect(inverseCommand(c, T2).operation).toBe('create');
  });

  it('l’inverse d’une mise à jour échange les deux états', () => {
    const c = built({ operation: 'update', before: { name: 'A' }, after: { name: 'B' } });
    const inv = inverseCommand(c, T2);
    expect(inv.before).toEqual({ name: 'B' });
    expect(inv.after).toEqual({ name: 'A' });
  });

  it('l’inverse d’un inverse est la commande d’origine', () => {
    const c = built({ operation: 'update', before: { name: 'A' }, after: { name: 'B' } });
    expect(inverseCommand(inverseCommand(c, T2), T)).toEqual(c);
  });

  /** L'inverse non plus ne lit l'horloge : son horodatage est fourni. */
  it('l’inverse porte l’horodatage fourni, jamais celui de l’origine', () => {
    expect(inverseCommand(built(), T2).timestamp).toBe(T2);
  });
});

/**
 * W8 (partie N) — « Toute modification du graphe ou de l'annuaire marque
 * périmées les seules lignes concernées. Ni plus, ni moins. » La précision de
 * la péremption commence ici : savoir exactement ce qui a changé.
 */
describe('W8 (partie N) — les colonnes réellement changées', () => {
  it('ne retient que les colonnes dont la valeur diffère', () => {
    const c = built({
      operation: 'update',
      before: { name: 'A', country_code: 'FR' },
      after: { name: 'B', country_code: 'FR' },
    });
    expect(changedColumns(c)).toEqual(['name']);
  });

  it('une mise à jour qui ne change rien ne change rien', () => {
    const c = built({ operation: 'update', before: { name: 'A' }, after: { name: 'A' } });
    expect(changedColumns(c)).toEqual([]);
  });

  it('rend un ordre stable, quel que soit l’ordre de saisie', () => {
    const a = built({ operation: 'update', before: { b: '1', a: '1' }, after: { b: '2', a: '2' } });
    const b = built({ operation: 'update', before: { a: '1', b: '1' }, after: { a: '2', b: '2' } });
    expect(changedColumns(a)).toEqual(changedColumns(b));
    expect(changedColumns(a)).toEqual(['a', 'b']);
  });
});

/**
 * L0 — « L'implantation d'un support est une décision de wayfinding, pas de
 * signalétique. » `support` est la seule table à deux propriétaires, et la
 * garantie ne vaut que si `buildCommand` la tient colonne par colonne :
 * déclarée dans `SUPPORT_COLUMN_OWNER` sans être appliquée, la scission
 * n'était qu'un commentaire.
 */
describe('la table scindée — `support`, colonne par colonne', () => {
  const BASE = {
    operation: 'update' as const,
    table: 'support',
    id: 'sup-1',
    org_id: 'org-1',
    timestamp: '2026-09-22T10:00:00.000Z',
  };

  it('laisse le wayfinding écrire une colonne d’implantation', () => {
    const out = buildCommand({
      ...BASE, module: '02-wayfinding',
      before: { code: null }, after: { code: 'D-042' },
    });
    expect(out.ok).toBe(true);
  });

  it('laisse la signalétique écrire une cote', () => {
    const out = buildCommand({
      ...BASE, module: '04-signaletique',
      before: { width_mm: 600 }, after: { width_mm: 800 },
    });
    expect(out.ok).toBe(true);
  });

  it('refuse au wayfinding la part de la signalétique, et l’inverse', () => {
    const wayfinding = buildCommand({
      ...BASE, module: '02-wayfinding',
      before: { width_mm: 600 }, after: { width_mm: 800 },
    });
    const signage = buildCommand({
      ...BASE, module: '04-signaletique',
      before: { node_id: 'n-1' }, after: { node_id: 'n-2' },
    });
    expect(wayfinding.ok).toBe(false);
    expect(signage.ok).toBe(false);
    if (!wayfinding.ok) {
      expect(wayfinding.findings[0]?.code).toBe('EDIT.TABLE_NOT_OWNED');
      expect(wayfinding.findings[0]?.params['column']).toBe('width_mm');
    }
  });

  it('nomme chaque colonne refusée, et non la première', () => {
    const out = buildCommand({
      ...BASE, module: '02-wayfinding',
      before: { code: null, width_mm: 600, kind: 'totem' },
      after: { code: 'D-042', width_mm: 800, kind: 'drapeau' },
    });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.findings.map(f => f.params['column'])).toEqual(['kind', 'width_mm']);
    }
  });

  it('ne refuse pas une colonne reposée à sa propre valeur', () => {
    // Le propriétaire voisin n'écrit rien : la colonne figure au message, elle
    // ne change pas. Refuser ici ferait échouer des commandes inoffensives.
    const out = buildCommand({
      ...BASE, module: '02-wayfinding',
      before: { code: null, width_mm: 600 },
      after: { code: 'D-042', width_mm: 600 },
    });
    expect(out.ok).toBe(true);
  });

  it('refuse la suppression de la ligne aux deux propriétaires', () => {
    for (const module of ['02-wayfinding', '04-signaletique'] as const) {
      const out = buildCommand({
        ...BASE, operation: 'delete', module, before: { code: 'D-042' },
      });
      expect(out.ok, module).toBe(false);
    }
  });

  it('refuse une création : les colonnes d’identité n’ont pas de propriétaire', () => {
    // L0 réserve l'identité à la création par le socle, et le socle ne possède
    // pas `support`. Aucune commande ne crée donc un support aujourd'hui ;
    // c'est un manque constaté, pas une permission implicite.
    const out = buildCommand({
      ...BASE, operation: 'create', module: '02-wayfinding', before: null,
      after: { id: 'sup-1', org_id: 'org-1', site_id: 's-1', node_id: 'n-1', kind: 'totem' },
    });
    expect(out.ok).toBe(false);
  });
});
