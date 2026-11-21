-- Retour de 0080 : la double authentification n'est plus exigée en base.
--
-- Aucune ligne n'est touchée : des politiques retirées, d'autres rendues à
-- leur expression de 0079, deux fonctions retirées (A2.2, point 7).
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT c.relname, pol.polname
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'azimut' AND pol.polname = c.relname || '_mfa_required'
  LOOP
    EXECUTE format('DROP POLICY %I ON azimut.%I', p.polname, p.relname);
  END LOOP;
END;
$$;

-- Les politiques des tables en insertion seule, telles que 0079 les a laissées.

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

DROP FUNCTION IF EXISTS azimut.org_ids_lacking_mfa();
DROP FUNCTION IF EXISTS azimut.session_meets_mfa();
