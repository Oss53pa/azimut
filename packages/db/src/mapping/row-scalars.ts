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

export function asStringArray(value: unknown): readonly string[] | undefined {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : undefined;
}

const VERSION_STATES: readonly SupportVersionState[] = [
  'draft', 'in_review', 'approved', 'superseded',
];

export function versionState(value: string): SupportVersionState {
  return (VERSION_STATES as readonly string[]).includes(value)
    ? (value as SupportVersionState)
    : 'draft';
}
