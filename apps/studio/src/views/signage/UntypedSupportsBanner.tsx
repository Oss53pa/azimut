import { type JSX } from 'react';
import { useI18n } from '../../i18n/useI18n.js';
import { StateBanner, SPACE } from '../../components/ui/index.js';
import { useSiteData } from '../../context/useSiteData.js';
import { untypedSupportCount } from '../../domain/trial-placement.js';

type UntypedSupportsBannerProps = {
  /** Clé de la typologie que l'écran suppose aux supports non rattachés. */
  readonly assumedTypeKey: string;
};

/**
 * A5.6 — un écran qui suppose une typologie aux supports qui n'en portent pas
 * le dit, avec leur nombre. Rien ne s'affiche quand tous sont rattachés.
 */
export function UntypedSupportsBanner({ assumedTypeKey }: UntypedSupportsBannerProps): JSX.Element | null {
  const site = useSiteData();
  const { t } = useI18n();
  const count = untypedSupportCount(site);
  if (count === 0) return null;
  const assumed = site.support_types.find(s => s.key === assumedTypeKey);
  const params = { count, total: site.supports.length };
  return (
    <div style={{ marginBottom: SPACE.lg }}>
      <StateBanner
        severity="warning"
        message={assumed === undefined
          ? t('typology.untyped.notype', params)
          : t('typology.untyped', { ...params, type: assumed.name })}
        hint={t('typology.untyped.hint')}
      />
    </div>
  );
}
