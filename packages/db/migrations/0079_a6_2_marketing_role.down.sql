-- Retour de 0079 : le rôle `marketing` et ses refus disparaissent.
--
-- Un rattachement `marketing` existant ferait échouer la contrainte rétablie :
-- le retour échoue alors, plutôt que de transformer ce rattachement en un
-- autre rôle (A2.2, point 7).
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT c.relname, pol.polname
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'azimut' AND pol.polname = c.relname || '_marketing_no_access'
  LOOP
    EXECUTE format('DROP POLICY %I ON azimut.%I', p.polname, p.relname);
  END LOOP;
END;
$$;

-- Les politiques des tables en insertion seule, telles que 0074, 0076 et
-- 0078 les ont laissées.
ALTER POLICY approval_org_select ON azimut.approval
  USING (org_id IN (SELECT azimut.user_org_ids()));
ALTER POLICY approval_org_insert ON azimut.approval
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids_with_role('{owner_rep}'))
              AND reviewer_id = azimut.current_user_id());
ALTER POLICY audit_log_org_select ON azimut.audit_log
  USING (org_id IN (SELECT azimut.user_org_ids()));
ALTER POLICY audit_log_org_insert ON azimut.audit_log
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids())
              AND org_id NOT IN (SELECT azimut.user_org_ids_with_role('{auditor}'))
              AND actor_id = azimut.current_user_id());
ALTER POLICY graph_validation_org_select ON azimut.graph_validation
  USING (org_id IN (SELECT azimut.user_org_ids()));
ALTER POLICY graph_validation_org_insert ON azimut.graph_validation
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids())
              AND org_id NOT IN (SELECT azimut.user_org_ids_with_role('{auditor}')));
ALTER POLICY message_schedule_approval_org_select ON azimut.message_schedule_approval
  USING (org_id IN (SELECT azimut.user_org_ids()));
ALTER POLICY message_schedule_approval_org_insert ON azimut.message_schedule_approval
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids_with_role('{owner_rep}'))
              AND user_id = azimut.current_user_id());
ALTER POLICY command_journal_org_select ON azimut.command_journal
  USING (org_id IN (SELECT azimut.user_org_ids()));
ALTER POLICY command_journal_org_insert ON azimut.command_journal
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids())
              AND author_id = azimut.current_user_id());

ALTER TABLE azimut.membership DROP CONSTRAINT membership_role_check;
ALTER TABLE azimut.membership ADD CONSTRAINT membership_role_check
  CHECK (role IN ('admin','designer','owner_rep','vendor','operator','auditor'));
