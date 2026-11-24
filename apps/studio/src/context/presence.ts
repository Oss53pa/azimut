import { createContext } from 'react';
import type { Presence, SelectionRef, WorkZone } from '../state/presence.js';

/**
 * S6.7b — les autres présents du niveau ouvert, fournis par la session
 * d'atelier. `null` : la présence n'est pas suivie (mode local, ou écran sans
 * niveau), et la barre d'état n'en dit rien.
 */
export const PresenceContext = createContext<readonly Presence[] | null>(null);

/** Ce qu'un écran dit de son poste : ce qu'il a sélectionné, ce qu'il regarde. */
export type PresenceReport = {
  readonly selection: readonly SelectionRef[];
  readonly zone: WorkZone | null;
};

/**
 * S6.7c — la façon dont un écran publie sa sélection et sa zone. Sans
 * fournisseur, elle ne fait rien : un écran monté hors session ne publie pas.
 */
export const PresencePublishContext = createContext<(report: PresenceReport) => void>(() => undefined);
