import type { UiMessageKey } from '../../i18n/messages.js';

const PHASE_KEYS = {
  'budget.phase.interior': 'budget.phase.interior',
  'budget.phase.parking': 'budget.phase.parking',
  'budget.phase.wall_plans': 'budget.phase.wall_plans',
  'budget.phase.cell_turnover': 'budget.phase.cell_turnover',
} as const satisfies Readonly<Record<string, UiMessageKey>>;

type PhaseKey = keyof typeof PHASE_KEYS;

/**
 * La clé de libellé d'une phase de budget, ou `null` : une phase que
 * l'interface ne connaît pas s'affiche telle quelle, elle ne prend pas le nom
 * d'une autre.
 */
export function phaseKey(key: string): PhaseKey | null {
  return key in PHASE_KEYS ? (key as PhaseKey) : null;
}
