-- Retour de 0083 : les déclencheurs, les fonctions, la politique et les droits.
-- Les lignes écrites au journal restent : A12.3 en interdit la suppression.

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_trigger g
    JOIN pg_class c ON c.oid = g.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'azimut' AND g.tgname = 'audit_soft_delete'
  LOOP
    EXECUTE format('DROP TRIGGER audit_soft_delete ON azimut.%I', t);
  END LOOP;
END $$;

DROP TRIGGER audit_event ON azimut.membership;
DROP TRIGGER audit_event ON azimut.kiosk_package;
DROP TRIGGER audit_event ON azimut.site_rules_binding;
DROP TRIGGER audit_event ON azimut.approval;

DROP FUNCTION azimut.audit_membership_role();
DROP FUNCTION azimut.audit_soft_delete();
DROP FUNCTION azimut.audit_kiosk_package();
DROP FUNCTION azimut.audit_rules_binding();
DROP FUNCTION azimut.audit_approval();
DROP FUNCTION azimut.write_audit(uuid, text, text, uuid, jsonb, jsonb);

DROP POLICY audit_writer_insert ON azimut.audit_log;
REVOKE ALL ON azimut.audit_log FROM azimut_audit;
REVOKE USAGE ON SCHEMA azimut FROM azimut_audit;
GRANT INSERT ON azimut.audit_log TO authenticated;
