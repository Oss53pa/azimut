import type { UiMessageKey } from '../../i18n/messages.js';

const PHASE_KEYS = {
  'budget.phase.interior': 'budget.phase.interior',
  'budget.phase.parking': 'budget.phase.parking',
  'budget.phase.wall_plans': 'budget.phase.wall_plans',
  'budget.phase.cell_turnover': 'budget.phase.cell_turnover',
} as const satisfies Readonly<Record<string, UiMessageKey>>;

type PhaseKey = keyof typeof PHASE_KEYS;

/** La clé de libellé d'une phase de budget ; une phase inconnue retombe sur l'intérieur. */
export function phaseKey(key: string): PhaseKey {
  return key in PHASE_KEYS ? (key as PhaseKey) : 'budget.phase.interior';
}
