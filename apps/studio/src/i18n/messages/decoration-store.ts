/**
 * S6.1c — l'habillage écrit dans le dépôt, et ce que l'éditeur en dit.
 *
 * Fragment du catalogue. La table française porte le jeu de clés ;
 * la table anglaise est typée contre elle, une traduction manquante
 * ne compile pas.
 */
export const DECORATION_STORE_FR = {
  'decoration.load.failed': 'L’habillage de ce site n’a pas pu être relu au dépôt : ce qui s’affiche peut ne pas être à jour.',
  'decoration.unreadable': '{count} ligne(s) d’habillage du dépôt ne se lisent pas, et ne sont pas affichées.',
  'decoration.refused.stale': 'Geste refusé : l’habillage a changé sur un autre poste. Il a été relu ; rien n’a été écrit, et le geste reste à refaire ou à annuler.',
} as const;

export const DECORATION_STORE_EN: Readonly<Record<keyof typeof DECORATION_STORE_FR, string>> = {
  'decoration.load.failed': 'This site’s habillage could not be reloaded from the repository: what is shown may be out of date.',
  'decoration.unreadable': '{count} habillage row(s) in the repository cannot be read, and are not shown.',
  'decoration.refused.stale': 'Action refused: the habillage changed on another workstation. It was reloaded; nothing was written, and the action can be redone or undone.',
};
