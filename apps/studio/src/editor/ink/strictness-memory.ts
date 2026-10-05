import { STRICTNESS_LEVELS } from './recognition-thresholds.js';
import type { Strictness } from './recognition-thresholds.js';

/**
 * J1.3 (partie J) — « L'intensité du redressement est réglable sur trois
 * niveaux, du plus strict au plus permissif, et le niveau retenu est mémorisé
 * par utilisateur. »
 *
 * Décision de l'utilisateur du 2026-10-05 : le niveau vit dans le stockage du
 * navigateur, comme la position de vue (E3.3), et non dans une table que A5 ne
 * prévoit pas. Tant que le studio n'ouvre aucune session d'authentification,
 * l'utilisateur est le profil du navigateur ; la clé prendra l'identifiant de
 * l'utilisateur quand il y en aura un.
 *
 * La donnée produite ne dépend jamais du niveau une fois la forme acceptée :
 * elle est quantifiée au millimètre dans tous les cas.
 */
export const DEFAULT_STRICTNESS: Strictness = 'normal';

const KEY = 'azimut.redressement';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function isStrictness(value: unknown): value is Strictness {
  return (STRICTNESS_LEVELS as readonly unknown[]).includes(value);
}

export function recallStrictness(store: Store | null): Strictness {
  if (store === null) return DEFAULT_STRICTNESS;
  try {
    const raw = store.getItem(KEY);
    return isStrictness(raw) ? raw : DEFAULT_STRICTNESS;
  } catch {
    return DEFAULT_STRICTNESS;
  }
}

export function rememberStrictness(level: Strictness, store: Store | null): void {
  if (store === null) return;
  try { store.setItem(KEY, level); } catch {
    // Stockage refusé : le niveau vaut pour la session seulement.
  }
}
