-- A6.3 et O3 — la double authentification exigée en base pour `admin` et
-- `owner_rep` (AUTH.5, `docs/decoupage-authentification.md`).
--
-- A6.3 : « Double authentification obligatoire pour `admin` et `owner_rep`. »
-- O3 : « Un compte de ces rôles sans double authentification enrôlée ne peut
-- rien faire d'autre que l'enrôler. » Un garde dans l'interface se contourne
-- en appelant l'API directement ; il est donc porté par la base.
--
-- Le jeton délivré par le service d'authentification porte son niveau
-- d'assurance, `aal` : `aal1` après la seule phrase de passe, `aal2` après le
-- second facteur (AUTH.2 l'a éprouvé). PostgREST pose ce jeton dans
-- `request.jwt.claims`. L'enrôlement et la vérification du facteur passent
-- par le service, hors du schéma d'Azimut : refuser tout le schéma à une
-- session `aal1` laisse donc exactement ce qu'O3 permet.
--
-- Le refus porte sur l'organisation où le membre tient l'un de ces rôles, pas
-- sur l'utilisateur : `designer` ailleurs, il y garde ses droits en `aal1`.
--
-- Une session serveur — connexion directe qui pose `azimut.current_user_id`,
-- comme l'exploitation, le service de compilation et les essais — n'est pas
-- concernée. Elle n'a pas de jeton, et elle peut déjà se donner n'importe
-- quelle identité : exiger d'elle un second facteur ne protégerait rien.
-- PostgREST ne peut pas poser ce réglage.
--
-- Même construction que les refus du rôle `marketing` (0079) : une politique
-- restrictive par table portant `org_id`, sauf `membership`, et le refus porté
-- par les deux politiques des cinq tables en insertion seule.
--
-- Additive : une fonction, des politiques, aucune ligne touchée (A2.2, point 7).

CREATE FUNCTION azimut.session_meets_mfa()
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN nullif(current_setting('azimut.current_user_id', true), '') IS NOT NULL THEN true
    ELSE coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::json ->> 'aal', ''
    ) = 'aal2'
  END;
$$;

GRANT EXECUTE ON FUNCTION azimut.session_meets_mfa() TO authenticated, anon;

-- Les organisations où la session doit avoir le second facteur et ne l'a pas.
CREATE FUNCTION azimut.org_ids_lacking_mfa()
RETURNS SETOF uuid
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT id FROM azimut.user_org_ids_with_role('{admin,owner_rep}') AS id
  WHERE NOT azimut.session_meets_mfa();
$$;

GRANT EXECUTE ON FUNCTION azimut.org_ids_lacking_mfa() TO authenticated, anon;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'org_id' AND NOT a.attisdropped
    WHERE n.nspname = 'azimut' AND c.relkind IN ('r', 'p')
      AND c.relname NOT IN ('membership', 'approval', 'audit_log', 'graph_validation',
                            'message_schedule_approval', 'command_journal')
    ORDER BY c.relname
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON azimut.%I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING (org_id NOT IN (SELECT azimut.org_ids_lacking_mfa())) '
      'WITH CHECK (org_id NOT IN (SELECT azimut.org_ids_lacking_mfa()))',
      t || '_mfa_required', t);
  END LOOP;
END;
$$;

CREATE POLICY organization_mfa_required ON azimut.organization
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (id NOT IN (SELECT azimut.org_ids_lacking_mfa()))
  WITH CHECK (id NOT IN (SELECT azimut.org_ids_lacking_mfa()));

-- ── Les tables en insertion seule ─────────────────────────────────────────

ALTER POLICY approval_org_select ON azimut.approval
  USING (org_id IN (SELECT azimut.user_org_ids())
         AND org_id NOT IN (SELECT azimut.user_org_ids_with_role('{marketing}'))
         AND org_id NOT IN (SELECT azimut.org_ids_lacking_mfa()));
ALTER POLICY approval_org_insert ON azimut.approval
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids_with_role('{owner_rep}'))
              AND reviewer_id = azimut.current_user_id()
              AND org_id NOT IN (SELECT azimut.user_org_ids_with_role('{marketing}'))
              AND org_id NOT IN (SELECT azimut.org_ids_lacking_mfa()));

ALTER POLICY audit_log_org_select ON azimut.audit_log
  USING (org_id IN (SELECT azimut.user_org_ids())
         AND org_id NOT IN (SELECT azimut.user_org_ids_with_role('{marketing}'))
         AND org_id NOT IN (SELECT azimut.org_ids_lacking_mfa()));
ALTER POLICY audit_log_org_insert ON azimut.audit_log
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids())
              AND org_id NOT IN (SELECT azimut.user_org_ids_with_role('{auditor}'))
              AND actor_id = azimut.current_user_id()
              AND org_id NOT IN (SELECT azimut.user_org_ids_with_role('{marketing}'))
              AND org_id NOT IN (SELECT azimut.org_ids_lacking_mfa()));

ALTER POLICY graph_validation_org_select ON azimut.graph_validation
  USING (org_id IN (SELECT azimut.user_org_ids())
         AND org_id NOT IN (SELECT azimut.user_org_ids_with_role('{marketing}'))
         AND org_id NOT IN (SELECT azimut.org_ids_lacking_mfa()));
ALTER POLICY graph_validation_org_insert ON azimut.graph_validation
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids())
              AND org_id NOT IN (SELECT azimut.user_org_ids_with_role('{auditor}'))
              AND org_id NOT IN (SELECT azimut.user_org_ids_with_role('{marketing}'))
              AND org_id NOT IN (SELECT azimut.org_ids_lacking_mfa()));

ALTER POLICY message_schedule_approval_org_select ON azimut.message_schedule_approval
  USING (org_id IN (SELECT azimut.user_org_ids())
         AND org_id NOT IN (SELECT azimut.user_org_ids_with_role('{marketing}'))
         AND org_id NOT IN (SELECT azimut.org_ids_lacking_mfa()));
ALTER POLICY message_schedule_approval_org_insert ON azimut.message_schedule_approval
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids_with_role('{owner_rep}'))
              AND user_id = azimut.current_user_id()
              AND org_id NOT IN (SELECT azimut.user_org_ids_with_role('{marketing}'))
              AND org_id NOT IN (SELECT azimut.org_ids_lacking_mfa()));

ALTER POLICY command_journal_org_select ON azimut.command_journal
  USING (org_id IN (SELECT azimut.user_org_ids())
         AND org_id NOT IN (SELECT azimut.user_org_ids_with_role('{marketing}'))
         AND org_id NOT IN (SELECT azimut.org_ids_lacking_mfa()));
ALTER POLICY command_journal_org_insert ON azimut.command_journal
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids())
              AND author_id = azimut.current_user_id()
              AND org_id NOT IN (SELECT azimut.user_org_ids_with_role('{marketing}'))
              AND org_id NOT IN (SELECT azimut.org_ids_lacking_mfa()));
