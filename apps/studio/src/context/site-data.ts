import { createContext } from 'react';
import type { SiteData } from '@azimut/core-model';

export const SiteDataContext = createContext<SiteData | null>(null);

/**
 * Relit le site depuis le dépôt. Un écran qui écrit par commande l'appelle
 * une fois l'écriture acceptée : le dépôt reste la source de vérité, et
 * l'écran ne recopie pas en mémoire ce qu'il vient d'écrire. Sans
 * fournisseur, ne fait rien.
 */
export const SiteReloadContext = createContext<() => void>(() => undefined);
