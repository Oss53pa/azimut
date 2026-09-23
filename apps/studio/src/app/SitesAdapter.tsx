import { type JSX, useCallback, useMemo, useState } from 'react';
import { SitesView } from '../views/SitesView.js';
import { NewSiteDialog } from '../screens/NewSiteDialog.js';
import type { CountryOption } from '../screens/NewSiteDialog.js';
import { StateBanner } from '../components/ui/index.js';
import type { Option } from '../components/ui/index.js';
import { useI18n } from '../i18n/useI18n.js';
import {
  appRepository, useCountries, useLegalEntities, useSiteList,
} from '../data/index.js';
import type { CountrySummary, LegalEntitySummary } from '../data/index.js';
import { useSiteCreation } from '../state/use-site-creation.js';
import { appSink } from '../state/app-sink.js';
import type { CommandSink } from '../state/command-store.js';
import { ORG_OF_SESSION } from './session-identity.js';

/**
 * M1 (partie M) — la liste des sites, et le formulaire de création monté
 * dessus.
 *
 * Le formulaire existait depuis la tranche M et n'était monté nulle part :
 * `/sites` rendait la liste sans bouton de création. Un écran spécifié au
 * champ près mais inatteignable ne vaut pas mieux qu'un écran absent, et
 * l'essai d'accessibilité de M8 (partie M) ne pouvait pas l'analyser.
 */
export function SitesAdapter(): JSX.Element {
  const { t, lang } = useI18n();
  const [current, setCurrent] = useState('');
  const repository = useMemo(() => appRepository(), []);
  const { state: list, reload } = useSiteList(repository);
  const countryState = useCountries(repository);
  const entityState = useLegalEntities(repository);

  /**
   * L'émetteur de la création.
   *
   * Le chemin d'écriture réel dès que le dépôt est configuré : la commande
   * part vers `apply_commands`, en une transaction, et la liste se recharge
   * depuis le dépôt qui reste la source de vérité. Sans configuration, la
   * commande est acceptée sans être envoyée — c'est le cas hors ligne de M8
   * (partie M) critère 3, et le refuser rendrait l'écran invérifiable sur un
   * poste nu.
   */
  const remote = useMemo(() => appSink(), []);
  const sink: CommandSink = useCallback(async commands => {
    const outcome = remote === null
      ? { ok: true as const, value: null, warnings: [] }
      : await remote(commands);
    if (outcome.ok) reload();
    return outcome;
  }, [remote, reload]);

  // Mémorisée : sans cela le tableau vide de l'état non chargé serait neuf à
  // chaque rendu, et les listes qui en dérivent se recalculeraient sans fin.
  const sites = useMemo(
    () => (list.status === 'ready' ? list.value : []),
    [list],
  );

  const countries: readonly CountrySummary[] = useMemo(
    () => (countryState.status === 'ready' ? countryState.value : []),
    [countryState],
  );

  const entities: readonly LegalEntitySummary[] = useMemo(
    () => (entityState.status === 'ready' ? entityState.value : []),
    [entityState],
  );

  const creation = useSiteCreation(sink, {
    orgId: ORG_OF_SESSION,
    newId: () => crypto.randomUUID(),
    now: () => new Date().toISOString(),
    existingNames: sites.map(site => site.name),
    countries,
    defaultBuildingName: t('sites.create.building.default'),
    defaultLevelName: t('sites.create.level.default'),
  });

  /**
   * Q9 — les pays viennent de la table, jamais d'une liste écrite ici. Le nom
   * affiché est celui de la langue active ; le référentiel porte les deux et
   * ne se relit pas à la bascule.
   */
  const countryOptions: readonly CountryOption[] = useMemo(
    () => countries.map(country => ({
      value: country.code,
      label: lang === 'en' ? country.name_en : country.name_fr,
      timezones: country.timezones,
    })),
    [countries, lang],
  );

  const entityOptions: readonly Option[] = useMemo(
    () => entities.map(entity => ({ value: entity.id, label: entity.legal_name })),
    [entities],
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
          countries={countryOptions}
          // Aucun paquet de règles n'est chargé dans le parcours de la
          // tranche. Le sélecteur est donc vide, et son information dit ce
          // que cela emporte : la composition attendra.
          rulesPacks={[]}
          legalEntities={entityOptions}
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
