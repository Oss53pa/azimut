/**
 * A6.3 et O3 : ce que la garde d'authentification montre, déduit de l'état de
 * la session. Pur : aucune requête, aucune horloge.
 *
 * L'ordre est celui du cahier : pas de session, la connexion ; une session
 * dont un rôle exige le second facteur et qui ne l'a pas, l'enrôlement ou la
 * vérification, et rien d'autre ; aucune inscription, un message ; sinon
 * l'atelier, sous la première inscription.
 */
import type { AuthFactor } from './auth-api.js';
import type { Session } from './auth-session.js';
import type { Membership } from './memberships.js';
import { nextAuthStep } from './mfa-requirement.js';
import type { SessionMembership } from '../app/session-identity.js';

export type Loaded =
  | { readonly kind: 'pending' }
  | { readonly kind: 'failed' }
  | { readonly kind: 'done'; readonly factors: readonly AuthFactor[]; readonly memberships: readonly Membership[] };

export type GateView =
  | { readonly kind: 'loading' }
  | { readonly kind: 'signed_out' }
  | { readonly kind: 'second_factor'; readonly mode: 'enroll' | 'verify'; readonly factorId: string | null }
  | { readonly kind: 'read_failed' }
  | { readonly kind: 'no_org' }
  | { readonly kind: 'ready'; readonly membership: SessionMembership };

export function gateView(restoring: boolean, session: Session | null, loaded: Loaded): GateView {
  if (session === null) return restoring ? { kind: 'loading' } : { kind: 'signed_out' };
  if (loaded.kind === 'pending') return { kind: 'loading' };
  if (loaded.kind === 'failed') return { kind: 'read_failed' };

  const step = nextAuthStep(session.aal, loaded.factors, loaded.memberships.map(m => m.role));
  if (step !== 'ready') {
    const verified = loaded.factors.find(f => f.factor_type === 'totp' && f.status === 'verified');
    return { kind: 'second_factor', mode: step, factorId: verified?.id ?? null };
  }
  const first = loaded.memberships[0];
  if (first === undefined) return { kind: 'no_org' };
  return { kind: 'ready', membership: { orgId: first.orgId, role: first.role } };
}
