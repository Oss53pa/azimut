/**
 * R15 et R17 (partie R) — le focus et la sélection du tableau, séparés.
 *
 * R17 : « Indicateur de focus sur la ligne, distinct de l'indicateur de
 * sélection. » Ce sont donc deux états distincts et non un seul : une ligne
 * peut être focalisée sans être sélectionnée, et l'inverse.
 *
 * Module pur, sans React : le parcours complet au clavier, critère 12 de R18,
 * s'éprouve ici sans rendre un seul composant.
 */
import type { MessageTableAction } from './message-table-keys.js';

export type TableSelection = {
  /** La ligne sous le focus, par son identifiant stable. */
  readonly focusedId: string | null;
  readonly selectedIds: readonly string[];
  /** R3 (partie R) — le panneau de détail est repliable. */
  readonly detailOpen: boolean;
  /** R15 — « `/` place le focus dans la recherche ». */
  readonly searchFocused: boolean;
};

export const NO_SELECTION: TableSelection = {
  focusedId: null,
  selectedIds: [],
  detailOpen: false,
  searchFocused: false,
};

export type SelectionContext = {
  /** Les lignes visibles, dans l'ordre où le tableau les montre. */
  readonly visibleIds: readonly string[];
  /** R15 — « `N` va à la prochaine ligne périmée ou en anomalie ». */
  readonly issueIds: readonly string[];
};

/**
 * Applique une action de R15. Ne modifie jamais un contenu : R15 le dit, et
 * ce module n'a aucun moyen d'en modifier un.
 */
export function applyAction(
  state: TableSelection,
  action: MessageTableAction,
  context: SelectionContext,
): TableSelection {
  switch (action) {
    case 'previous':
      return moveFocus(state, context, -1);
    case 'next':
      return moveFocus(state, context, +1);
    case 'extend_previous':
      return extend(state, context, -1);
    case 'extend_next':
      return extend(state, context, +1);
    case 'toggle_select':
      return toggle(state);
    case 'open_detail':
      return state.focusedId === null ? state : { ...state, detailOpen: true };
    case 'escape':
      return escape(state);
    case 'focus_search':
      return { ...state, searchFocused: true };
    case 'next_issue':
      return nextIssue(state, context);
  }
}

function indexOfFocus(state: TableSelection, context: SelectionContext): number {
  if (state.focusedId === null) return -1;
  return context.visibleIds.indexOf(state.focusedId);
}

function moveFocus(
  state: TableSelection,
  context: SelectionContext,
  step: number,
): TableSelection {
  const ids = context.visibleIds;
  if (ids.length === 0) return state;

  const current = indexOfFocus(state, context);
  // Sans focus, la première flèche prend la première ligne, quelle que soit
  // sa direction : il n'y a rien avant la première.
  const next = current < 0 ? 0 : clamp(current + step, ids.length);
  return { ...state, focusedId: ids[next] ?? null, searchFocused: false };
}

/**
 * R15 : « `Maj` + flèches étend la sélection. »
 *
 * La ligne d'arrivée entre dans la sélection, et la ligne de départ y reste :
 * c'est ce qui distingue l'extension du simple déplacement.
 */
function extend(
  state: TableSelection,
  context: SelectionContext,
  step: number,
): TableSelection {
  const moved = moveFocus(state, context, step);
  if (moved.focusedId === null) return moved;

  const selected = new Set(state.selectedIds);
  if (state.focusedId !== null) selected.add(state.focusedId);
  selected.add(moved.focusedId);

  return {
    ...moved,
    selectedIds: context.visibleIds.filter(id => selected.has(id)),
  };
}

/** R15 : « `Espace` ajoute la ligne à la sélection ou l'en retire. » */
function toggle(state: TableSelection): TableSelection {
  if (state.focusedId === null) return state;
  const focused = state.focusedId;
  const selected = state.selectedIds.includes(focused)
    ? state.selectedIds.filter(id => id !== focused)
    : [...state.selectedIds, focused];
  return { ...state, selectedIds: selected };
}

/**
 * R15 : « `Échap` ferme le détail, **puis** vide la sélection. »
 *
 * Deux appuis, deux effets : un seul qui ferait les deux ferait perdre une
 * sélection construite ligne à ligne à qui voulait seulement replier le
 * panneau.
 */
function escape(state: TableSelection): TableSelection {
  if (state.searchFocused) return { ...state, searchFocused: false };
  if (state.detailOpen) return { ...state, detailOpen: false };
  return { ...state, selectedIds: [] };
}

function nextIssue(state: TableSelection, context: SelectionContext): TableSelection {
  const issues = context.visibleIds.filter(id => context.issueIds.includes(id));
  if (issues.length === 0) return state;

  const current = indexOfFocus(state, context);
  const after = issues.find(id => context.visibleIds.indexOf(id) > current);
  // Le parcours boucle : arrivé à la dernière anomalie, `N` revient à la
  // première plutôt que de ne rien faire, ce qui se lirait comme une panne.
  return { ...state, focusedId: after ?? issues[0] ?? null, searchFocused: false };
}

function clamp(index: number, length: number): number {
  if (index < 0) return 0;
  if (index >= length) return length - 1;
  return index;
}
