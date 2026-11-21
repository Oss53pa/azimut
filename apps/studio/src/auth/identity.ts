/**
 * AUTH.4 — l'identité sous laquelle le poste écrit : l'organisation et le
 * rôle de l'utilisateur connecté, lus dans ses rattachements.
 *
 * Jusqu'ici, l'organisation et le rôle étaient écrits en dur
 * (`app/session-identity.ts`). Ils le restent pour le mode local, sans base ni
 * service d'authentification, où les sites de référence appartiennent à cette
 * organisation. Avec une session, ils viennent de `membership`, que la base
 * ne laisse lire à chacun que pour lui-même (0075).
 *
 * Le rôle n'ouvre rien par lui-même : il règle ce que l'écran propose, et la
 * base décide (A6.1, A6.2, 0076).
 */
import { createContext, useContext } from 'react';
import { codePointCompare } from '@azimut/core-model';
import { isScheduleActor } from '../state/message-schedule-permissions.js';
import type { ScheduleActor } from '../state/message-schedule-permissions.js';
import { ACTOR_OF_SESSION, ORG_OF_SESSION } from '../app/session-identity.js';

export type SessionIdentity = {
  /** L'utilisateur connecté, ou `null` en mode local. */
  readonly userId: string | null;
  readonly orgId: string;
  readonly actor: ScheduleActor;
};

/** L'identité du mode local : celle des sites de référence. */
export const LOCAL_IDENTITY: SessionIdentity = {
  userId: null, orgId: ORG_OF_SESSION, actor: ACTOR_OF_SESSION,
};

export const SessionIdentityContext = createContext<SessionIdentity>(LOCAL_IDENTITY);

export function useSessionIdentity(): SessionIdentity {
  return useContext(SessionIdentityContext);
}

/** Les sept rôles d'un rattachement (A5.1) : le relecteur externe d'O7 n'en est pas un. */
export type MembershipRole = Exclude<ScheduleActor, 'external_reviewer'>;

/** Un rattachement de l'utilisateur, avec le nom de son organisation. */
export type Membership = {
  readonly orgId: string;
  readonly orgName: string;
  readonly role: MembershipRole;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Les rattachements, tels que la base les rend. Une ligne de forme inattendue
 * fait échouer la lecture au lieu d'être écartée : écarter un rattachement
 * en silence ferait travailler sous une autre organisation que la sienne.
 */
export function membershipsFrom(
  rows: readonly unknown[],
  organizations: readonly unknown[],
): readonly Membership[] | null {
  const names = new Map<string, string>();
  for (const org of organizations) {
    if (typeof org !== 'object' || org === null) return null;
    const { id, name } = org as Record<string, unknown>;
    if (typeof id !== 'string' || typeof name !== 'string') return null;
    names.set(id, name);
  }
  const out: Membership[] = [];
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) return null;
    const { org_id: orgId, role } = row as Record<string, unknown>;
    if (typeof orgId !== 'string' || !UUID.test(orgId)) return null;
    if (typeof role !== 'string' || !isScheduleActor(role) || role === 'external_reviewer') return null;
    const membershipRole: MembershipRole = role;
    out.push({ orgId, orgName: names.get(orgId) ?? '', role: membershipRole });
  }
  return out.sort((a, b) => codePointCompare(a.orgName, b.orgName) || codePointCompare(a.orgId, b.orgId));
}

/** L'identité sous un rattachement choisi. */
export function identityOf(userId: string, membership: Membership): SessionIdentity {
  return { userId, orgId: membership.orgId, actor: membership.role };
}
