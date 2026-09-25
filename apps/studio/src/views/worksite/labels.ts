import type { UiMessageKey } from '../../i18n/messages.js';
import type { FabricationLotState as LotState } from '@azimut/core-model';
import type { Severity } from '../../components/ui/index.js';

export const LOT_STATE_KEYS: Readonly<Record<LotState, UiMessageKey>> = {
  ordered: 'worksite.lot.ordered',
  in_production: 'worksite.lot.inproduction',
  delivered: 'worksite.lot.delivered',
  installed: 'worksite.lot.installed',
};

export const LOT_STATE_SEVERITY: Readonly<Record<LotState, Severity>> = {
  ordered: 'info',
  in_production: 'warning',
  delivered: 'valid',
  installed: 'valid',
};

/** Constats de pose que l'interface sait nommer. */
const OBSERVATION_KEYS: ReadonlySet<string> = new Set([
  'worksite.observation.fixing',
  'worksite.observation.scratch',
  'worksite.observation.plumb',
  'worksite.observation.lamp',
] satisfies readonly UiMessageKey[]);

/**
 * La clé de constat traduisible, ou `null` : une clé que l'interface ne
 * connaît pas s'affiche telle quelle, elle ne prend pas le nom d'une autre.
 */
export function observationKey(key: string): UiMessageKey | null {
  return OBSERVATION_KEYS.has(key) ? (key as UiMessageKey) : null;
}
