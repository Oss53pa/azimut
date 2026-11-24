/**
 * S6.6c — la coquille suit le journal du site ouvert.
 *
 * Les écrans de la coquille (fermetures, faces, blocs libres) lisent le site
 * entier depuis le dépôt et ne tiennent pas de session de commandes : ce
 * qu'un autre poste écrit ne se rejoue donc pas sur eux, le site se relit.
 * C'est le même partage qu'en S6.6b, sans l'application fine :
 *  · avec une session authentifiée, l'émetteur est `apply_journaled_commands`,
 *    qui refuse une commande périmée ;
 *  · le dernier numéro du journal est lu avant toute relecture du site ;
 *  · une interrogation qui rapporte une écriture d'un autre poste, un trou ou
 *    une commande illisible relit le site, sans passer par « chargement ».
 *
 * Sans base configurée, aucun émetteur. Avec une base mais sans identité, le
 * chemin d'avant (`apply_commands`), et aucun suivi : le journal est lu sous
 * l'identité du membre.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSessionIdentity } from '../auth/identity.js';
import { appSinkConfig } from './app-sink.js';
import type { CommandSink } from './command-store.js';
import { createJournaledSink } from './journaled-sink.js';
import {
  pollJournal, readJournalHead, readJournalSince, startCursor, trackOwnWrites,
} from './journal-follower.js';
import type { JournalCursor, JournalEntry } from './journal-follower.js';
import { createPostgrestSink } from './postgrest-sink.js';
import type { SinkConfig } from './postgrest-sink.js';

export function useShellJournal(siteId: string, refresh: () => void): {
  readonly sink: CommandSink | null;
  /** S6.4 — la configuration du verrou ferme, quand la session est suivie. */
  readonly lockConfig: SinkConfig | null;
  /** S6.5 — les commandes reçues depuis la dernière relecture prise en compte. */
  readonly received: readonly JournalEntry[];
  /** Les déclare prises en compte. */
  readonly clearReceived: () => void;
} {
  const { userId } = useSessionIdentity();
  const config = useMemo(() => appSinkConfig(), []);
  const followed = config !== null && userId !== null && siteId !== '';
  const cursor = useRef<JournalCursor | null>(null);
  const inFlight = useRef(0);
  const [received, setReceived] = useState<readonly JournalEntry[]>([]);
  const clearReceived = useCallback(() => { setReceived([]); }, []);

  const sink = useMemo((): CommandSink | null => {
    if (config === null) return null;
    if (!followed) return createPostgrestSink(config);
    return trackOwnWrites(createJournaledSink(config, { siteId, levelId: null }), cursor, inFlight);
  }, [config, followed, siteId]);

  // Relit le site après avoir lu la tête : une écriture inscrite entre les
  // deux est dans le site relu et dans la suite du journal, et la relecture
  // qu'elle provoque ne change rien.
  const resync = useCallback(async (): Promise<void> => {
    if (config === null) return;
    const head = await readJournalHead(config, siteId);
    if (head === null) return;
    cursor.current = startCursor(siteId, head);
    refresh();
  }, [config, siteId, refresh]);

  useEffect(() => {
    if (config === null || !followed) return;
    cursor.current = null;
    // Tant qu'aucun curseur n'est posé, chaque interrogation retente la
    // relecture : le site déjà chargé a pu l'être avant une écriture que la
    // tête, lue maintenant, compterait.
    const stop = pollJournal({
      read: async after => {
        if (cursor.current === null) {
          await resync();
          return { ok: true, entries: [] };
        }
        return readJournalSince(config, siteId, after);
      },
      cursor: () => cursor.current ?? startCursor(siteId),
      busy: () => inFlight.current > 0,
      onStep: step => {
        if (cursor.current === null) return;
        if (step.gap) { void resync(); return; }
        cursor.current = step.cursor;
        if (step.received.length > 0) {
          setReceived(previous => [...previous, ...step.received]);
          refresh();
        }
      },
      onFailure: failure => {
        if (failure.cause === 'command') void resync();
      },
    });
    return stop;
  }, [followed, config, siteId, resync, refresh]);

  return { sink, lockConfig: followed ? config : null, received, clearReceived };
}
