/**
 * Lecture d'une valeur de ligne du magasin de session.
 *
 * Deux origines écrivent dans ce magasin, et elles n'encodent pas de la même
 * façon. Une commande aplatit tout en texte, parce que c'est ce que le chemin
 * d'écriture envoie ; un site rechargé depuis le dépôt porte les valeurs déjà
 * analysées. Un lecteur qui n'accepterait qu'une des deux formes rendrait
 * illisible la moitié des lignes selon d'où elles viennent.
 *
 * Aucune valeur n'est devinée. Une lecture qui échoue rend `null`, et
 * l'appelant compte la ligne plutôt que de la compléter : une structure
 * calculée sur des lignes complétées vaudrait pour une saisie qui n'a pas eu
 * lieu.
 */
import type { Point } from '@azimut/core-model';

export type RowValues = Readonly<Record<string, unknown>>;

export function text(values: RowValues, key: string): string | null {
  const value = values[key];
  return typeof value === 'string' ? value : null;
}

export function numeric(values: RowValues, key: string): number | null {
  const value = values[key];
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

export function boolean(values: RowValues, key: string): boolean {
  const value = values[key];
  return value === true || value === 'true';
}

/** Une structure portée soit en JSON, soit déjà analysée. */
export function structured(values: RowValues, key: string): unknown {
  const raw = values[key];
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function point(raw: unknown): Point | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { x_m, y_m } = raw as { x_m?: unknown; y_m?: unknown };
  if (typeof x_m !== 'number' || typeof y_m !== 'number') return null;
  return { x_m, y_m };
}
