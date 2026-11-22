/**
 * S6.6b — par quel chemin un écran du site écrit.
 *
 * Sans base configurée : aucun émetteur, la session retombe sur son mode local
 * (M8, partie M, critère 3). Avec une base mais sans identité de session :
 * `apply_commands`, comme avant. Avec une session authentifiée :
 * `apply_journaled_commands`, qui refuse une commande périmée et l'inscrit au
 * journal du site, et la liaison au journal pour recevoir ce que les autres
 * postes écrivent (décisions Q1 à Q4).
 */
import { useMemo } from 'react';
import type { EntityCommand, Outcome } from '@azimut/core-model';
import { useSessionIdentity } from '../auth/identity.js';
import { appSinkConfig } from '../state/app-sink.js';
import { createPostgrestSink } from '../state/postgrest-sink.js';
import { createJournaledSink } from '../state/journaled-sink.js';
import type { JournalBinding } from './useJournalFollow.js';

type Send = (commands: readonly EntityCommand[]) => Promise<Outcome<unknown>>;

export function useSiteWriter(siteId: string, levelId: string): {
  readonly remote: Send | undefined;
  readonly journal: JournalBinding | undefined;
} {
  const { userId } = useSessionIdentity();
  const config = useMemo(() => appSinkConfig(), []);
  // La liaison ne dépend pas du niveau : changer de niveau ne relance pas le
  // suivi du journal du site.
  const journal = useMemo(
    () => (config === null || userId === null ? undefined : { config, siteId }),
    [config, userId, siteId],
  );
  const remote = useMemo((): Send | undefined => {
    if (config === null) return undefined;
    if (journal === undefined) return createPostgrestSink(config);
    return createJournaledSink(config, { siteId, levelId: levelId === '' ? null : levelId });
  }, [config, journal, siteId, levelId]);
  return { remote, journal };
}
