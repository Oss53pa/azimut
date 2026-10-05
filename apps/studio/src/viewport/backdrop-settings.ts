/**
 * J1.4 (partie J) — les réglages du fond de décalque : opacité du plan calé,
 * affichage ou masquage des formes déjà tracées.
 *
 * Ce sont des préférences de travail, comme la position de vue (E3.3) : elles
 * vivent dans le stockage du navigateur, par zone et par niveau, jamais dans
 * la base ni dans l'historique d'annulation. Une valeur illisible est ignorée.
 *
 * Le troisième réglage de J1.4, le verrouillage du fond, est acquis par
 * construction : la zone de travail n'offre aucun geste qui déplace le fond,
 * que seul le calage pose.
 */
export type BackdropSettings = {
  /** Opacité du plan calé, de 0 à 1. */
  readonly opacity: number;
  /** Les formes déjà tracées sont-elles montrées ? */
  readonly showShapes: boolean;
};

/** Le fond à l'ouverture : assez présent pour décalquer, assez pâle pour lire le tracé. */
export const DEFAULT_BACKDROP: BackdropSettings = { opacity: 0.6, showShapes: true };

/** Le pas du réglage d'opacité. */
export const OPACITY_STEP = 0.1;

const PREFIX = 'azimut.fond.';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

export function recallBackdrop(key: string, store: Store | null): BackdropSettings {
  if (store === null) return DEFAULT_BACKDROP;
  let raw: string | null;
  try { raw = store.getItem(PREFIX + key); } catch { return DEFAULT_BACKDROP; }
  if (raw === null) return DEFAULT_BACKDROP;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return DEFAULT_BACKDROP; }
  if (typeof parsed !== 'object' || parsed === null) return DEFAULT_BACKDROP;
  const { opacity, showShapes } = parsed as Record<string, unknown>;
  return {
    opacity: typeof opacity === 'number' && opacity >= 0 && opacity <= 1 ? opacity : DEFAULT_BACKDROP.opacity,
    showShapes: typeof showShapes === 'boolean' ? showShapes : DEFAULT_BACKDROP.showShapes,
  };
}

export function rememberBackdrop(key: string, settings: BackdropSettings, store: Store | null): void {
  if (store === null) return;
  try {
    store.setItem(PREFIX + key, JSON.stringify(settings));
  } catch {
    // Stockage plein ou refusé : le réglage vaut pour la session seulement.
  }
}
