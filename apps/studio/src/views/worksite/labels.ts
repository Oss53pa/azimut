import type { UiMessageKey } from '../../i18n/messages.js';
import type { LotState } from '../../domain/demo/production.js';
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
