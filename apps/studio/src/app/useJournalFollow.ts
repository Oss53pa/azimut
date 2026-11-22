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
import { useCallback, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { EntityCommand, Outcome } from '@azimut/core-model';
import {
  isJournaledWrite, pollJournal, readJournalHead, readJournalSince, recordOwnWrite, startCursor,
} from '../state/journal-follower.js';
import type { JournalCursor } from '../state/journal-follower.js';
import { applyReceived, canReceive } from '../state/journal-session.js';
import type { SinkConfig } from '../state/postgrest-sink.js';
import type { SessionState } from '../state/session-store.js';

export type JournalBinding = {
  readonly config: SinkConfig;
  readonly siteId: string;
};

type Send = (commands: readonly EntityCommand[]) => Promise<Outcome<unknown>>;

export function useJournalFollow(options: {
  readonly journal: JournalBinding | undefined;
  readonly current: MutableRefObject<SessionState>;
  readonly resumePending: () => boolean;
  readonly adopt: (next: SessionState) => void;
  readonly reload: () => Promise<void>;
}): { readonly wrap: (send: Send) => Send } {
  const { journal, current, resumePending, adopt, reload } = options;
  const cursor = useRef<JournalCursor | null>(null);
  const inFlight = useRef(0);

  const resync = useCallback(async (): Promise<void> => {
    if (journal === undefined) return;
    const head = await readJournalHead(journal.config, journal.siteId);
    if (head === null) return;
    await reload();
    cursor.current = startCursor(journal.siteId, head);
  }, [journal, reload]);

  useEffect(() => {
    if (journal === undefined) return;
    let stop: () => void = () => undefined;
    let live = true;
    void (async () => {
      await resync();
      if (!live || cursor.current === null) return;
      stop = pollJournal({
        read: after => readJournalSince(journal.config, journal.siteId, after),
        cursor: () => cursor.current ?? startCursor(journal.siteId),
        busy: () => inFlight.current > 0,
        onStep: step => {
          if (!canReceive(current.current, resumePending())) return;
          if (step.gap) { void resync(); return; }
          if (step.received.length > 0) adopt(applyReceived(current.current, step.received));
          cursor.current = step.cursor;
        },
        onFailure: failure => {
          // Une commande qui ne se relit pas ne se saute pas : le site est relu.
          if (failure.cause === 'command') void resync();
        },
      });
    })();
    return () => { live = false; stop(); };
  }, [journal, current, resumePending, adopt, resync]);

  const wrap = useCallback((send: Send): Send => {
    if (journal === undefined) return send;
    return async commands => {
      inFlight.current += 1;
      try {
        const out = await send(commands);
        if (out.ok && isJournaledWrite(out.value) && cursor.current !== null) {
          cursor.current = recordOwnWrite(cursor.current, out.value);
        }
        return out;
      } finally {
        inFlight.current -= 1;
      }
    };
  }, [journal]);

  return { wrap };
}
