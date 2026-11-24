/**
 * S6.4 — poser et lever un verrou ferme (migration 0083), côté poste.
 *
 * La base tient le refus : ce module ne fait que demander. Un verrou tenu par
 * un autre revient en 423 ; tout autre échec se dit `failed`, sans que le
 * poste en tire de conclusion sur l'objet.
 */
import type { SinkConfig } from './postgrest-sink.js';
import { bearerToken } from '../auth/access-token.js';

/**
 * Renouvellement du verrou pendant le geste. Constante technique, sous les
 * 60 secondes d'expiration de 0083 (décision Q2 : expiration courte,
 * renouvelée pendant le geste).
 */
export const LOCK_RENEW_MS = 20_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TABLE = /^[a-z][a-z_]{0,62}$/;

export type LockTarget = { readonly table: string; readonly id: string };
export type LockOutcome = 'held' | 'locked' | 'failed';

async function rpc(config: SinkConfig, name: string, target: LockTarget, fetchImpl: typeof fetch, keepalive: boolean) {
  try {
    return await fetchImpl(`${config.url}/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${config.accessToken ?? bearerToken(config.apiKey)}`,
        'Content-Profile': config.schema,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_table: target.table, p_id: target.id }),
      keepalive,
    });
  } catch {
    return null;
  }
}

const valid = (target: LockTarget): boolean => TABLE.test(target.table) && UUID.test(target.id);

/** Pose ou renouvelle le verrou de l'objet. */
export async function acquireLock(
  config: SinkConfig, target: LockTarget, fetchImpl: typeof fetch = fetch,
): Promise<LockOutcome> {
  if (!valid(target)) return 'failed';
  const response = await rpc(config, 'acquire_object_lock', target, fetchImpl, false);
  if (response === null) return 'failed';
  if (response.status === 423) return 'locked';
  return response.ok ? 'held' : 'failed';
}

/** Lève le verrou ; survit à la fermeture de l'onglet. */
export async function releaseLock(
  config: SinkConfig, target: LockTarget, fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (!valid(target)) return;
  await rpc(config, 'release_object_lock', target, fetchImpl, true);
}
