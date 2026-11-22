/**
 * S6.7b — le poste s'annonce sur le niveau qu'il a ouvert, et lit qui d'autre
 * y est (G4.2, S-22 ; décisions Q1, Q12, Q13).
 *
 * Sans liaison au journal — mode local, ou session sans identité — rien ne
 * part et rien ne se lit : `null`, que la barre d'état n'affiche pas.
 *
 * Ce lot annonce une sélection vide et aucune zone : les publier depuis
 * chaque écran est le lot suivant (S6.7c). La base les accepte déjà.
 */
import { useEffect, useState } from 'react';
import { useSessionIdentity } from '../auth/identity.js';
import {
  PRESENCE_HEARTBEAT_MS, PRESENCE_POLL_MS, leavePresence, othersPresent, readPresence, touchPresence,
} from '../state/presence.js';
import type { Presence } from '../state/presence.js';
import type { JournalBinding } from './useJournalFollow.js';

const sameList = (a: readonly Presence[], b: readonly Presence[]): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

export function useLevelPresence(
  journal: JournalBinding | undefined,
  levelId: string,
): readonly Presence[] | null {
  const { userId } = useSessionIdentity();
  const [present, setPresent] = useState<readonly Presence[]>([]);
  const active = journal !== undefined && levelId !== '';

  useEffect(() => {
    if (journal === undefined || levelId === '') return;
    const { config } = journal;
    let live = true;
    setPresent([]);

    const announce = (): void => { void touchPresence(config, levelId, [], null); };
    const read = async (): Promise<void> => {
      const rows = await readPresence(config, levelId);
      // Une lecture en échec garde la liste d'avant : la base oublie d'elle-même
      // ceux qui ne se renouvellent plus.
      if (!live || rows === null) return;
      const next = othersPresent(rows, userId);
      setPresent(previous => (sameList(previous, next) ? previous : next));
    };
    const leave = (): void => { void leavePresence(config, levelId); };

    announce();
    void read();
    const heartbeat = setInterval(announce, PRESENCE_HEARTBEAT_MS);
    const poll = setInterval(() => { void read(); }, PRESENCE_POLL_MS);
    window.addEventListener('pagehide', leave);
    return () => {
      live = false;
      clearInterval(heartbeat);
      clearInterval(poll);
      window.removeEventListener('pagehide', leave);
      leave();
    };
  }, [journal, levelId, userId]);

  return active ? present : null;
}
