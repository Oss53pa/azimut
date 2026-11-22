/**
 * S6.6b — porter dans la session de l'atelier les commandes que les autres
 * postes ont fait inscrire au journal.
 *
 * Elles ont été appliquées par la base dans l'ordre du journal, chacune sous
 * la condition de son `before` (0078) : la suite est cohérente par
 * construction. Le poste les rejoue dans le même ordre sur ses lignes, comme
 * il rejoue les siennes (`applyToSession`), et rejoint ainsi l'état de la base.
 *
 * Seulement quand la session n'a rien en attente : des commandes locales en
 * file ou un choix de reprise non tranché relèvent de l'arbitrage hors ligne
 * (S6.9), pas de ce rejeu. Le curseur n'avance pas tant qu'elles sont là.
 */
import type { JournalEntry } from './journal-follower.js';
import { applyToSession } from './session-store.js';
import type { SessionState } from './session-store.js';

export function applyReceived(state: SessionState, entries: readonly JournalEntry[]): SessionState {
  return entries.reduce((next, entry) => applyToSession(next, entry.command), state);
}

/** Vrai si la session peut recevoir le journal sans arbitrage. */
export function canReceive(state: SessionState, resumePending: boolean): boolean {
  return !resumePending && state.online && state.queued.length === 0;
}
