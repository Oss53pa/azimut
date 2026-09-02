-- A6.1 Cloisonnement par ligne

CREATE OR REPLACE FUNCTION azimut.user_org_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT org_id FROM azimut.membership WHERE user_id = auth.uid();
$$;

-- Enable RLS on all azimut tables
ALTER TABLE azimut.organization ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.site ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.building ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.level ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.zone ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.plan_source ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.plan_calibration ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.footprint ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.volume ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.opening ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.node ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.edge ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.vertical_link ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.building_link ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.category ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.pictogram ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.destination ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.destination_name ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.travel_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.route_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.decision_point ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.support ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.support_face ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.support_content_block ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.proof ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.installed_support ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.divergence ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.work_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.charter ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.charter_color ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.charter_typeface ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.charter_rule ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.lexicon_term ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.site_rules_binding ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.kiosk ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.kiosk_package ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.kiosk_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.job ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.rules_pack ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.rules_pack_rule ENABLE ROW LEVEL SECURITY;

-- Global tables (no org_id): read-only for authenticated
CREATE POLICY rules_pack_read ON azimut.rules_pack
  FOR SELECT TO authenticated USING (true);
CREATE POLICY rules_pack_rule_read ON azimut.rules_pack_rule
  FOR SELECT TO authenticated USING (true);

-- Organization
CREATE POLICY org_select ON azimut.organization
  FOR SELECT TO authenticated
  USING (id IN (SELECT azimut.user_org_ids()));
CREATE POLICY org_insert ON azimut.organization
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY org_update ON azimut.organization
  FOR UPDATE TO authenticated
  USING (id IN (SELECT azimut.user_org_ids()));

-- Membership
CREATE POLICY membership_select ON azimut.membership
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()));
CREATE POLICY membership_manage ON azimut.membership
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()));

-- Generic org_id policy for all other tables
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
    EXECUTE format(
      'CREATE POLICY %I ON azimut.%I FOR ALL TO authenticated USING (org_id IN (SELECT azimut.user_org_ids())) WITH CHECK (org_id IN (SELECT azimut.user_org_ids()))',
      t || '_org_policy', t
    );
  END LOOP;
END;
$$;
