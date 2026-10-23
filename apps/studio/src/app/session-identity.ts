/**
 * L'identité sous laquelle le parcours s'exécute.
 *
 * Connecté, c'est l'inscription de l'utilisateur (A6.3) : son organisation et
 * son rôle, posés par la garde d'authentification une fois la session ouverte
 * et le second facteur vérifié. Sans service configuré, le studio sert les
 * sites de référence sous une identité nommée ici plutôt que devinée à chaque
 * écran.
 *
 * Le cloisonnement réel reste tenu par la base (A6.1) : ces valeurs ne le
 * remplacent pas. Ni l'une ni l'autre n'est un secret ni une donnée client, au
 * sens d'A2.4.
 */
import type { ScheduleActor } from '../state/message-schedule-permissions.js';

/** L'organisation des sites de référence. */
export const REFERENCE_ORG = '00000000-0000-4000-8000-000000000001';

/**
 * Le rôle de consultation des sites de référence, au sens de la table R2 de
 * la partie R : `designer`, celui des écrans de l'atelier. R2 lui donne la
 * consultation et l'export du tableau des messages, et lui refuse
 * l'approbation : « celui qui génère ne peut pas approuver ».
 */
export const REFERENCE_ACTOR: ScheduleActor = 'designer';

export type SessionMembership = { readonly orgId: string; readonly role: ScheduleActor };

let membership: SessionMembership | null = null;

/** Posé par la garde d'authentification ; `null` à la fermeture de la session. */
export function setSessionMembership(next: SessionMembership | null): void {
  membership = next;
}

/** L'organisation de la session. */
export function orgOfSession(): string {
  return membership?.orgId ?? REFERENCE_ORG;
}

/** Le rôle de la session. */
export function actorOfSession(): ScheduleActor {
  return membership?.role ?? REFERENCE_ACTOR;
}
