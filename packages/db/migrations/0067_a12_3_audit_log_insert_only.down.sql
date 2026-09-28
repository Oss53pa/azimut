-- Retour de 0067 : le journal redevient modifiable, comme avant. Aucune ligne
-- n'est touchée dans un sens ni dans l'autre.
DROP TRIGGER IF EXISTS guard_audit_log_truncate ON azimut.audit_log;
DROP TRIGGER IF EXISTS guard_audit_log_delete ON azimut.audit_log;
DROP TRIGGER IF EXISTS guard_audit_log_update ON azimut.audit_log;
DROP FUNCTION IF EXISTS azimut.block_audit_log_truncate();
DROP FUNCTION IF EXISTS azimut.block_audit_log_modification();

GRANT UPDATE, DELETE ON azimut.audit_log TO authenticated;

DROP POLICY IF EXISTS audit_log_org_insert ON azimut.audit_log;
DROP POLICY IF EXISTS audit_log_org_select ON azimut.audit_log;

CREATE POLICY audit_log_org_policy ON azimut.audit_log
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));
