import { createContext } from 'react';
import type { SyncStatus } from '../state/sync-status.js';

/**
 * F5.2 — l'état de synchronisation de la session d'atelier, fourni par elle.
 * Sans fournisseur : `local`, ce qui est vrai d'un écran monté hors session.
 */
export const SyncStatusContext = createContext<SyncStatus>({ kind: 'local' });
