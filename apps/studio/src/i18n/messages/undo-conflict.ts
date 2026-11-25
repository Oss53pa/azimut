/**
 * S6.8, décision Q3 — l'annulation refusée parce que l'objet a changé
 * ailleurs.
 *
 * Fragment du catalogue. La table française porte le jeu de clés ;
 * la table anglaise est typée contre elle, une traduction manquante
 * ne compile pas.
 */
export const UNDO_CONFLICT_FR = {
  'undo.conflict.undo': 'Annulation refusée : l’objet {table} {id} a changé sur un autre poste depuis votre geste.',
  'undo.conflict.redo': 'Rétablissement refusé : l’objet {table} {id} a changé sur un autre poste depuis l’annulation.',
  'undo.conflict.row_missing': 'Il a été supprimé ailleurs.',
  'undo.conflict.row_exists': 'Il existe de nouveau, recréé ailleurs.',
  'undo.conflict.row_changed': 'Les deux versions, colonne par colonne :',
  'undo.conflict.unlocated': 'La base a refusé l’écriture, mais le site relu ne dit pas quel objet a changé : une ligne liée a pu être écrite ailleurs.',
  'undo.conflict.unlocated.title': 'Annulation ou rétablissement refusé : le site a changé sur un autre poste.',
  'undo.conflict.column': 'Colonne',
  'undo.conflict.current': 'Version actuelle',
  'undo.conflict.wanted': 'Ce que votre geste écrirait',
  'undo.conflict.hint': 'Rien n’a été écrit, et le geste reste dans la pile. L’écarter rend les gestes précédents à l’annulation.',
  'undo.conflict.discard': 'Écarter ce geste',
  'undo.conflict.dismiss': 'Fermer',
} as const;

export const UNDO_CONFLICT_EN: Readonly<Record<keyof typeof UNDO_CONFLICT_FR, string>> = {
  'undo.conflict.undo': 'Undo refused: object {table} {id} changed on another workstation since your action.',
  'undo.conflict.redo': 'Redo refused: object {table} {id} changed on another workstation since the undo.',
  'undo.conflict.row_missing': 'It was deleted elsewhere.',
  'undo.conflict.row_exists': 'It exists again, recreated elsewhere.',
  'undo.conflict.row_changed': 'Both versions, column by column:',
  'undo.conflict.unlocated': 'The database refused the write, but the reloaded site does not show which object changed: a linked row may have been written elsewhere.',
  'undo.conflict.unlocated.title': 'Undo or redo refused: the site changed on another workstation.',
  'undo.conflict.column': 'Column',
  'undo.conflict.current': 'Current version',
  'undo.conflict.wanted': 'What your action would write',
  'undo.conflict.hint': 'Nothing was written, and the action stays in the stack. Discarding it makes the previous actions undoable.',
  'undo.conflict.discard': 'Discard this action',
  'undo.conflict.dismiss': 'Close',
};
