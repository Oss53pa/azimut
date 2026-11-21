/**
 * AUTH.4 — lire les rattachements de l'utilisateur connecté.
 *
 * La base ne laisse lire à chacun que ses propres rattachements (0075) ; le
 * filtre sur l'utilisateur n'est donc pas une protection, il rend la requête
 * explicite. L'identifiant est vérifié avant d'entrer dans la requête.
 */
import { query, queryIn } from '../data/postgrest-http.js';
import type { PostgrestConfig } from '../data/postgrest-http.js';
import { membershipsFrom } from './identity.js';
import type { Membership } from './identity.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Les rattachements, ou `null` si la lecture a échoué ou rendu une forme inattendue. */
export async function loadMemberships(
  config: PostgrestConfig,
  userId: string,
): Promise<readonly Membership[] | null> {
  if (!UUID.test(userId)) return null;
  try {
    const rows = await query<unknown>(config, 'membership', `select=org_id,role&user_id=eq.${userId}`);
    const ids = rows.flatMap(row => {
      const id = typeof row === 'object' && row !== null ? (row as Record<string, unknown>)['org_id'] : null;
      return typeof id === 'string' && UUID.test(id) ? [id] : [];
    });
    const organizations = await queryIn<unknown>(config, 'organization', 'id', ids);
    return membershipsFrom(rows, organizations);
  } catch {
    return null;
  }
}
