-- Retour de 0076 : les politiques d'insertion reprennent leur forme antérieure
-- et les restrictions de l'`auditor` tombent. Aucune ligne n'est touchée.

DROP POLICY IF EXISTS graph_validation_org_insert ON azimut.graph_validation;
CREATE POLICY graph_validation_org_insert ON azimut.graph_validation
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

DROP POLICY IF EXISTS audit_log_org_insert ON azimut.audit_log;
CREATE POLICY audit_log_org_insert ON azimut.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

DROP POLICY IF EXISTS message_schedule_approval_org_insert ON azimut.message_schedule_approval;
CREATE POLICY message_schedule_approval_org_insert ON azimut.message_schedule_approval
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (SELECT azimut.user_org_ids())
    AND user_id = azimut.current_user_id()
  );

DROP POLICY IF EXISTS approval_org_insert ON azimut.approval;
CREATE POLICY approval_org_insert ON azimut.approval
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

DROP POLICY IF EXISTS organization_auditor_no_update ON azimut.organization;
DROP POLICY IF EXISTS organization_auditor_no_delete ON azimut.organization;

DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT polname, polrelid::regclass AS rel
    FROM pg_policy
    WHERE polname LIKE '%\_auditor\_no\_insert'
       OR polname LIKE '%\_auditor\_no\_update'
       OR polname LIKE '%\_auditor\_no\_delete'
  LOOP
    EXECUTE format('DROP POLICY %I ON %s', p.polname, p.rel);
  END LOOP;
END;
$$;

DROP FUNCTION IF EXISTS azimut.user_org_ids_with_role(text[]);
