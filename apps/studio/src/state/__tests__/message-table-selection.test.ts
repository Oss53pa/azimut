import { describe, it, expect } from 'vitest';
import { NO_SELECTION, applyAction } from '../message-table-selection.js';
import type { TableSelection } from '../message-table-selection.js';
import { MESSAGE_TABLE_SHORTCUTS, actionOfKey } from '../message-table-keys.js';

/**
 * R15 et R17 (partie R) — le clavier du tableau des messages.
 *
 * Critère 12 de R18 : « Parcours complet au clavier seul, de l'ouverture à
 * l'approbation. » Sa moitié consultation s'éprouve ici sans rendre un seul
 * composant : naviguer, sélectionner, étendre, ouvrir le détail, sauter à
 * l'anomalie suivante, refermer.
 *
 * R15 : « Aucun raccourci ne modifie un contenu. » Aucune des actions de ce
 * module n'a de moyen d'en modifier un ; le contrôle est structurel.
 */

const VISIBLE = ['l-1', 'l-2', 'l-3', 'l-4'];
const CONTEXT = { visibleIds: VISIBLE, issueIds: ['l-3'] };

function after(
  actions: readonly Parameters<typeof applyAction>[1][],
  from: TableSelection = NO_SELECTION,
): TableSelection {
  return actions.reduce((state, action) => applyAction(state, action, CONTEXT), from);
}

describe('R15 (partie R) — la table de raccourcis', () => {
  it('reconnaît chaque appui déclaré', () => {
    for (const binding of MESSAGE_TABLE_SHORTCUTS) {
      const action = actionOfKey({
        key: binding.key, shiftKey: binding.shift,
        ctrlKey: false, altKey: false, metaKey: false,
      });
      expect(action, binding.key).toBe(binding.action);
    }
  });

  /**
   * E16 : les raccourcis du navigateur et du système ne sont pas capturés. Un
   * `Ctrl+N` ouvre une fenêtre, il ne saute pas à l'anomalie suivante.
   */
  it('laisse passer les combinaisons du navigateur et du système', () => {
    for (const modifier of ['ctrlKey', 'altKey', 'metaKey'] as const) {
      const action = actionOfKey({
        key: 'n', shiftKey: false,
        ctrlKey: modifier === 'ctrlKey',
        altKey: modifier === 'altKey',
        metaKey: modifier === 'metaKey',
      });
      expect(action, modifier).toBeNull();
    }
  });

  /** Verrouillage des majuscules : la touche reste celle que R15 nomme. */
  it('ignore la casse d’une touche de lettre', () => {
    expect(actionOfKey({
      key: 'N', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false,
    })).toBe('next_issue');
  });

  it('mais Maj et une lettre n’est pas la lettre seule', () => {
    expect(actionOfKey({
      key: 'N', shiftKey: true, ctrlKey: false, altKey: false, metaKey: false,
    })).toBeNull();
  });

  it('ne reconnaît rien d’autre', () => {
    expect(actionOfKey({
      key: 'Tab', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false,
    })).toBeNull();
  });

  /** R15 : `A`, annoter, écrit. La moitié consultation ne le lie pas. */
  it('n’attribue aucune action à la touche d’annotation', () => {
    expect(actionOfKey({
      key: 'a', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false,
    })).toBeNull();
  });
});

describe('R15 (partie R) — déplacement du focus', () => {
  it('la première flèche prend la première ligne, dans les deux sens', () => {
    expect(after(['next']).focusedId).toBe('l-1');
    expect(after(['previous']).focusedId).toBe('l-1');
  });

  it('les flèches avancent et reculent d’une ligne', () => {
    expect(after(['next', 'next', 'next']).focusedId).toBe('l-3');
    expect(after(['next', 'next', 'next', 'previous']).focusedId).toBe('l-2');
  });

  it('le focus ne sort pas du tableau', () => {
    expect(after(['next', 'next', 'next', 'next', 'next', 'next']).focusedId).toBe('l-4');
    expect(after(['next', 'previous', 'previous']).focusedId).toBe('l-1');
  });

  it('un tableau vide ne prend aucun focus', () => {
    const state = applyAction(NO_SELECTION, 'next', { visibleIds: [], issueIds: [] });
    expect(state.focusedId).toBeNull();
  });
});

describe('R15 (partie R) — sélection', () => {
  it('l’espace ajoute puis retire la ligne sous le focus', () => {
    const added = after(['next', 'toggle_select']);
    expect(added.selectedIds).toEqual(['l-1']);
    expect(applyAction(added, 'toggle_select', CONTEXT).selectedIds).toEqual([]);
  });

  it('sans focus, l’espace ne sélectionne rien', () => {
    expect(after(['toggle_select']).selectedIds).toEqual([]);
  });

  /** R17 : le focus et la sélection sont deux états distincts. */
  it('déplacer le focus ne déplace pas la sélection', () => {
    const state = after(['next', 'toggle_select', 'next']);
    expect(state.focusedId).toBe('l-2');
    expect(state.selectedIds).toEqual(['l-1']);
  });

  it('Maj et flèche étendent la sélection de proche en proche', () => {
    const state = after(['next', 'extend_next', 'extend_next']);
    expect(state.focusedId).toBe('l-3');
    expect(state.selectedIds).toEqual(['l-1', 'l-2', 'l-3']);
  });

  it('la sélection étendue suit l’ordre du tableau, pas celui des appuis', () => {
    const state = after(['next', 'next', 'next', 'extend_previous', 'extend_previous']);
    expect(state.selectedIds).toEqual(['l-1', 'l-2', 'l-3']);
  });
});

describe('R15 (partie R) — détail, recherche, anomalies', () => {
  it('Entrée ouvre le détail de la ligne sous le focus', () => {
    expect(after(['next', 'open_detail']).detailOpen).toBe(true);
  });

  it('sans focus, Entrée n’ouvre rien', () => {
    expect(after(['open_detail']).detailOpen).toBe(false);
  });

  /**
   * R15 : « `Échap` ferme le détail, **puis** vide la sélection. » Deux
   * appuis, deux effets.
   */
  it('Échap ferme d’abord le détail, et vide la sélection au second appui', () => {
    const open = after(['next', 'toggle_select', 'open_detail']);
    const once = applyAction(open, 'escape', CONTEXT);
    expect(once.detailOpen).toBe(false);
    expect(once.selectedIds).toEqual(['l-1']);

    const twice = applyAction(once, 'escape', CONTEXT);
    expect(twice.selectedIds).toEqual([]);
  });

  it('la barre oblique place le focus dans la recherche, Échap l’en retire', () => {
    const searching = after(['focus_search']);
    expect(searching.searchFocused).toBe(true);
    expect(applyAction(searching, 'escape', CONTEXT).searchFocused).toBe(false);
  });

  it('N saute à la prochaine ligne périmée ou en anomalie', () => {
    expect(after(['next_issue']).focusedId).toBe('l-3');
  });

  it('N boucle plutôt que de ne rien faire à la dernière', () => {
    const state = after(['next', 'next', 'next', 'next', 'next_issue']);
    expect(state.focusedId).toBe('l-3');
  });

  it('sans anomalie, N ne déplace rien', () => {
    const state = applyAction(
      { ...NO_SELECTION, focusedId: 'l-2' },
      'next_issue',
      { visibleIds: VISIBLE, issueIds: [] },
    );
    expect(state.focusedId).toBe('l-2');
  });
});
