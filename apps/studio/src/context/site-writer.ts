import { createContext } from 'react';
import type { CommandSink } from '../state/command-store.js';

/**
 * S6.6c — l'émetteur des écrans de la coquille, fourni par elle.
 *
 * `undefined` : aucun fournisseur, l'écran construit son émetteur depuis
 * l'environnement. `null` : aucune base configurée, l'écran ne peut pas
 * écrire. Sinon, l'émetteur que la coquille a choisi — journalisé dès qu'une
 * session est ouverte, pour que le suivi du journal reconnaisse les écritures
 * de ce poste.
 */
export const SiteSinkContext = createContext<CommandSink | null | undefined>(undefined);
