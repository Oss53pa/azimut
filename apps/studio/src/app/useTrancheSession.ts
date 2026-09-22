/**
 * F15, `app/` — la session du parcours de M8 (partie M).
 *
 * « Un opérateur part d'un site vide, importe un plan, le cale, trace trois
 * cellules, pose quatre nœuds, trace les arêtes, lance la validation, et
 * obtient un résultat cohérent. »
 *
 * Ce module tient cette session d'un écran à l'autre : les cinq écrans
 * partagent un même état, sans quoi le parcours n'en serait pas un. Il écrit
 * par les commandes du module propriétaire (M12.A2), sauvegarde
 * localement à chaque geste (E5.4), et met en file quand le réseau manque
 * (E5.3).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EntityCommand, Outcome } from '@azimut/core-model';
import {
  EMPTY_SESSION, writeToSession, flushQueue, saveSession, countOf,
  readSession, clearSession, resumeDecision, markOpenInTab, isOpenInTab,
  highestLocalRank,
} from '../state/session-store.js';
import type { SessionState } from '../state/session-store.js';
import {
  EMPTY_STORE, dispatch, undo as undoLast, redo as redoLast, afterSync,
  canUndo, canRedo,
} from '../state/command-store.js';
import type { StoreState } from '../state/command-store.js';

/** L'organisation et le site du parcours, fournis par l'appelant. */
export type SessionContext = {
  readonly orgId: string;
  readonly siteId: string;
  readonly levelId: string;
};

export type TrancheSession = {
  readonly state: SessionState;
  readonly write: (commands: readonly EntityCommand[]) => Promise<boolean>;
  readonly count: (table: string) => number;
  /**
   * T-1.2b et E5.2 — la pile d'annulation du parcours.
   *
   * Elle est ici et non dans chaque écran : la portée est « le site en cours
   * d'édition, par utilisateur », et un écran qui tiendrait la sienne perdrait
   * l'annulation au changement d'écran.
   */
  readonly store: StoreState;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Annule le dernier geste en écrivant son inverse (E5.2). */
  readonly undo: () => Promise<boolean>;
  /** Rétablit le dernier geste annulé (E5.2). */
  readonly redo: () => Promise<boolean>;
  /**
   * L'état local trouvé à la réouverture, tant que l'utilisateur n'a pas
   * tranché. `null` le reste du temps (E5.4).
   */
  readonly pendingResume: SessionState | null;
  /** Reprendre le travail local. */
  readonly acceptResume: () => void;
  /** Repartir sans lui. L'état local est effacé, jamais fusionné. */
  readonly discardResume: () => void;
  /** Un identifiant neuf, tiré ici pour que les calculs n'en tirent aucun. */
  readonly newId: () => string;
  readonly now: () => string;
};

/**
 * L'émetteur par défaut : il accepte tout sans rien envoyer.
 *
 * Le chemin d'écriture réel est celui du lot 1.2 — `createPostgrestSink`. Tant
 * qu'aucun dépôt n'est configuré, le parcours doit rester praticable : c'est
 * exactement le cas « hors ligne » que M8 (partie M) critère 3 demande, et le refuser
 * rendrait la tranche invérifiable sur un poste nu.
 */
const LOCAL_ONLY = async (): Promise<Outcome<unknown>> => ({
  ok: true, value: null, warnings: [],
});

