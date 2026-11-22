/**
 * S6.6b — l'atelier suit le journal de son site (décision Q4 : interrogation
 * périodique).
 *
 * Trois choses, et rien d'autre :
 *  · l'émetteur est enveloppé pour noter les numéros que le journal donne aux
 *    écritures de ce poste, et pour suspendre l'interrogation tant qu'une
 *    écriture est en vol ;
 *  · au départ, le dernier numéro est lu avant de relire le site ;
 *  · à chaque interrogation, les commandes des autres postes sont rejouées
 *    sur la session, ou, si la lecture saute un numéro ou ne se relit pas, le
 *    site est relu en entier.
 *
 * Sans liaison au journal — mode local, ou session sans identité — le crochet
 * ne fait rien, et l'émetteur passe tel quel.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import {
  pollJournal, readJournalHead, readJournalSince, startCursor, trackOwnWrites,
} from '../state/journal-follower.js';
import type { JournalCursor, JournalSend } from '../state/journal-follower.js';
import { applyReceived, canReceive } from '../state/journal-session.js';
import type { SinkConfig } from '../state/postgrest-sink.js';
import type { SessionState } from '../state/session-store.js';

export type JournalBinding = {
  readonly config: SinkConfig;
  readonly siteId: string;
};

type Send = JournalSend;

export function useJournalFollow(options: {
  readonly journal: JournalBinding | undefined;
  readonly current: MutableRefObject<SessionState>;
  readonly resumePending: () => boolean;
  readonly adopt: (next: SessionState) => void;
  readonly reload: () => Promise<void>;
}): {
  readonly wrap: (send: Send) => Send;
  /** F5.2 — la dernière lecture du journal a échoué. */
  readonly readFailing: boolean;
} {
  const { journal, current, resumePending, adopt, reload } = options;
  const cursor = useRef<JournalCursor | null>(null);
  const inFlight = useRef(0);
  const [readFailing, setReadFailing] = useState(false);

  const resync = useCallback(async (): Promise<boolean> => {
    if (journal === undefined) return false;
    const head = await readJournalHead(journal.config, journal.siteId);
    if (head === null) return false;
    await reload();
    cursor.current = startCursor(journal.siteId, head);
    return true;
  }, [journal, reload]);

  useEffect(() => {
    if (journal === undefined) return;
    cursor.current = null;
    // Tant qu'aucun curseur n'est posé, chaque interrogation retente la
    // lecture de la tête : un premier échec ne laisse pas le poste sourd.
    const stop = pollJournal({
      read: async after => {
        if (cursor.current === null) {
          return (await resync())
            ? { ok: true, entries: [] }
            : { ok: false, cause: 'head', findings: [] };
        }
        return readJournalSince(journal.config, journal.siteId, after);
      },
      cursor: () => cursor.current ?? startCursor(journal.siteId),
      busy: () => inFlight.current > 0,
      onStep: step => {
        setReadFailing(false);
        if (cursor.current === null) return;
        if (!canReceive(current.current, resumePending())) return;
        if (step.gap) { void resync(); return; }
        if (step.received.length > 0) adopt(applyReceived(current.current, step.received));
        cursor.current = step.cursor;
      },
      onFailure: failure => {
        setReadFailing(true);
        // Une commande qui ne se relit pas ne se saute pas : le site est relu.
        if (failure.cause === 'command') void resync();
      },
    });
    return stop;
  }, [journal, current, resumePending, adopt, resync]);

  const wrap = useCallback((send: Send): Send => (
    journal === undefined ? send : trackOwnWrites(send, cursor, inFlight)
  ), [journal]);

  return { wrap, readFailing };
}
