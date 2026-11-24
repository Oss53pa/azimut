import { createContext } from 'react';
import type { SinkConfig } from '../state/postgrest-sink.js';

/**
 * S6.4 — la configuration du verrou ferme, fournie par la session d'atelier
 * ou par la coquille quand une session est ouverte ; `null` sinon, et rien
 * n'est posé ni refusé.
 */
export const ObjectLockContext = createContext<SinkConfig | null>(null);
