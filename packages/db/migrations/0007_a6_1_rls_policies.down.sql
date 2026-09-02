-- Revert A6.1 RLS policies

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'site','building','level','zone','plan_source','plan_calibration',
    'footprint','volume','opening','node','edge','vertical_link',
    'building_link','category','pictogram','destination','destination_name',
    'travel_profile','route_cache','decision_point','support','support_face',
    'support_content_block','proof','installed_support','divergence',
    'work_order','charter','charter_color','charter_typeface','charter_rule',
    'lexicon_term','site_rules_binding','kiosk','kiosk_package',
    'kiosk_telemetry','job','audit_log'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON azimut.%I', t || '_org_policy', t);
    EXECUTE format('ALTER TABLE azimut.%I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS membership_manage ON azimut.membership;
DROP POLICY IF EXISTS membership_select ON azimut.membership;
ALTER TABLE azimut.membership DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_update ON azimut.organization;
DROP POLICY IF EXISTS org_insert ON azimut.organization;
DROP POLICY IF EXISTS org_select ON azimut.organization;
ALTER TABLE azimut.organization DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rules_pack_rule_read ON azimut.rules_pack_rule;
ALTER TABLE azimut.rules_pack_rule DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rules_pack_read ON azimut.rules_pack;
ALTER TABLE azimut.rules_pack DISABLE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS azimut.user_org_ids();
