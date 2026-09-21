import type { ErrorCode } from './error-catalog.js';
import { ERROR_MESSAGES_FR } from './i18n-errors-fr.js';
import { ERROR_MESSAGES_EN } from './i18n-errors-en.js';

/**
 * Les deux tables vivent chacune dans son fichier.
 *
 * Réunies, elles franchissaient les quatre cents lignes qu'un fichier du dépôt
 * ne dépasse pas sans découpage (A2.4). La coupure est celle qui va de soi :
 * une langue par fichier, et ici la mécanique — la recherche d'un libellé et
 * la liste des langues servies — qui, elle, ne dépend d'aucune des deux.
 */
export type ErrorMessages = Readonly<Record<ErrorCode, string>>;

export { ERROR_MESSAGES_FR, ERROR_MESSAGES_EN };

const ERROR_DICTIONARIES: Readonly<Record<string, ErrorMessages>> = {
  fr: ERROR_MESSAGES_FR,
  en: ERROR_MESSAGES_EN,
};

export function getErrorMessage(
  code: ErrorCode,
  lang: string,
): string | undefined {
  const dict = ERROR_DICTIONARIES[lang];
  if (!dict) return undefined;
  return dict[code];
}

export function getSupportedErrorLangs(): readonly string[] {
  return Object.keys(ERROR_DICTIONARIES);
}
