import { type JSX } from 'react';
import type { WayfindingRegistryState } from '../../context/site-wayfinding.js';
import { useI18n } from '../../i18n/useI18n.js';
import { StateBanner, SPACE } from '../../components/ui/index.js';

type RegistryBannerProps = {
  readonly state: WayfindingRegistryState;
  /** Vrai quand ce que l'écran lit du registre est vide. */
  readonly empty: boolean;
  readonly emptyMessage: string;
};

/**
 * L'état du registre du wayfinding, dit avant l'écran qui le lit. Un registre
 * illisible et un registre vide ne se confondent pas : le premier bloque,
 * le second informe.
 */
export function RegistryBanner({ state, empty, emptyMessage }: RegistryBannerProps): JSX.Element | null {
  const { t } = useI18n();
  const banner = state.status === 'failed'
    ? <StateBanner severity="blocking" message={t('wfregistry.failed')} hint={t('wfregistry.failed.hint')} />
    : state.status === 'loading'
      ? <StateBanner severity="info" message={t('wfregistry.loading')} />
      : empty
        ? <StateBanner severity="info" message={emptyMessage} hint={t('wfregistry.empty.hint')} />
        : null;
  return banner === null ? null : <div style={{ marginBottom: SPACE.lg }}>{banner}</div>;
}
