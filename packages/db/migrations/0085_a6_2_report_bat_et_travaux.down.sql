-- Retour de 0085 : le bon à tirer de nouveau ouvert à l'admin, les gardes du
-- cycle de vie des travaux et des paquets de borne retirées.

DROP TRIGGER IF EXISTS guard_kiosk_package_writer ON azimut.kiosk_package;
DROP FUNCTION IF EXISTS azimut.guard_kiosk_package_writer();
DROP TRIGGER IF EXISTS guard_job_lifecycle ON azimut.job;
DROP FUNCTION IF EXISTS azimut.guard_job_lifecycle();
DROP FUNCTION IF EXISTS azimut.session_is_compiler();

ALTER POLICY role_insert ON azimut.approval
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids_with_role('{admin,owner_rep}')));
