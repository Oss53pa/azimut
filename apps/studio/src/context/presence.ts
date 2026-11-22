import { createContext } from 'react';
import type { Presence } from '../state/presence.js';

/**
 * S6.7b — les autres présents du niveau ouvert, fournis par la session
 * d'atelier. `null` : la présence n'est pas suivie (mode local, ou écran sans
 * niveau), et la barre d'état n'en dit rien.
 */
export const PresenceContext = createContext<readonly Presence[] | null>(null);
