/**
 * Provisionnement d'une organisation et de son premier administrateur.
 *
 * C'est le pas 4 de la mise en place (`docs/note-base-studio-deploye.md`) :
 * « créer la première organisation et la première inscription de son
 * administrateur ». Il se joue sous `azimut_membership_admin` (0075), le rôle
 * qui possède l'administration des membres, et non en levant le
 * cloisonnement : aucune politique n'est retirée, aucune table n'est soustraite
 * à FORCE.
 *
 * L'identifiant est imposé, ce qui permet à un décor d'essai de se retirer par
 * identifiant (`deleteOrgFixture`). L'application, elle, crée une organisation
 * par `azimut.create_organization`, qui tire l'identifiant elle-même : un
 * identifiant choisi par un appelant pourrait révéler, par collision, qu'une
 * organisation d'autrui existe (A6.1).
 *
 * Les membres suivants passent par `azimut.set_member`, sous l'identité de cet
 * administrateur, comme dans l'application.
 */
import type { SqlRunner } from './fixture-cleanup.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;

export interface OrganizationProvision {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly adminId: string;
}

/** Les requêtes de provisionnement, dans l'ordre. Pur : vérifiable sans base. */
export function provisionStatements(p: OrganizationProvision): readonly string[] {
  if (!UUID.test(p.id)) throw new Error(`identifiant d'organisation invalide : ${p.id}`);
  if (!UUID.test(p.adminId)) throw new Error(`identifiant d'administrateur invalide : ${p.adminId}`);
  if (!SLUG.test(p.slug)) throw new Error(`slug invalide : ${p.slug}`);
  const name = p.name.replaceAll("'", "''");
  return [
    'set local role azimut_membership_admin',
    `insert into azimut.organization(id, name, slug) values ('${p.id}', '${name}', '${p.slug}')`,
    `insert into azimut.membership(org_id, user_id, role) values ('${p.id}', '${p.adminId}', 'admin')`,
    'reset role',
  ];
}

/**
 * Exécute le provisionnement. `run` doit tourner dans une transaction, pour que
 * `set local role` ne survive pas à l'appel.
 */
export async function provisionOrganization(run: SqlRunner, p: OrganizationProvision): Promise<void> {
  for (const text of provisionStatements(p)) await run(text);
}
