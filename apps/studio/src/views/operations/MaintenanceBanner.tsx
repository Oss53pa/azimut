import { type JSX } from 'react';
import type { MaintenanceRegistryState } from '../../data/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { StateBanner, SPACE } from '../../components/ui/index.js';

type MaintenanceBannerProps = {
  readonly state: MaintenanceRegistryState;
  /** Vrai quand ce que l'écran lit du parc posé est vide. */
  readonly empty: boolean;
  readonly emptyMessage: string;
};

/**
 * L'état du parc posé, dit avant l'écran qui le lit. Un parc illisible
 * bloque ; un parc vide informe.
 */
export function MaintenanceBanner({ state, empty, emptyMessage }: MaintenanceBannerProps): JSX.Element | null {
  const { t } = useI18n();
  const banner = state.status === 'failed'
    ? <StateBanner severity="blocking" message={t('maint.failed')} hint={t('maint.failed.hint')} />
    : state.status === 'loading'
      ? <StateBanner severity="info" message={t('maint.loading')} />
      : empty
        ? <StateBanner severity="info" message={emptyMessage} hint={t('maint.empty.hint')} />
        : null;
  return banner === null ? null : <div style={{ marginBottom: SPACE.lg }}>{banner}</div>;
}
