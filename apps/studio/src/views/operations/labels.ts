import type { UiMessageKey } from '../../i18n/messages.js';

const NATURE_KEYS = {
  'operations.nature.lamp_out': 'operations.nature.lamp_out',
  'operations.nature.soiled': 'operations.nature.soiled',
  'operations.nature.fixing': 'operations.nature.fixing',
  'operations.nature.content_diverges': 'operations.nature.content_diverges',
} as const satisfies Readonly<Record<string, UiMessageKey>>;

type NatureKey = keyof typeof NATURE_KEYS;

/** La clé de libellé d'une nature de constat ; une nature inconnue retombe sur « fixation ». */
export function natureKey(key: string): NatureKey {
  return key in NATURE_KEYS ? (key as NatureKey) : 'operations.nature.fixing';
}
