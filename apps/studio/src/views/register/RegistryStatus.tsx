import { type JSX } from 'react';
import type { RegistryLoad } from '../../data/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { StateBanner, SPACE } from '../../components/ui/index.js';

type RegistryStatusProps = {
  readonly state: Pick<RegistryLoad<unknown>, 'status' | 'demo'>;
};

/**
 * Ce qu'un écran doit dire de sa source avant de montrer quoi que ce soit :
 * une lecture en cours, une lecture échouée (bloquant), ou un jeu de
 * démonstration servi par le dépôt de référence. Rien quand la donnée est
 * réelle et lue.
 */
export function RegistryStatus({ state }: RegistryStatusProps): JSX.Element | null {
  const { t } = useI18n();
  const banner = state.status === 'failed'
    ? <StateBanner severity="blocking" message={t('registry.failed')} hint={t('registry.failed.hint')} />
    : state.status === 'loading'
      ? <StateBanner severity="info" message={t('registry.loading')} />
      : state.demo
        ? <StateBanner severity="info" message={t('demo.dataset.message')} hint={t('demo.reference.hint')} />
        : null;
  return banner === null ? null : <div style={{ marginBottom: SPACE.lg }}>{banner}</div>;
}
