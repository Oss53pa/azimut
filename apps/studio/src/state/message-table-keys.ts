/**
 * R15 (partie R) — les raccourcis du tableau des messages.
 *
 * Table déclarée en donnée, comme E16 l'exige : « Table de raccourcis unique,
 * déclarée en donnée, jamais dispersée dans les composants. »
 *
 * R15 : « Aucun raccourci ne modifie un contenu, conformément à la section
 * R8. » Aucune des actions ci-dessous n'écrit : elles déplacent le focus,
 * étendent une sélection, ouvrent un panneau ou placent le curseur dans la
 * recherche.
 *
 * `A`, annoter, ne figure pas : l'annotation écrit, et la moitié consultation
 * de l'écran ne l'offre pas. Le raccourci reste libre pour elle.
 */
export const MESSAGE_TABLE_ACTIONS = [
  'previous', 'next', 'toggle_select', 'extend_previous', 'extend_next',
  'open_detail', 'escape', 'focus_search', 'next_issue',
] as const;

export type MessageTableAction = (typeof MESSAGE_TABLE_ACTIONS)[number];

export type ShortcutBinding = {
  readonly action: MessageTableAction;
  readonly key: string;
  readonly shift: boolean;
};

export const MESSAGE_TABLE_SHORTCUTS: readonly ShortcutBinding[] = [
  { action: 'previous', key: 'ArrowUp', shift: false },
  { action: 'next', key: 'ArrowDown', shift: false },
  { action: 'extend_previous', key: 'ArrowUp', shift: true },
  { action: 'extend_next', key: 'ArrowDown', shift: true },
  { action: 'toggle_select', key: ' ', shift: false },
  { action: 'open_detail', key: 'Enter', shift: false },
  { action: 'escape', key: 'Escape', shift: false },
  { action: 'focus_search', key: '/', shift: false },
  { action: 'next_issue', key: 'n', shift: false },
];

/**
 * L'action d'un appui, ou `null`.
 *
 * Les touches de modification du système — `Ctrl`, `Alt`, `Meta` — laissent
 * passer : E16 demande que les raccourcis du navigateur et du système ne
 * soient pas capturés.
 */
export function actionOfKey(event: {
  readonly key: string;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
}): MessageTableAction | null {
  if (event.ctrlKey || event.altKey || event.metaKey) return null;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const found = MESSAGE_TABLE_SHORTCUTS.find(
    binding => binding.key === key && binding.shift === event.shiftKey,
  );
  return found?.action ?? null;
}
