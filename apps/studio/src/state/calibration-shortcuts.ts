/**
 * M2 (partie M) — les raccourcis de l'écran d'import et de calage.
 *
 * E16 veut que la table des raccourcis soit une donnée, et non des `if` semés
 * dans les gestionnaires d'événements. Celle-ci est propre à l'écran, pour
 * deux raisons qui sont des faits et non des préférences :
 *
 *  · `Échap` vaut « désélectionner » dans la table de l'éditeur, et « annuler
 *    le point en cours » ici. Le même signe, deux actions : les mettre dans
 *    une table unique produirait une collision, que le contrôle de conflits
 *    signalerait à juste titre.
 *  · `0` ajuste à la fenêtre ici, sans modificateur, là où la table de
 *    l'éditeur demande `Ctrl+0`. C'est M2 (partie M) qui fait foi sur cet
 *    écran.
 *
 * Deux gestes de M2 (partie M) ne figurent pas ici parce qu'ils ne sont pas des
 * raccourcis discrets : « Espace maintenu » est un mode tenu tant que la
 * touche est enfoncée, et « Molette » n'est pas une touche.
 */
import type { UiMessageKey } from '../i18n/messages.js';

export type CalibrationShortcut = {
  readonly action: 'zoom_fit' | 'next_step' | 'cancel_point';
  readonly key: string;
  readonly labelKey: UiMessageKey;
};

export const CALIBRATION_SHORTCUTS: readonly CalibrationShortcut[] = [
  { action: 'zoom_fit', key: '0', labelKey: 'calib.shortcut.zoom_fit' },
  { action: 'next_step', key: 'Enter', labelKey: 'calib.shortcut.next_step' },
  { action: 'cancel_point', key: 'Escape', labelKey: 'calib.shortcut.cancel_point' },
];

/** Les modes tenus, que M2 (partie M) nomme et qui ne sont pas des raccourcis discrets. */
export const CALIBRATION_HELD_MODES = [
  { action: 'pan', key: ' ', labelKey: 'calib.mode.pan' },
] as const;

/**
 * L'action d'une touche, ou `null`. Aucun modificateur n'est admis : M2 (partie M) n'en
 * donne aucun, et accepter `Ctrl+0` par indulgence ferait diverger l'écran de
 * sa spécification sans que personne ne s'en aperçoive.
 */
export function actionForKey(
  key: string,
  modifiers: { readonly ctrl: boolean; readonly shift: boolean; readonly alt: boolean; readonly meta: boolean },
): CalibrationShortcut['action'] | null {
  if (modifiers.ctrl || modifiers.shift || modifiers.alt || modifiers.meta) return null;
  return CALIBRATION_SHORTCUTS.find(s => s.key === key)?.action ?? null;
}
