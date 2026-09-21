/**
 * L'émetteur de commandes du poste (F15, `state/`).
 *
 * Le magasin ne sait pas écrire : il reçoit un émetteur (lot 1.2). Celui-ci
 * appelle `azimut.apply_commands`, la fonction de base posée par la migration
 * 0026, qui applique la suite en une transaction.
 *
 * Trois choses restent chez la base, et aucune ne remonte ici :
 *  · le cloisonnement, tenu par les politiques (A6.1) ;
 *  · l'atomicité, tenue par la transaction — M1 (partie M) interdit qu'un site
 *    naisse sans niveau, et trois requêtes séparées le permettraient ;
 *  · la décision de refus, que cette fonction ne réinterprète pas.
 */
import type { EntityCommand, Outcome, Finding } from '@azimut/core-model';
import type { CommandSink } from './command-store.js';

export type SinkConfig = {
  /** Racine de l'API PostgREST. */
  readonly url: string;
  readonly apiKey: string;
  readonly schema: string;
  /** Jeton de session, quand il y en a un. */
  readonly accessToken?: string | undefined;
};

/**
 * Construit l'émetteur. `fetchImpl` est injectable pour que l'essai n'ait
 * besoin ni de réseau ni de base.
 */
export function createPostgrestSink(
  config: SinkConfig,
  fetchImpl: typeof fetch = fetch,
): CommandSink {
  return async (commands: readonly EntityCommand[]): Promise<Outcome<unknown>> => {
    if (commands.length === 0) return { ok: true, value: null, warnings: [] };

    const body = JSON.stringify({ commands: commands.map(toPayload) });
    let response: Response;
    try {
      response = await fetchImpl(`${config.url}/rpc/apply_commands`, {
        method: 'POST',
        headers: {
          apikey: config.apiKey,
          Authorization: `Bearer ${config.accessToken ?? config.apiKey}`,
          'Content-Profile': config.schema,
          'Content-Type': 'application/json',
        },
        body,
      });
    } catch {
      return { ok: false, findings: [refusal(commands, 'transport')] };
    }

    if (!response.ok) {
      // Le message de la base ne remonte pas. A6.1 : aucune ligne d'une autre
      // organisation ne doit être détectable, « y compris par message
      // d'erreur ». Seul le statut, qui ne dit rien du contenu, est conservé.
      return { ok: false, findings: [refusal(commands, String(response.status))] };
    }

    return { ok: true, value: null, warnings: [] };
  };
}

/**
 * La forme que la fonction de base attend : l'opération, la table, la ligne, et
 * les deux états. Le module et l'horodatage restent au poste — la base ne les
 * lit pas, et les envoyer laisserait croire qu'elle s'en sert.
 */
function toPayload(command: EntityCommand) {
  return {
    operation: command.operation,
    table: command.table,
    id: command.id,
    ...(command.before !== null ? { before: command.before } : {}),
    ...(command.after !== null ? { after: command.after } : {}),
  };
}

function refusal(commands: readonly EntityCommand[], cause: string): Finding {
  const first = commands[0];
  return {
    code: 'EDIT.WRITE_REFUSED',
    severity: 'blocking',
    entity: first !== undefined ? { kind: 'command', id: first.id } : null,
    params: { commands: commands.length, cause },
    ruleRef: 'A6.1',
  };
}
