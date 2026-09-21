import { describe, it, expect } from 'vitest';
import {
  FOOTPRINT_SHORTCUTS, FOOTPRINT_TOOLS, actionForKey, toolForKey, nudge,
  NUDGE_STEP_M, NUDGE_COARSE_STEP_M,
} from '../footprint-shortcuts.js';
import type { Point } from '@azimut/core-model';

const NONE = { ctrl: false, shift: false, alt: false };
const SQUARE: readonly Point[] = [
  { x_m: 0, y_m: 0 }, { x_m: 3, y_m: 0 }, { x_m: 3, y_m: 4 }, { x_m: 0, y_m: 4 },
];

/** M3 (partie M) — outils et raccourcis. */
describe('M3 (partie M) — outils', () => {
  it('les cinq outils sont ceux de M3 (partie M), avec leurs touches', () => {
    expect(FOOTPRINT_TOOLS.map(t => t.key)).toEqual(['V', 'C', 'P', 'R', 'A']);
  });

  it('reconnaît la touche d’un outil, quelle que soit sa casse', () => {
    expect(toolForKey('c')).toBe('cell');
    expect(toolForKey('C')).toBe('cell');
    expect(toolForKey('q')).toBeNull();
  });
});

describe('M3 (partie M) — raccourcis', () => {
  it('porte les cinq raccourcis de M3 (partie M)', () => {
    expect(FOOTPRINT_SHORTCUTS.map(s => s.key))
      .toEqual(['Enter', 'Escape', 'Backspace', 'z', 'd']);
  });

  it('associe chaque touche à son action', () => {
    expect(actionForKey('Enter', NONE)).toBe('close_polygon');
    expect(actionForKey('Escape', NONE)).toBe('abandon_drawing');
    expect(actionForKey('Backspace', NONE)).toBe('remove_last_vertex');
    expect(actionForKey('z', { ...NONE, ctrl: true })).toBe('undo');
    expect(actionForKey('d', { ...NONE, ctrl: true })).toBe('duplicate');
  });

  it('distingue `z` de `Ctrl+Z`', () => {
    expect(actionForKey('z', NONE)).toBeNull();
    expect(actionForKey('Enter', { ...NONE, ctrl: true })).toBeNull();
  });

  /**
   * Maj ne change aucune de ces actions. L'accepter en silence masquerait une
   * frappe que l'opérateur croyait différente.
   */
  it('n’accepte pas Maj sur une action qui ne le prévoit pas', () => {
    expect(actionForKey('Enter', { ...NONE, shift: true })).toBeNull();
  });
});

/**
 * E6.2 — « Déplacement de l'objet sélectionné par touches directionnelles,
 * pas de 0,01 m, pas augmenté avec la touche de modification. » M3 (partie M)
 * donne les deux valeurs.
 */
describe('M3 (partie M) — déplacement au clavier', () => {
  it('les deux pas sont ceux de M3 (partie M)', () => {
    expect(NUDGE_STEP_M).toBe(0.01);
    expect(NUDGE_COARSE_STEP_M).toBe(0.10);
  });

  it('déplace d’un centimètre', () => {
    expect(nudge(SQUARE, 'right', false)[0]).toEqual({ x_m: 0.01, y_m: 0 });
  });

  it('déplace de dix centimètres avec Maj', () => {
    expect(nudge(SQUARE, 'right', true)[0]).toEqual({ x_m: 0.1, y_m: 0 });
  });

  /** Y croît vers le nord (D1.1) : la flèche haute augmente y. */
  it('la flèche haute va vers le nord', () => {
    expect(nudge(SQUARE, 'up', false)[0]).toEqual({ x_m: 0, y_m: 0.01 });
    expect(nudge(SQUARE, 'down', false)[0]).toEqual({ x_m: 0, y_m: -0.01 });
  });

  /**
   * Dix pas de 0,01 m valent exactement dix centimètres, et non
   * 0,09999999999999999 : la quantification à chaque pas l'assure.
   */
  it('dix pas valent exactement dix centimètres', () => {
    let moved = SQUARE;
    for (let i = 0; i < 10; i += 1) moved = nudge(moved, 'right', false);
    expect(moved[0]?.x_m).toBe(0.1);
  });

  it('cent pas ne dérivent pas', () => {
    let moved = SQUARE;
    for (let i = 0; i < 100; i += 1) moved = nudge(moved, 'up', false);
    expect(moved[0]?.y_m).toBe(1);
  });
});
