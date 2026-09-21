/**
 * M3 (partie M) — raccourcis du tracé des empreintes, et déplacement au
 * clavier.
 *
 * E16 veut la table en donnée. Comme pour M2 (partie M), elle est propre à
 * l'écran : `Entrée` ferme le polygone ici et n'a pas d'emploi dans la table
 * de l'éditeur, et `Retour arrière` supprime le dernier sommet et non l'objet
 * sélectionné.
 *
 * E6.2 : « Déplacement de l'objet sélectionné par touches directionnelles, pas
 * de 0,01 m, pas augmenté avec la touche de modification. » M3 (partie M) donne les deux
 * valeurs : 0,01 m, et 0,10 m avec Maj.
 */
import type { Point } from '@azimut/core-model';
import { quantizePoint } from '@azimut/core-model';
import type { UiMessageKey } from '../i18n/messages.js';

/** M3 (partie M) : « Flèches | Déplacer la sélection de 0,01 m ». */
export const NUDGE_STEP_M = 0.01;
/** M3 (partie M) : « Maj + flèches | Déplacer de 0,10 m ». */
export const NUDGE_COARSE_STEP_M = 0.10;

export type FootprintAction =
  | 'close_polygon' | 'abandon_drawing' | 'remove_last_vertex'
  | 'undo' | 'duplicate';

export type FootprintShortcut = {
  readonly action: FootprintAction;
  readonly key: string;
  readonly ctrl: boolean;
  readonly labelKey: UiMessageKey;
};

export const FOOTPRINT_SHORTCUTS: readonly FootprintShortcut[] = [
  { action: 'close_polygon', key: 'Enter', ctrl: false, labelKey: 'fp.shortcut.close' },
  { action: 'abandon_drawing', key: 'Escape', ctrl: false, labelKey: 'fp.shortcut.abandon' },
  { action: 'remove_last_vertex', key: 'Backspace', ctrl: false, labelKey: 'fp.shortcut.remove_vertex' },
  { action: 'undo', key: 'z', ctrl: true, labelKey: 'fp.shortcut.undo' },
  { action: 'duplicate', key: 'd', ctrl: true, labelKey: 'fp.shortcut.duplicate' },
];

/** M3 (partie M) : les cinq outils, et leur touche. */
export const FOOTPRINT_TOOLS = [
  { tool: 'select', key: 'V', labelKey: 'fp.tool.select' },
  { tool: 'cell', key: 'C', labelKey: 'fp.tool.cell' },
  { tool: 'free_polygon', key: 'P', labelKey: 'fp.tool.free_polygon' },
  { tool: 'rectangle', key: 'R', labelKey: 'fp.tool.rectangle' },
  { tool: 'vertex', key: 'A', labelKey: 'fp.tool.vertex' },
] as const;

export type FootprintTool = (typeof FOOTPRINT_TOOLS)[number]['tool'];

export function actionForKey(
  key: string,
  modifiers: { readonly ctrl: boolean; readonly shift: boolean; readonly alt: boolean },
): FootprintAction | null {
  if (modifiers.alt) return null;
  const found = FOOTPRINT_SHORTCUTS.find(s => s.key === key && s.ctrl === modifiers.ctrl);
  // Maj ne change aucune de ces actions ; l'accepter en silence masquerait une
  // frappe que l'opérateur croyait différente.
  return found === undefined || modifiers.shift ? null : found.action;
}

export function toolForKey(key: string): FootprintTool | null {
  return FOOTPRINT_TOOLS.find(t => t.key === key.toUpperCase())?.tool ?? null;
}

/**
 * Déplace un contour au clavier.
 *
 * Le déplacement est quantifié comme tout geste (E4), et le pas de 0,01 m est
 * un multiple exact du millimètre : dix pas valent donc exactement dix
 * centimètres, et non 0,09999999999999999.
 */
export function nudge(
  vertices: readonly Point[],
  direction: 'up' | 'down' | 'left' | 'right',
  coarse: boolean,
): readonly Point[] {
  const step = coarse ? NUDGE_COARSE_STEP_M : NUDGE_STEP_M;
  const dx = direction === 'left' ? -step : direction === 'right' ? step : 0;
  // Y croît vers le nord (D1.1) : la flèche haute augmente y.
  const dy = direction === 'down' ? -step : direction === 'up' ? step : 0;
  return vertices.map(v => quantizePoint({ x_m: v.x_m + dx, y_m: v.y_m + dy }));
}
