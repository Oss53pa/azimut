import { SCALE_MAX_PX_PER_M, SCALE_MIN_PX_PER_M } from './view-transform.js';
import type { ViewState } from './view-transform.js';

/**
 * E3.3 — « La position de vue est mémorisée par niveau et par utilisateur,
 * hors du modèle métier. »
 *
 * Elle vit dans le stockage du navigateur, sous une clé par zone et par
 * niveau : jamais dans la base, jamais dans l'historique d'annulation. Une
 * valeur illisible ou hors bornes est ignorée, et la vue s'ajuste alors sur son
 * contenu comme à la première ouverture.
 */
const PREFIX = 'azimut.vue.';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function recallView(key: string, store: Store | null): ViewState | null {
  if (store === null) return null;
  let raw: string | null;
  try { raw = store.getItem(PREFIX + key); } catch { return null; }
  if (raw === null) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { centerX_m, centerY_m, scale_px_per_m } = parsed as Record<string, unknown>;
  if (!finite(centerX_m) || !finite(centerY_m) || !finite(scale_px_per_m)) return null;
  if (scale_px_per_m < SCALE_MIN_PX_PER_M || scale_px_per_m > SCALE_MAX_PX_PER_M) return null;
  return { centerX_m, centerY_m, scale_px_per_m, rotationDeg: 0 };
}

export function rememberView(key: string, view: ViewState, store: Store | null): void {
  if (store === null) return;
  const { centerX_m, centerY_m, scale_px_per_m } = view;
  try {
    store.setItem(PREFIX + key, JSON.stringify({ centerX_m, centerY_m, scale_px_per_m }));
  } catch {
    // Stockage plein ou refusé : la vue n'est pas mémorisée, et rien d'autre
    // n'en dépend.
  }
}

/** Oublie la vue mémorisée : la zone se recadre sur son contenu. */
export function forgetView(key: string, store: Store | null): void {
  if (store === null) return;
  try { store.removeItem(PREFIX + key); } catch {
    // Stockage refusé : il n'y avait rien à oublier.
  }
}

/** Le stockage du navigateur, s'il est accessible. */
export function browserStore(): Store | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
