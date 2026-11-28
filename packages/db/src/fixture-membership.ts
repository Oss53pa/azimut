/**
 * Rattachement d'un membre pour un décor d'essai.
 *
 * Depuis 0075, `authenticated` n'a plus aucun droit d'écriture sur
 * `membership` : se rattacher seul à une organisation était la faille, et le
 * mécanisme d'entrée relève de L4.1. Un rattachement est un acte
 * d'exploitation, sous le rôle propriétaire.
 *
 * Le propriétaire reste soumis à `FORCE ROW LEVEL SECURITY`. L'instruction
 * s'écrit donc sous le rôle de décor du banc (`fixture-role.ts`), le temps
 * d'elle seule ; le schéma ne change jamais de posture. Le décor qui suit
 * s'écrit sous l'identité de ses membres, cloisonnement en place.
 *
 * Ce n'est pas un parcours applicatif et rien hors des essais ne l'appelle.
 */

import type { SqlRunner } from './fixture-cleanup.js';
import { asFixture } from './fixture-role.js';

export interface FixtureMember {
  readonly orgId: string;
  readonly userId: string;
  readonly role: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLE = /^[a-z_]+$/;

function uuid(id: string): string {
  if (!UUID.test(id)) throw new Error(`identifiant invalide : ${id}`);
  return `'${id}'`;
}

function pair(member: Pick<FixtureMember, 'orgId' | 'userId'>): string {
  return `(${uuid(member.orgId)},${uuid(member.userId)})`;
}

function row(member: FixtureMember): string {
  if (!ROLE.test(member.role)) throw new Error(`rôle invalide : ${member.role}`);
  return `(${uuid(member.orgId)},${uuid(member.userId)},'${member.role}')`;
}

async function asFixtureRole(run: SqlRunner, statement: string): Promise<void> {
  await run(asFixture(statement));
}

/** Rattache des membres, sans effet sur un rattachement déjà présent. */
export async function enrolFixtureMembers(
  run: SqlRunner,
  members: readonly FixtureMember[],
): Promise<void> {
  if (members.length === 0) return;
  await asFixtureRole(run, `insert into azimut.membership(org_id,user_id,role)
    values ${members.map(row).join(',')} on conflict do nothing`);
}

/** Retire des rattachements, comme le ferait le départ d'un membre. */
export async function withdrawFixtureMembers(
  run: SqlRunner,
  members: readonly Pick<FixtureMember, 'orgId' | 'userId'>[],
): Promise<void> {
  if (members.length === 0) return;
  await asFixtureRole(run, `delete from azimut.membership
    where (org_id, user_id) in (${members.map(pair).join(',')})`);
}
