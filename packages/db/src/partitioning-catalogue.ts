/**
 * A6.1 et T-0.6 : le contrôle de catalogue, lu sur la base migrée.
 *
 * Le contrôle de `a6-1-org-partitioning.test.ts` lit le texte des migrations :
 * il ne voit ni une politique retirée plus tard, ni une politique ouverte à
 * tous, ni un `org_id` ajouté par `ALTER`. Celui-ci lit le catalogue, et rend
 * chaque écart sous la forme `<objet> <écart>`, dans un ordre stable (A9) :
 *
 *  - `<table> rls`, `<table> force` : sécurité par ligne non activée ou non
 *    forcée sur une table portant `org_id` ;
 *  - `<table> policy` : aucune politique permissive adressée à
 *    `authenticated` ;
 *  - `<table> open-policy <nom>` : une politique permissive, adressée à
 *    `authenticated` ou à tous, dont la condition est `true` ;
 *  - `<table> fk <nom>` : une clé étrangère vers une autre table portant
 *    `org_id` qui ne passe pas par `(org_id, id)` (0076) ;
 *  - `function <nom> search_path` : une fonction SECURITY DEFINER du schéma
 *    sans chemin de recherche figé ;
 *  - `_migrations grant <rôle>` : le registre des migrations accorde un droit
 *    à `authenticated`, à `anon` ou à tous.
 */
import type { SqlReader } from './fixture-cleanup.js';

const ORG_TABLES = `
  select c.oid, c.relname, c.relrowsecurity, c.relforcerowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attname = 'org_id' and not a.attisdropped
  where n.nspname = 'azimut' and c.relkind in ('r','p')`;

const TABLE_GAPS = `
  with t as (${ORG_TABLES})
  select t.relname || ' rls' as gap from t where not t.relrowsecurity
  union all
  select t.relname || ' force' from t where not t.relforcerowsecurity
  union all
  select t.relname || ' policy' from t
  where not exists (
    select 1 from pg_policy p
    where p.polrelid = t.oid and p.polpermissive
      and 'authenticated'::regrole = any (p.polroles))
  union all
  select t.relname || ' open-policy ' || p.polname from t
  join pg_policy p on p.polrelid = t.oid and p.polpermissive
  where (0::oid = any (p.polroles) or 'authenticated'::regrole = any (p.polroles))
    and (pg_get_expr(p.polqual, p.polrelid) = 'true'
         or pg_get_expr(p.polwithcheck, p.polrelid) = 'true')`;

const FK_GAPS = `
  with t as (${ORG_TABLES})
  select src.relname || ' fk ' || c.conname as gap
  from pg_constraint c
  join t src on src.oid = c.conrelid
  join t dst on dst.oid = c.confrelid
  where c.contype = 'f'
    and not (
      cardinality(c.conkey) = 2
      and (select attname from pg_attribute where attrelid = c.conrelid and attnum = c.conkey[1]) = 'org_id'
      and (select attname from pg_attribute where attrelid = c.confrelid and attnum = c.confkey[1]) = 'org_id'
      and (select attname from pg_attribute where attrelid = c.confrelid and attnum = c.confkey[2]) = 'id')`;

const FUNCTION_GAPS = `
  select 'function ' || p.proname || ' search_path' as gap
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'azimut' and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) s where s like 'search_path=%')`;

const REGISTRY_GAPS = `
  select '_migrations grant ' || coalesce(r.rolname, 'public') as gap
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl
  left join pg_roles r on r.oid = acl.grantee
  where n.nspname = 'azimut' and c.relname = '_migrations'
    and (acl.grantee = 0 or r.rolname in ('authenticated','anon'))
  group by r.rolname`;

export async function partitioningGaps(read: SqlReader): Promise<readonly string[]> {
  const gaps: string[] = [];
  for (const query of [TABLE_GAPS, FK_GAPS, FUNCTION_GAPS, REGISTRY_GAPS]) {
    for (const row of await read(query)) gaps.push(String(row['gap']));
  }
  return gaps.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
