ALTER TABLE azimut.audit_log
  DROP CONSTRAINT audit_log_org_id_fkey,
  ADD CONSTRAINT audit_log_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE CASCADE;
