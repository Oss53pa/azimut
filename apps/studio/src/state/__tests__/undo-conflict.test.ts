import { describe, it, expect } from 'vitest';
import type { EntityCommand } from '@azimut/core-model';
import { comparable, isStaleRefusal, locateConflict } from '../undo-conflict.js';
import type { SessionState } from '../session-store.js';

/**
 * S6.8, décision Q3 — situer le conflit d'une annulation que la base a
 * refusée, sur le site relu, par le moteur S6.3.
 */
const ORG = 'org-1';
const NODE = 'node-1';
const T = '2026-11-25T10:00:00.000Z';

const relu = (values: Record<string, unknown>): SessionState => ({
  rows: [{ table: 'node', id: NODE, values: { id: NODE, org_id: ORG, ...values } }],
  queued: [],
  online: true,
});

function update(before: Record<string, string | null>, after: Record<string, string | null>): EntityCommand {
  return {
    operation: 'update', module: '01-socle', table: 'node', id: NODE, org_id: ORG,
    before, after, timestamp: T, groupKey: null,
  };
}

describe('S6.8 — la forme commune des valeurs', () => {
  it('ramène un texte de commande et une valeur relue à la même forme', () => {
    expect(comparable('{"y_m":2,"x_m":1}')).toBe(comparable({ x_m: 1, y_m: 2 }));
    expect(comparable('1.40')).toBe(comparable(1.4));
    expect(comparable('2026-11-25T10:00:00.000Z')).toBe(comparable('2026-11-25T11:00:00+01:00'));
    expect(comparable('true')).toBe(comparable(true));
  });

  it('garde distinctes deux valeurs différentes', () => {
    expect(comparable('{"x_m":1,"y_m":2}')).not.toBe(comparable({ x_m: 1, y_m: 3 }));
    expect(comparable('Hall')).not.toBe(comparable('Accueil'));
    expect(comparable(null)).toBeNull();
    expect(comparable('')).toBe('');
  });
});

describe('S6.8 — le conflit situé sur le site relu', () => {
  const position = { x_m: 1, y_m: 2 };

  it('nomme la seule colonne changée ailleurs, sans faux écart de forme', () => {
    const inverse = update(
      { kind: 'junction', label: 'Hall', position: '{"x_m":1,"y_m":2}' },
      { kind: 'junction', label: 'Entrée', position: '{"x_m":0,"y_m":0}' },
    );
    const conflict = locateConflict(relu({ kind: 'junction', label: 'Accueil', position }), 'undo', [inverse]);
    expect(conflict).toEqual({
      side: 'undo', reason: 'row_changed', table: 'node', id: NODE,
      columns: [{ column: 'label', current: 'Accueil', wanted: 'Entrée' }],
    });
  });

  it('dit l’objet supprimé ailleurs', () => {
    const inverse = update({ label: 'Hall' }, { label: 'Entrée' });
    const conflict = locateConflict({ rows: [], queued: [], online: true }, 'redo', [inverse]);
    expect(conflict.reason).toBe('row_missing');
    expect(conflict.side).toBe('redo');
    expect(conflict.columns.map(c => c.column)).toEqual(['label']);
  });

  it('rejoue les commandes dans l’ordre : la seconde voit l’effet de la première', () => {
    const first = update({ label: 'Hall' }, { label: 'Entrée' });
    const second = update({ label: 'Entrée' }, { label: 'Porte' });
    expect(locateConflict(relu({ label: 'Hall', position }), 'undo', [first, second]).reason).toBe('unlocated');
    const third = update({ label: 'Hall' }, { label: 'Sas' });
    const conflict = locateConflict(relu({ label: 'Hall', position }), 'undo', [first, third]);
    expect(conflict.columns).toEqual([{ column: 'label', current: 'Hall', wanted: 'Sas' }]);
  });

  it('ne situe rien quand tout s’applique sur le site relu', () => {
    const inverse = update({ position: '{"x_m":1,"y_m":2}' }, { position: '{"x_m":0,"y_m":0}' });
    expect(locateConflict(relu({ position }), 'undo', [inverse])).toEqual({
      side: 'undo', reason: 'unlocated', table: null, id: null, columns: [],
    });
    expect(locateConflict(relu({ position }), 'undo', []).reason).toBe('unlocated');
  });

  it('reconnaît le refus d’un objet changé ailleurs à sa cause', () => {
    expect(isStaleRefusal([{ params: { cause: '409' } }])).toBe(true);
    expect(isStaleRefusal([{ params: { cause: '403' } }])).toBe(false);
  });
});
