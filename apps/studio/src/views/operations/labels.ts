import type { UiMessageKey } from '../../i18n/messages.js';

const NATURE_KEYS = {
  'operations.nature.lamp_out': 'operations.nature.lamp_out',
  'operations.nature.soiled': 'operations.nature.soiled',
  'operations.nature.fixing': 'operations.nature.fixing',
  'operations.nature.content_diverges': 'operations.nature.content_diverges',
} as const satisfies Readonly<Record<string, UiMessageKey>>;

type NatureKey = keyof typeof NATURE_KEYS;

/**
 * La clé de libellé d'une nature de constat, ou `null` : une nature que
 * l'interface ne connaît pas s'affiche telle quelle, elle ne prend pas le nom
 * d'une autre.
 */
export function natureKey(key: string): NatureKey | null {
  return key in NATURE_KEYS ? (key as NatureKey) : null;
}
