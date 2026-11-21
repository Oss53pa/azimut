-- A5.1 et A6.2 — le septième rôle, `marketing`, et ce qu'il ne peut pas.
--
-- A5.1 : « role in ('admin','designer','owner_rep','vendor','operator',
-- 'auditor','marketing') ». La contrainte posée en 0002 n'en portait que six :
-- le rôle n'existait pas en base, et un rattachement `marketing` était refusé.
--
-- L'ajouter sans plus serait pire que l'absence. Sous le cloisonnement
-- générique, un membre lit et écrit tout ce que son organisation possède : un
-- `marketing` aurait les droits d'un `designer`. A6.2 lui donne au contraire
-- « campagnes, promotions et événements, et inscriptions au programme de
-- fidélité de son site, section P9. Aucun accès aux autres modules. » Le
-- module de P9 n'est pas construit. Le rôle entre donc avec un refus total :
-- une politique restrictive par table portant `org_id`, lue dans le catalogue
-- comme celles de l'`auditor` (0076).
--
-- Une exception : `membership`, dont la lecture de ses propres rattachements
-- est ce dont `user_org_ids()` a besoin. Elle n'y écrit rien de toute façon
-- (0075).
--
-- Les cinq tables en insertion seule — les quatre d'A12.3 et `command_journal`
-- (0078) — ne portent, par construction, qu'une politique de lecture et une
-- d'insertion, et aucune qui vaille pour toutes les commandes. Comme pour
-- l'`auditor` en 0076, le refus y est porté par ces deux politiques mêmes.
--
-- Une table créée après cette migration ne reçoit pas la politique d'elle-même.
-- Un essai le vérifie dans le catalogue et fait échouer la suite.
--
-- Additive : une contrainte élargie, des politiques ajoutées, aucune ligne
-- touchée (A2.2, point 7).

ALTER TABLE azimut.membership DROP CONSTRAINT membership_role_check;
ALTER TABLE azimut.membership ADD CONSTRAINT membership_role_check
  CHECK (role IN ('admin','designer','owner_rep','vendor','operator','auditor','marketing'));

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
      'USING (org_id NOT IN (SELECT azimut.user_org_ids_with_role(''{marketing}''))) '
      'WITH CHECK (org_id NOT IN (SELECT azimut.user_org_ids_with_role(''{marketing}'')))',
      t || '_marketing_no_access', t);
  END LOOP;
END;
$$;

-- `organization` porte sa clé en `id`, pas en `org_id`.
CREATE POLICY organization_marketing_no_access ON azimut.organization
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (id NOT IN (SELECT azimut.user_org_ids_with_role('{marketing}')))
  WITH CHECK (id NOT IN (SELECT azimut.user_org_ids_with_role('{marketing}')));

-- ── Les tables en insertion seule : le refus dans leurs deux politiques ────

ALTER POLICY approval_org_select ON azimut.approval
  USING (org_id IN (SELECT azimut.user_org_ids())
         AND org_id NOT IN (SELECT azimut.user_org_ids_with_role('{marketing}')));
ALTER POLICY approval_org_insert ON azimut.approval
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids_with_role('{owner_rep}'))
              AND reviewer_id = azimut.current_user_id()
              AND org_id NOT IN (SELECT azimut.user_org_ids_with_role('{marketing}')));

ALTER POLICY audit_log_org_select ON azimut.audit_log
  USING (org_id IN (SELECT azimut.user_org_ids())
         AND org_id NOT IN (SELECT azimut.user_org_ids_with_role('{marketing}')));
ALTER POLICY audit_log_org_insert ON azimut.audit_log
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids())
              AND org_id NOT IN (SELECT azimut.user_org_ids_with_role('{auditor}'))
              AND actor_id = azimut.current_user_id()
              AND org_id NOT IN (SELECT azimut.user_org_ids_with_role('{marketing}')));

ALTER POLICY graph_validation_org_select ON azimut.graph_validation
  USING (org_id IN (SELECT azimut.user_org_ids())
         AND org_id NOT IN (SELECT azimut.user_org_ids_with_role('{marketing}')));
ALTER POLICY graph_validation_org_insert ON azimut.graph_validation
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids())
              AND org_id NOT IN (SELECT azimut.user_org_ids_with_role('{auditor}'))
              AND org_id NOT IN (SELECT azimut.user_org_ids_with_role('{marketing}')));

ALTER POLICY message_schedule_approval_org_select ON azimut.message_schedule_approval
  USING (org_id IN (SELECT azimut.user_org_ids())
         AND org_id NOT IN (SELECT azimut.user_org_ids_with_role('{marketing}')));
ALTER POLICY message_schedule_approval_org_insert ON azimut.message_schedule_approval
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids_with_role('{owner_rep}'))
              AND user_id = azimut.current_user_id()
              AND org_id NOT IN (SELECT azimut.user_org_ids_with_role('{marketing}')));

ALTER POLICY command_journal_org_select ON azimut.command_journal
  USING (org_id IN (SELECT azimut.user_org_ids())
         AND org_id NOT IN (SELECT azimut.user_org_ids_with_role('{marketing}')));
ALTER POLICY command_journal_org_insert ON azimut.command_journal
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids())
              AND author_id = azimut.current_user_id()
              AND org_id NOT IN (SELECT azimut.user_org_ids_with_role('{marketing}')));
