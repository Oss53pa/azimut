import { describe, it, expect } from 'vitest';
import { CALIBRATION_SHORTCUTS, CALIBRATION_HELD_MODES, actionForKey } from '../calibration-shortcuts.js';
import { DEFAULT_SHORTCUTS } from '../../editor/shortcuts.js';

const NONE = { ctrl: false, shift: false, alt: false, meta: false };

/**
 * M2 (partie M), raccourcis — et E16, qui veut que la table soit une donnée.
 */
describe('M2 (partie M) — raccourcis du calage', () => {
  it('porte les trois raccourcis discrets que M2 (partie M) nomme', () => {
    expect(CALIBRATION_SHORTCUTS.map(s => s.key)).toEqual(['0', 'Enter', 'Escape']);
  });

  it('nomme « espace maintenu » comme un mode tenu, non comme un raccourci', () => {
    expect(CALIBRATION_HELD_MODES.map(m => m.key)).toEqual([' ']);
  });

  it('associe chaque touche à son action', () => {
    expect(actionForKey('0', NONE)).toBe('zoom_fit');
    expect(actionForKey('Enter', NONE)).toBe('next_step');
    expect(actionForKey('Escape', NONE)).toBe('cancel_point');
  });

  it('ignore une touche que M2 (partie M) ne donne pas', () => {
    expect(actionForKey('k', NONE)).toBeNull();
  });

  /**
   * M2 (partie M) ne donne aucun modificateur. Accepter `Ctrl+0` par indulgence ferait
   * diverger l'écran de sa spécification sans que personne ne s'en aperçoive,
   * et masquerait justement la divergence relevée ci-dessous.
   */
  it('n’accepte aucun modificateur', () => {
    expect(actionForKey('0', { ...NONE, ctrl: true })).toBeNull();
    expect(actionForKey('Enter', { ...NONE, shift: true })).toBeNull();
  });

  it('aucune collision à l’intérieur de la table', () => {
    const keys = CALIBRATION_SHORTCUTS.map(s => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  /**
   * La table est propre à l'écran, et ce n'est pas un choix de confort : deux
   * de ses touches disent autre chose dans la table de l'éditeur. Ce test
   * fige le constat, pour qu'une fusion des deux tables ne se fasse pas par
   * distraction.
   */
  describe('pourquoi cette table est distincte de celle de l’éditeur', () => {
    it('`Échap` vaut « désélectionner » dans l’éditeur', () => {
      const editor = DEFAULT_SHORTCUTS.find(s => s.key === 'Escape');
      expect(editor?.action).toBe('deselect');
      expect(actionForKey('Escape', NONE)).toBe('cancel_point');
    });

    it('`0` ajuste à la fenêtre ici, mais demande Ctrl dans l’éditeur', () => {
      const editor = DEFAULT_SHORTCUTS.find(s => s.action === 'zoom_fit');
      expect(editor?.modifiers.ctrl).toBe(true);
      expect(actionForKey('0', NONE)).toBe('zoom_fit');
    });
  });
});
