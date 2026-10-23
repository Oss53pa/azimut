/**
 * Les inscriptions de l'utilisateur connecté, lues par l'API sous son jeton.
 *
 * En `aal1`, un `admin` ou un `owner_rep` ne voit que sa propre inscription
 * (0080) : c'est ce qui permet au studio de savoir qu'il doit enrôler ou
 * vérifier un second facteur. Chaque ligne est validée (A6.3) ; une ligne qui
 * n'a pas la forme attendue fait échouer la lecture, elle n'est pas écartée en
 * silence.
 */
import { z } from 'zod';
import { query } from '../data/postgrest-http.js';
import type { PostgrestConfig } from '../data/postgrest-http.js';

const MEMBER_ROLES = ['admin', 'designer', 'owner_rep', 'vendor', 'operator', 'auditor', 'marketing'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

const Membership = z.object({ org_id: z.uuid(), role: z.enum(MEMBER_ROLES) }).strict();
export type Membership = { readonly orgId: string; readonly role: MemberRole };

export async function readMemberships(config: PostgrestConfig, userId: string): Promise<readonly Membership[]> {
  const parsedId = z.uuid().parse(userId);
  const rows = await query<unknown>(
    config, 'membership', `select=org_id,role&user_id=eq.${parsedId}&order=org_id`);
  return rows.map(row => {
    const m = Membership.parse(row);
    return { orgId: m.org_id, role: m.role };
  });
}
