import type { TimestampValue } from './row-types.js';
import type { SupportVersionState } from '@azimut/core-model';

/**
 * Lectures élémentaires d'une valeur de ligne.
 *
 * Partagées entre l'assemblage du site et les mappeurs de la signalétique, que
 * A2.4 a séparés. Une seule définition : deux lectures d'un même `numeric` qui
 * divergeraient produiraient deux géométries.
 */
/** Une colonne `numeric` revient en chaîne : la conversion est explicite. */
export function num(value: string): number {
  return Number(value);
}

export function isoString(value: TimestampValue): string {
  return typeof value === 'string' ? value : value.toISOString();
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * Une liste de chaînes, ou `undefined` pour une valeur qui n'est pas une
 * liste. Un élément qui n'est pas une chaîne fait échouer la lecture : il
 * n'est pas écarté en silence (lot 4 de l'audit, A6.3).
 */
export function asStringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  if (!value.every(item => typeof item === 'string')) {
    throw new Error('ligne relue hors de sa forme : liste qui ne contient pas que des chaînes');
  }
  return value as readonly string[];
}

const VERSION_STATES: readonly SupportVersionState[] = [
  'draft', 'in_review', 'approved', 'superseded',
];

/**
 * L'état d'une version relue. Un état hors de la liste fait échouer la
 * lecture : le changer en brouillon ferait relire comme modifiable une
 * version peut-être approuvée (lot 4 de l'audit, A6.3).
 */
export function versionState(value: string): SupportVersionState {
  if (!(VERSION_STATES as readonly string[]).includes(value)) {
    throw new Error(`ligne relue hors de sa forme : état de version « ${value} »`);
  }
  return value as SupportVersionState;
}