export function useTrancheSession(
  context: SessionContext,
  send: (commands: readonly EntityCommand[]) => Promise<Outcome<unknown>> = LOCAL_ONLY,
): TrancheSession {
  const [state, setState] = useState<SessionState>(EMPTY_SESSION);
  // L'état courant, lisible sans attendre un rendu : une écriture doit partir
  // du dernier état écrit, et non de celui que React a rendu en dernier.
  const current = useRef<SessionState>(EMPTY_SESSION);
  const counter = useRef(0);
  const storage = useMemo(
    () => (typeof localStorage === 'undefined' ? null : localStorage),
    [],
  );
  const tabStorage = useMemo(
    () => (typeof sessionStorage === 'undefined' ? null : sessionStorage),
    [],
  );
  const [pendingResume, setPendingResume] = useState<SessionState | null>(null);
  // E5.2 — la pile d'annulation du site en cours. Le `ref` porte l'état
  // courant, pour qu'un second geste parte du premier et non du dernier rendu.
  const [storeState, setStore] = useState<StoreState>(EMPTY_STORE);
  const store = useRef<StoreState>(EMPTY_STORE);

  /**
   * Prend un état pour état courant. Le compteur d'identifiants reprend après
   * le dernier rang écrit, sans quoi la commande suivante réécrirait une ligne
   * reprise au lieu d'en créer une.
   */
  const adopt = useCallback((next: SessionState): void => {
    current.current = next;
    counter.current = Math.max(counter.current, highestLocalRank(next.rows));
    setState(next);
  }, []);

  // E5.4 — à l'ouverture d'un écran, l'état local est relu. Ce qu'on en fait
  // dépend de qui l'a laissé là : cet onglet, ou une session interrompue.
  useEffect(() => {
    const decision = resumeDecision(
      readSession(context.siteId, storage),
      isOpenInTab(context.siteId, tabStorage),
    );
    if (decision.kind === 'poursuivre') {
      adopt(decision.state);
      return;
    }
    if (decision.kind === 'proposer') {
      setPendingResume(decision.state);
      return;
    }
    markOpenInTab(context.siteId, tabStorage);
  }, [adopt, context.siteId, storage, tabStorage]);

  const acceptResume = useCallback((): void => {
    if (pendingResume !== null) adopt(pendingResume);
    setPendingResume(null);
    markOpenInTab(context.siteId, tabStorage);
  }, [adopt, context.siteId, pendingResume, tabStorage]);

  const discardResume = useCallback((): void => {
    // Aucune fusion : ce qui est écarté est effacé, et le parcours repart de
    // l'état vide. Le dépôt, lui, n'a rien perdu — la file n'était pas partie.
    clearSession(context.siteId, storage);
    adopt(EMPTY_SESSION);
    setPendingResume(null);
    markOpenInTab(context.siteId, tabStorage);
  }, [adopt, context.siteId, storage, tabStorage]);

  // E5.3 : la file part au retour du réseau, et l'état repasse en ligne.
  useEffect(() => {
    const onOnline = (): void => {
      void (async () => {
        const { state: flushedState } = await flushQueue(current.current, send);
        current.current = flushedState;
        setState(flushedState);
        // E5.3 — « La pile d'annulation est vidée à la synchronisation. Ce qui
        // est synchronisé n'est plus annulable localement. » Revenir dessus
        // demande une commande inverse tracée, jamais une annulation.
        store.current = afterSync(store.current);
        setStore(store.current);
      })();
    };
    const onOffline = (): void => {
      current.current = { ...current.current, online: false };
      setState(current.current);
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [send]);

  /**
   * L'émetteur que le magasin de commandes appelle.
   *
   * C'est lui qui applique à l'état local, sauvegarde (E5.4) et met en file ce
   * que le réseau n'a pas pris. Le magasin, lui, n'empile qu'après : un geste
   * refusé ne laisse rien dans la pile, sans quoi on pourrait « annuler » une
   * écriture qui n'a pas eu lieu.
   */
  const sink = useCallback(async (
    commands: readonly EntityCommand[],
  ): Promise<Outcome<unknown>> => {
    const written = await writeToSession(current.current, commands, send);
    current.current = written;
    saveSession(context.siteId, written, storage);
    markOpenInTab(context.siteId, tabStorage);
    setState(written);
    return { ok: true, value: null, warnings: [] };
  }, [context.siteId, send, storage, tabStorage]);

  const write = useCallback(async (commands: readonly EntityCommand[]): Promise<boolean> => {
    const queuedBefore = current.current.queued.length;
    const result = await dispatch(store.current, sink, commands);
    store.current = result.state;
    setStore(result.state);
    // Rien ne reste en file quand l'envoi a abouti ; sinon il repartira à la
    // synchronisation, et l'écran le dit.
    return current.current.queued.length === queuedBefore;
  }, [sink]);

  const undo = useCallback(async (): Promise<boolean> => {
    const result = await undoLast(store.current, sink, new Date().toISOString());
    store.current = result.state;
    setStore(result.state);
    return result.outcome.ok;
  }, [sink]);

  const redo = useCallback(async (): Promise<boolean> => {
    const result = await redoLast(store.current, sink, new Date().toISOString());
    store.current = result.state;
    setStore(result.state);
    return result.outcome.ok;
  }, [sink]);

  const newId = useCallback((): string => {
    counter.current += 1;
    // Déterministe, et suffisant pour une session : les identifiants réels
    // viennent du dépôt. Un tirage au sort ici rendrait le parcours
    // irreproductible, contre INV-4.
    const n = counter.current.toString(16).padStart(12, '0');
    return `00000000-0000-4000-8000-${n}`;
  }, []);

  return {
    state,
    write,
    store: storeState,
    canUndo: canUndo(storeState),
    canRedo: canRedo(storeState),
    undo,
    redo,
    pendingResume,
    acceptResume,
    discardResume,
    count: useCallback((table: string) => countOf(state, table), [state]),
    newId,
    now: useCallback(() => new Date().toISOString(), []),
  };
}
