/**
 * F15, `state/` — le magasin de l'écran M1 (partie M).
 *
 * Il tient l'état du formulaire, appelle la logique de création, confie les
 * commandes à l'émetteur, et rend les anomalies à l'écran. M12.A2 :
 * l'écran n'écrit pas, il passe par ici.
 */
import { useCallback, useState } from 'react';
import type { Finding } from '@azimut/core-model';
import { EMPTY_STORE, dispatch } from './command-store.js';
import type { CommandSink, StoreState } from './command-store.js';
import { createSiteCommands } from './site-creation.js';
import type { CountryChoice, SiteDraft } from './site-creation.js';

export type CreationState = {
  readonly open: boolean;
  readonly busy: boolean;
  readonly findings: readonly Finding[];
  readonly warnings: readonly Finding[];
  /** L'identifiant du site créé, une fois l'écriture faite. */
  readonly created: string | null;
};

export const IDLE_CREATION: CreationState = {
  open: false,
  busy: false,
  findings: [],
  warnings: [],
  created: null,
};

/** Ce que l'appelant fournit et que le magasin ne peut pas inventer. */
export type CreationEnvironment = {
  readonly orgId: string;
  /** Tire quatre identifiants. Injecté : un magasin ne tire pas au sort. */
  readonly newId: () => string;
  /** Rend l'instant courant. Injecté : E5.1 interdit de lire l'horloge ici. */
  readonly now: () => string;
  readonly existingNames: readonly string[];
  /** Q9 — les pays du référentiel, contre lesquels pays et fuseau se jugent. */
  readonly countries: readonly CountryChoice[];
  readonly defaultBuildingName: string;
  readonly defaultLevelName: string;
};

export function useSiteCreation(
  sink: CommandSink,
  environment: CreationEnvironment,
): {
  readonly state: CreationState;
  readonly store: StoreState;
  readonly open: () => void;
  readonly close: () => void;
  readonly submit: (draft: SiteDraft) => Promise<void>;
} {
  const [state, setState] = useState<CreationState>(IDLE_CREATION);
  const [store, setStore] = useState<StoreState>(EMPTY_STORE);

  const open = useCallback(() => {
    setState({ ...IDLE_CREATION, open: true });
  }, []);

  const close = useCallback(() => {
    setState(IDLE_CREATION);
  }, []);

  const submit = useCallback(async (draft: SiteDraft) => {
    setState(previous => ({ ...previous, busy: true, findings: [] }));

    const siteId = environment.newId();
    const outcome = createSiteCommands(draft, {
      orgId: environment.orgId,
      siteId,
      buildingId: environment.newId(),
      levelId: environment.newId(),
      existingNames: environment.existingNames,
      countries: environment.countries,
      defaultBuildingName: environment.defaultBuildingName,
      defaultLevelName: environment.defaultLevelName,
      timestamp: environment.now(),
    });

    if (!outcome.ok) {
      // M7.5 (partie M) : le refus n'efface pas le travail en cours. La boîte
      // reste ouverte, la saisie telle quelle, les anomalies sous leur champ.
      setState(previous => ({ ...previous, busy: false, findings: outcome.findings }));
      return;
    }

    const written = await dispatch(store, sink, outcome.value);
    setStore(written.state);

    if (!written.outcome.ok) {
      setState(previous => ({ ...previous, busy: false, findings: written.outcome.ok ? [] : written.outcome.findings }));
      return;
    }

    setState({
      open: false,
      busy: false,
      findings: [],
      warnings: outcome.warnings,
      created: siteId,
    });
  }, [environment, sink, store]);

  return { state, store, open, close, submit };
}
