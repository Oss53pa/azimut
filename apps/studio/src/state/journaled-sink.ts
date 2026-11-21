/**
 * S6.2 et S6.6 — l'émetteur du poste en édition simultanée.
 *
 * Il appelle `azimut.apply_journaled_commands` (migration 0078) au lieu de
 * `apply_commands`. La base y applique chaque commande sous la condition de son
 * état `before`, et inscrit au journal du site ce qu'elle a appliqué : c'est ce
 * journal que les autres postes relisent.
 *
 * Deux différences avec `createPostgrestSink` :
 *  · la commande part entière, telle que `serializeCommand` l'écrit. Le journal
 *    la conserve pour les autres postes, qui la relisent par `parseCommand` ;
 *  · un succès rend le dernier numéro du journal et le nombre de commandes
 *    inscrites. Le poste sait ainsi quelles entrées du journal sont les
 *    siennes, sans se fier à l'auteur : un même utilisateur peut avoir deux
 *    postes ouverts.
 *
 * Une commande périmée revient en 409. Le refus le dit par sa cause, comme
 * tout statut ; le message de la base ne remonte pas (A6.1).
 */
import { serializeCommand } from '@azimut/core-model';
import type { EntityCommand, Outcome } from '@azimut/core-model';
import type { CommandSink } from './command-store.js';
import type { SinkConfig } from './postgrest-sink.js';
import { refusal } from './postgrest-sink.js';
import { bearerToken } from '../auth/access-token.js';

/** Ce que la base a inscrit au journal pour un appel réussi. */
export type JournaledWrite = {
  /** Numéro de la dernière commande inscrite. */
  readonly lastSeq: number;
  /** Nombre de commandes inscrites, les numéros `lastSeq - count + 1` à `lastSeq`. */
  readonly count: number;
};

/** Le site et, quand le geste en a un, le niveau de l'écriture. */
export type JournalScope = {
  readonly siteId: string;
  readonly levelId: string | null;
};

export function createJournaledSink(
  config: SinkConfig,
  scope: JournalScope,
  fetchImpl: typeof fetch = fetch,
): CommandSink {
  return async (commands: readonly EntityCommand[]): Promise<Outcome<JournaledWrite | null>> => {
    if (commands.length === 0) return { ok: true, value: null, warnings: [] };

    const wire: unknown[] = [];
    for (const command of commands) {
      const written = serializeCommand(command);
      if (!written.ok) return written;
      wire.push(JSON.parse(written.value) as unknown);
    }

    let response: Response;
    try {
      response = await fetchImpl(`${config.url}/rpc/apply_journaled_commands`, {
        method: 'POST',
        headers: {
          apikey: config.apiKey,
          Authorization: `Bearer ${config.accessToken ?? bearerToken(config.apiKey)}`,
          'Content-Profile': config.schema,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_site_id: scope.siteId,
          p_level_id: scope.levelId,
          p_commands: wire,
        }),
      });
    } catch {
      return { ok: false, findings: [refusal(commands, 'transport')] };
    }

    if (!response.ok) {
      return { ok: false, findings: [refusal(commands, String(response.status))] };
    }

    let lastSeq: unknown;
    try {
      lastSeq = await response.json() as unknown;
    } catch {
      return { ok: false, findings: [refusal(commands, 'response')] };
    }
    if (!Number.isSafeInteger(lastSeq) || (lastSeq as number) < commands.length) {
      return { ok: false, findings: [refusal(commands, 'response')] };
    }
    return {
      ok: true,
      value: { lastSeq: lastSeq as number, count: commands.length },
      warnings: [],
    };
  };
}
