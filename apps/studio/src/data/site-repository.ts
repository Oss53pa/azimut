/**
 * Le dépôt de sites — le port entre les écrans et la donnée.
 *
 * Les écrans consomment `SiteData` et rien d'autre ; d'où il vient ne les
 * regarde pas. Deux adaptateurs l'implémentent : les sites de référence du
 * dépôt, en mémoire, et le dépôt réel lu par l'API REST.
 *
 * Toute défaillance remonte en `RepositoryError`, avec un code du catalogue
 * D2 : l'interface ne montre jamais un message de plateforme brut.
 */
import type { SiteData, SiteVocabulary } from '@azimut/core-model';

export type SiteSummary = {
  readonly id: string;
  readonly org_id: string;
  readonly name: string;
  readonly country_code: string;
  readonly rules_pack_id: string | null;
};

export const REPOSITORY_KINDS = ['reference', 'postgrest'] as const;
export type RepositoryKind = (typeof REPOSITORY_KINDS)[number];

export type SiteRepository = {
  readonly kind: RepositoryKind;
  /** Origine de la donnée, citée telle quelle dans l'interface. */
  readonly origin: string;
  listSites(): Promise<readonly SiteSummary[]>;
  loadSite(siteId: string): Promise<SiteData>;
  /**
   * Ce que le site oppose à ses textes : lexique de charte, faits,
   * affirmations de source.
   *
   * Séparé de `loadSite` parce que ce n'est pas de la géométrie et qu'un site
   * se dessine sans : une carte s'affiche, un contrôle de vocabulaire attend.
   * Un dépôt qui n'en porte pas rend un vocabulaire vide, et les contrôles se
   * rangent alors parmi les non exercés — jamais parmi les réussis.
   */
  loadVocabulary(siteId: string): Promise<SiteVocabulary>;
};

/**
 * Une défaillance d'accès à la donnée n'est pas une anomalie.
 *
 * D2.2 : « Toute anomalie produite par un moteur figure dans ce catalogue. »
 * Un moteur n'a ni réseau ni base (A4.1). Une requête qui échoue n'est donc
 * pas du ressort du catalogue, et le domaine `NET` qui y figurait n'était
 * autorisé par aucun des quatorze documents.
 *
 * Ce que les documents en disent, eux, c'est que ces situations sont des
 * **états d'écran** : F7 (partie F) en fait deux des six obligatoires, « Hors
 * ligne » et
 * « Droit refusé », et M1 (partie M) comme M2 les reprennent écran par écran.
 * Une
 * défaillance porte donc ici le nom de son genre, et l'état qu'elle appelle.
 * Jamais la forme `DOMAINE.CODE`, pour qu'elle ne puisse pas être confondue
 * avec une anomalie ni traduite comme telle.
 */
export const REPOSITORY_FAILURES = [
  'request_failed',
  'unauthorized',
  'forbidden',
  'not_found',
  'offline',
] as const;
export type RepositoryFailure = (typeof REPOSITORY_FAILURES)[number];

/**
 * Les six états de F7 qu'un écran traite, par leur seul nom.
 *
 * Le type homonyme de  porte, lui, la charge de
 * chaque état — le message d'erreur, ce qui manque, ce qui reste possible. Ici
 * on n'a que le genre, parce qu'une défaillance de dépôt ne sait pas encore ce
 * que l'écran dira.
 */
export type ScreenStateKind =
  | 'empty' | 'loading' | 'partial' | 'error' | 'offline' | 'permission_denied';

/**
 * L'état d'écran qu'appelle chaque défaillance (F7).
 *
 * `unauthorized` mène à « Droit refusé » comme `forbidden` : du point de vue
 * de l'écran, une session expirée et un droit manquant demandent la même
 * chose — dire ce qui n'est pas permis et à qui s'adresser.
 */
export const FAILURE_SCREEN_STATE: Readonly<Record<RepositoryFailure, ScreenStateKind>> = {
  'request_failed': 'error',
  unauthorized: 'permission_denied',
  forbidden: 'permission_denied',
  'not_found': 'error',
  offline: 'offline',
};

/** Une défaillance d'accès à la donnée. */
export class RepositoryError extends Error {
  readonly failure: RepositoryFailure;
  /** Détail technique, affiché en second plan : statut, URL, message. */
  readonly detail: string;

  constructor(failure: RepositoryFailure, detail: string) {
    super(`${failure}: ${detail}`);
    this.name = 'RepositoryError';
    this.failure = failure;
    this.detail = detail;
  }

  /** L'état d'écran que cette défaillance appelle (F7). */
  get screenState(): ScreenStateKind {
    return FAILURE_SCREEN_STATE[this.failure];
  }
}

/** Traduit un statut HTTP en genre de défaillance. */
export function failureForStatus(status: number): RepositoryFailure {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  return 'request_failed';
}

export function isRepositoryError(value: unknown): value is RepositoryError {
  return value instanceof RepositoryError;
}
