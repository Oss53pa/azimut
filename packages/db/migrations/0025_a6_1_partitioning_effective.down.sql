-- Retour en arrière de 0024. Ne restitue pas un état sûr : il rouvre la
-- frontière d'organisation. N'est là que pour la symétrie du corpus.

DROP TRIGGER IF EXISTS guard_approval_truncate ON azimut.approval;
DROP FUNCTION IF EXISTS azimut.block_approval_truncate();

ALTER DEFAULT PRIVILEGES IN SCHEMA azimut
  REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA azimut
  REVOKE USAGE, SELECT ON SEQUENCES FROM authenticated;

REVOKE USAGE, SELECT ON ALL SEQUENCES IN SCHEMA azimut FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA azimut FROM authenticated;
REVOKE USAGE ON SCHEMA azimut FROM authenticated;

DO $$
DECLARE
  t text;
  unforced_tables text[] := ARRAY[
    'organization','membership','site','building','level','zone',
    'plan_source','plan_calibration','footprint','volume','opening',
    'node','edge','vertical_link','building_link','category','pictogram',
    'destination','destination_name','travel_profile','route_cache',
    'decision_point','support','support_face','support_content_block',
    'support_typology','support_version','proof','approval',
    'installed_support','divergence','work_order','charter','charter_color',
    'charter_typeface','charter_rule','lexicon_term','site_rules_binding',
    'kiosk','kiosk_package','kiosk_telemetry','job','audit_log',
    'delivery_package','control_point','site_fact','site_fact_forbidden_word',
    'source_claim','discrepancy_decision','parking','parking_space',
    'parking_uncovered_area','vehicle_gate'
  ];
BEGIN
  FOREACH t IN ARRAY unforced_tables LOOP
    EXECUTE format('ALTER TABLE azimut.%I NO FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS approval_org_insert ON azimut.approval;
DROP POLICY IF EXISTS approval_org_select ON azimut.approval;
DROP POLICY IF EXISTS support_version_org_policy ON azimut.support_version;
DROP POLICY IF EXISTS support_typology_org_policy ON azimut.support_typology;

ALTER TABLE azimut.support_version  DISABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.support_typology DISABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.approval         DISABLE ROW LEVEL SECURITY;
