/**
 * D-10 de l'audit (A12.3) : le propriétaire des tables n'est endossable par
 * aucun rôle de connexion de l'application.
 *
 * Le propriétaire d'une table peut en retirer les barrières : déclencheurs,
 * politiques, droits. L'insertion seule d'A12.3 ne tient donc « pour aucun
 * rôle » que si l'application ne peut pas devenir ce propriétaire. Le contrôle
 * rend `<rôle> owner <propriétaire>` pour chaque rôle de l'application qui est
 * membre du propriétaire du schéma ou d'une de ses relations, dans un ordre
 * stable (A9).
 */
import type { SqlReader } from './fixture-cleanup.js';

/**
 * Les rôles sous lesquels l'application se connecte ou bascule : PostgREST
 * (`authenticator`, puis `anon` ou `authenticated`) et le compilateur.
 */
export const APPLICATION_ROLES = [
  'authenticator', 'anon', 'authenticated', 'azimut_compiler', 'azimut_job_dispatch',
] as const;

const NAME = /^[a-z_][a-z0-9_]*$/;

export async function ownershipGaps(
  read: SqlReader,
  roles: readonly string[] = APPLICATION_ROLES,
): Promise<readonly string[]> {
  if (!roles.every(r => NAME.test(r))) throw new Error('nom de rôle invalide');
  const list = roles.map(r => `'${r}'`).join(',');
  const rows = await read(`
    with owners as (
      select c.relowner as owner from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'azimut' and c.relkind in ('r','p','v','m','S')
      union
      select n.nspowner from pg_namespace n where n.nspname = 'azimut'
    )
    select distinct r.rolname || ' owner ' || pg_get_userbyid(o.owner) as gap
    from owners o
    join pg_roles r on r.rolname in (${list})
    where pg_has_role(r.oid, o.owner, 'MEMBER')
    order by 1`);
  return rows.map(row => String(row['gap']));
}
