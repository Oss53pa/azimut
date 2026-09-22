import { type JSX, useCallback, useMemo, useState } from 'react';
import { SitesView } from '../views/SitesView.js';
import { NewSiteDialog } from '../screens/NewSiteDialog.js';
import { StateBanner } from '../components/ui/index.js';
import type { Option } from '../components/ui/index.js';
import { useI18n } from '../i18n/useI18n.js';
import { appRepository, useSiteList } from '../data/index.js';
import { useSiteCreation } from '../state/use-site-creation.js';
import { knownTimezones } from '../state/site-creation.js';
import type { CommandSink } from '../state/command-store.js';
import { ORG_OF_SESSION } from './session-identity.js';

/**
 * M1 (partie M) — la liste des sites, et le formulaire de création monté
 * dessus.
 *
 * Le formulaire existait depuis la tranche M et n'était monté nulle part :
 * `/sites` rendait la liste sans bouton de création. Un écran spécifié au
 * champ près mais inatteignable ne vaut pas mieux qu'un écran absent, et
 * l'essai d'accessibilité de M8 ne pouvait pas l'analyser.
 */
export function SitesAdapter(): JSX.Element {
  const { t } = useI18n();
  const [current, setCurrent] = useState('');
  const repository = useMemo(() => appRepository(), []);
  const { state: list, reload } = useSiteList(repository);

  /**
   * L'émetteur de la création.
   *
   * Le dépôt réel n'est pas câblé sur ce chemin : `appRepository` lit, il
   * n'écrit pas. L'émetteur accepte donc la commande sans l'envoyer, comme le
   * fait la session de l'atelier tant qu'aucun dépôt n'est configuré — c'est
   * le cas hors ligne de M8 (partie M) critère 3, et le refuser rendrait l'écran
   * invérifiable sur un poste nu. Ce que la création produit est rechargé
   * depuis le dépôt, qui reste la source de vérité.
   */
  const sink: CommandSink = useCallback(async () => {
    reload();
    return { ok: true, value: null, warnings: [] };
  }, [reload]);

  // Mémorisée : sans cela le tableau vide de l'état non chargé serait neuf à
  // chaque rendu, et les listes qui en dérivent se recalculeraient sans fin.
  const sites = useMemo(
    () => (list.status === 'ready' ? list.value : []),
    [list],
  );

  const creation = useSiteCreation(sink, {
    orgId: ORG_OF_SESSION,
    newId: () => crypto.randomUUID(),
    now: () => new Date().toISOString(),
    existingNames: sites.map(site => site.name),
    defaultBuildingName: t('sites.create.building.default'),
    defaultLevelName: t('sites.create.level.default'),
  });

  const countries: readonly Option[] = useMemo(() => {
    // Les pays proposés sont ceux que l'organisation exploite déjà. Écrire ici
    // la liste des pays du monde en ferait une donnée du code, et elle
    // vieillirait ; le champ reste saisissable pour un pays nouveau.
    const codes = [...new Set(sites.map(site => site.country_code))].sort();
    return codes.map(code => ({ value: code, label: code }));
  }, [sites]);

  const timezones: readonly Option[] = useMemo(
    () => knownTimezones().map(zone => ({ value: zone, label: zone })),
    [],
  );

  return (
    <div>
      <SitesView
        currentKey={current}
        onOpenSite={setCurrent}
        onCreate={creation.open}
      />

      {creation.state.created !== null && (
        <StateBanner severity="valid" message={t('sites.create.done')} />
      )}

      {creation.state.open && (
        <NewSiteDialog
          countries={countries}
          timezones={timezones}
          // Aucun paquet de règles n'est chargé dans le parcours de la
          // tranche. Le sélecteur est donc vide, et son information dit ce
          // que cela emporte : la composition attendra.
          rulesPacks={[]}
          langs={ACTIVE_LANGS}
          findings={creation.state.findings}
          busy={creation.state.busy}
          onSubmit={draft => { void creation.submit(draft); }}
          onClose={creation.close}
        />
      )}
    </div>
  );
}

/** D12.1 — les deux langues actives. Le site les portera en donnée (N1.2). */
const ACTIVE_LANGS: readonly Option[] = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
];
