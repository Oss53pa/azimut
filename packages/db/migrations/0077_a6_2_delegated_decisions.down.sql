-- Retour de 0077 : les trois règles reprennent leur forme de 0076.
-- Aucune ligne n'est touchée.

DROP TRIGGER IF EXISTS guard_kiosk_package_writer ON azimut.kiosk_package;
DROP FUNCTION IF EXISTS azimut.guard_kiosk_package_writer();
DROP TRIGGER IF EXISTS guard_job_lifecycle ON azimut.job;
DROP FUNCTION IF EXISTS azimut.guard_job_lifecycle();
DROP FUNCTION IF EXISTS azimut.session_is_compiler();

CREATE OR REPLACE FUNCTION azimut.user_org_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT org_id FROM azimut.membership WHERE user_id = azimut.current_user_id();
$$;

DROP POLICY IF EXISTS approval_org_insert ON azimut.approval;
CREATE POLICY approval_org_insert ON azimut.approval
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (SELECT azimut.user_org_ids_with_role('{owner_rep,admin}'))
    AND reviewer_id = azimut.current_user_id()
  );
