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
import type { SiteData } from '@azimut/core-model';

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
};

export const REPOSITORY_ERROR_CODES = [
  'NET.REQUEST_FAILED',
  'NET.UNAUTHORIZED',
  'NET.FORBIDDEN',
  'NET.NOT_FOUND',
  'NET.OFFLINE',
] as const;
export type RepositoryErrorCode = (typeof REPOSITORY_ERROR_CODES)[number];

/** Une défaillance d'accès à la donnée, nommée par un code du catalogue. */
export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode;
  /** Détail technique, affiché en second plan : statut, URL, message. */
  readonly detail: string;

  constructor(code: RepositoryErrorCode, detail: string) {
    super(`${code}: ${detail}`);
    this.name = 'RepositoryError';
    this.code = code;
    this.detail = detail;
  }
}

/** Traduit un statut HTTP en code du catalogue. */
export function errorCodeForStatus(status: number): RepositoryErrorCode {
  if (status === 401) return 'NET.UNAUTHORIZED';
  if (status === 403) return 'NET.FORBIDDEN';
  if (status === 404) return 'NET.NOT_FOUND';
  return 'NET.REQUEST_FAILED';
}

export function isRepositoryError(value: unknown): value is RepositoryError {
  return value instanceof RepositoryError;
}
