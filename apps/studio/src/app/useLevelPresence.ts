/**
 * S6.7b et S6.7c — le poste s'annonce sur le niveau qu'il a ouvert, avec ce
 * qu'il sélectionne et ce qu'il regarde, et lit qui d'autre y est (G4.2,
 * S-22 ; décisions Q1, Q12, Q13).
 *
 * Sans liaison au journal — mode local, ou session sans identité — rien ne
 * part et rien ne se lit : `null`, que la barre d'état n'affiche pas, et une
 * publication sans effet.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSessionIdentity } from '../auth/identity.js';
import {
  PRESENCE_HEARTBEAT_MS, PRESENCE_POLL_MS, leavePresence, othersPresent, readPresence, touchPresence,
} from '../state/presence.js';
import type { Presence } from '../state/presence.js';
import type { PresenceReport } from '../context/presence.js';
import type { JournalBinding } from './useJournalFollow.js';

/**
 * Délai entre un changement de sélection ou de cadrage et son annonce.
 * Constante technique : un déplacement de vue n'envoie qu'une annonce, à la fin.
 */
export const PRESENCE_PUBLISH_DELAY_MS = 400;

const EMPTY_REPORT: PresenceReport = { selection: [], zone: null };

const sameList = (a: readonly Presence[], b: readonly Presence[]): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

export function useLevelPresence(
  journal: JournalBinding | undefined,
  levelId: string,
): { readonly present: readonly Presence[] | null; readonly publish: (report: PresenceReport) => void } {
  const { userId } = useSessionIdentity();
  const [present, setPresent] = useState<readonly Presence[]>([]);
  const report = useRef<PresenceReport>(EMPTY_REPORT);
  const announceRef = useRef<() => void>(() => undefined);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = journal !== undefined && levelId !== '';

  useEffect(() => {
    if (journal === undefined || levelId === '') return;
    const { config } = journal;
    let live = true;
    setPresent([]);

    const announce = (): void => {
      const { selection, zone } = report.current;
      void touchPresence(config, levelId, selection, zone);
    };
    announceRef.current = announce;
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
      announceRef.current = () => undefined;
      if (pending.current !== null) clearTimeout(pending.current);
      clearInterval(heartbeat);
      clearInterval(poll);
      window.removeEventListener('pagehide', leave);
      leave();
    };
  }, [journal, levelId, userId]);

  const publish = useCallback((next: PresenceReport): void => {
    if (JSON.stringify(next) === JSON.stringify(report.current)) return;
    report.current = next;
    if (pending.current !== null) clearTimeout(pending.current);
    pending.current = setTimeout(() => {
      pending.current = null;
      announceRef.current();
    }, PRESENCE_PUBLISH_DELAY_MS);
  }, []);

  return { present: active ? present : null, publish };
}
