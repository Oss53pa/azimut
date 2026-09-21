/**
 * État de chargement d'un site.
 *
 * Quatre états, pas trois : rien n'est encore demandé, une requête est en
 * cours, elle a rendu un site, elle a échoué. L'écran doit pouvoir les
 * distinguer — un écran vide qui ressemble à une réussite est le pire des
 * états (M5, partie M).
 */
import { useCallback, useEffect, useState } from 'react';
import type { SiteData } from '@azimut/core-model';
import { EMPTY_VOCABULARY } from '@azimut/core-model';
import {
  EMPTY_VOCABULARY_STATE, type VocabularyState,
} from '../context/site-vocabulary.js';
import {
  isRepositoryError, RepositoryError,
  type SiteRepository, type SiteSummary,
} from './site-repository.js';

export type AsyncState<T> =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly value: T }
  | { readonly status: 'failed'; readonly error: RepositoryError };

function toRepositoryError(cause: unknown): RepositoryError {
  return isRepositoryError(cause)
    ? cause
    : new RepositoryError('NET.REQUEST_FAILED', String(cause));
}

/** Liste des sites du dépôt, chargée une fois. */
export function useSiteList(repository: SiteRepository): {
  readonly state: AsyncState<readonly SiteSummary[]>;
  readonly reload: () => void;
} {
  const [state, setState] = useState<AsyncState<readonly SiteSummary[]>>({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    repository.listSites().then(
      value => { if (!cancelled) setState({ status: 'ready', value }); },
      cause => { if (!cancelled) setState({ status: 'failed', error: toRepositoryError(cause) }); },
    );
    return () => { cancelled = true; };
  }, [repository, attempt]);

  const reload = useCallback(() => { setAttempt(n => n + 1); }, []);
  return { state, reload };
}

/** Site courant. `siteId` vide signifie qu'aucun site n'est ouvert. */
export function useSite(repository: SiteRepository, siteId: string): {
  readonly state: AsyncState<SiteData>;
  readonly reload: () => void;
} {
  const [state, setState] = useState<AsyncState<SiteData>>({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (siteId === '') {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    repository.loadSite(siteId).then(
      value => { if (!cancelled) setState({ status: 'ready', value }); },
      cause => { if (!cancelled) setState({ status: 'failed', error: toRepositoryError(cause) }); },
    );
    return () => { cancelled = true; };
  }, [repository, siteId, attempt]);

  const reload = useCallback(() => { setAttempt(n => n + 1); }, []);
  return { state, reload };
}

/**
 * Tous les sites du dépôt, chargés un par un.
 *
 * Le portefeuille a besoin du contenu de chaque site, pas seulement de son
 * nom : il n'y a pas de moteur de portefeuille, les indicateurs viennent des
 * mêmes contrôles exécutés site par site. Le chargement est donc séquentiel et
 * son avancement est visible — un portefeuille de vingt sites ne doit pas
 * paraître figé.
 */
export function useAllSites(repository: SiteRepository): {
  readonly state: AsyncState<readonly { readonly id: string; readonly data: SiteData }[]>;
  readonly loaded: number;
  readonly total: number;
} {
  const [state, setState] = useState<
    AsyncState<readonly { readonly id: string; readonly data: SiteData }[]>
  >({ status: 'idle' });
  const [loaded, setLoaded] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    setLoaded(0);

    void (async () => {
      try {
        const summaries = await repository.listSites();
        if (cancelled) return;
        setTotal(summaries.length);

        const out: { id: string; data: SiteData }[] = [];
        for (const summary of summaries) {
          const data = await repository.loadSite(summary.id);
          if (cancelled) return;
          out.push({ id: summary.id, data });
          setLoaded(out.length);
        }
        if (!cancelled) setState({ status: 'ready', value: out });
      } catch (cause) {
        if (!cancelled) setState({ status: 'failed', error: toRepositoryError(cause) });
      }
    })();

    return () => { cancelled = true; };
  }, [repository]);

  return { state, loaded, total };
}

/**
 * Vocabulaire du site courant : lexique de charte, faits, affirmations.
 *
 * Il ne partage pas l'état du site : un échec de lecture du vocabulaire ne doit
 * pas empêcher d'ouvrir une carte. Mais il ne se tait pas non plus. Un registre
 * vide et un registre illisible portent la même valeur et ne disent pas la
 * même chose : sans `status`, une panne de lecture passerait pour « ce site ne
 * déclare rien », et les contrôles se rangeraient parmi les non exercés sans
 * que personne ne sache qu'ils auraient dû l'être.
 */
export function useSiteVocabularyLoad(
  repository: SiteRepository,
  siteId: string,
): { readonly state: VocabularyState; readonly reload: () => void } {
  const [state, setState] = useState<VocabularyState>(EMPTY_VOCABULARY_STATE);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (siteId === '') {
      setState(EMPTY_VOCABULARY_STATE);
      return;
    }
    let cancelled = false;
    setState({ vocabulary: EMPTY_VOCABULARY, status: 'loading', errorCode: null });
    repository.loadVocabulary(siteId).then(
      value => {
        if (!cancelled) setState({ vocabulary: value, status: 'ready', errorCode: null });
      },
      cause => {
        if (cancelled) return;
        setState({
          vocabulary: EMPTY_VOCABULARY,
          status: 'failed',
          errorCode: toRepositoryError(cause).code,
        });
      },
    );
    return () => { cancelled = true; };
  }, [repository, siteId, attempt]);

  // Sans reprise, une lecture échouée le reste pour la session : l'écran
  // dirait « non exercé » jusqu'au rechargement de la page.
  const reload = useCallback(() => { setAttempt(n => n + 1); }, []);
  return { state, reload };
}
