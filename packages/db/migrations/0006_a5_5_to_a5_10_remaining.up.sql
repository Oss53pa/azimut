-- A5.5 Parcours

CREATE TABLE azimut.travel_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES azimut.site(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  excluded_edge_kinds jsonb NOT NULL DEFAULT '[]',
  weights jsonb,
  require_accessible boolean NOT NULL DEFAULT false,
  honor_hours boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.travel_profile
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();
CREATE INDEX idx_travel_profile_org ON azimut.travel_profile(org_id);

CREATE TABLE azimut.route_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES azimut.site(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES azimut.travel_profile(id) ON DELETE CASCADE,
  from_node_id uuid NOT NULL REFERENCES azimut.node(id) ON DELETE CASCADE,
  to_node_id uuid NOT NULL REFERENCES azimut.node(id) ON DELETE CASCADE,
  path jsonb NOT NULL,
  cost numeric NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  inputs_hash text NOT NULL
);
CREATE INDEX idx_route_cache_org ON azimut.route_cache(org_id);

CREATE TABLE azimut.decision_point (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES azimut.site(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES azimut.travel_profile(id) ON DELETE CASCADE,
  node_id uuid NOT NULL REFERENCES azimut.node(id) ON DELETE CASCADE,
  branch_count integer NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_decision_point_org ON azimut.decision_point(org_id);

-- A5.6 Supports

CREATE TABLE azimut.support (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES azimut.site(id) ON DELETE CASCADE,
  node_id uuid NOT NULL REFERENCES azimut.node(id) ON DELETE CASCADE,
  kind text NOT NULL,
  azimuth_deg numeric NOT NULL DEFAULT 0,
  height_m numeric,
  width_m numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.support
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();
CREATE INDEX idx_support_org ON azimut.support(org_id);

CREATE TABLE azimut.support_face (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  support_id uuid NOT NULL REFERENCES azimut.support(id) ON DELETE CASCADE,
  side text NOT NULL,
  width_mm numeric,
  height_mm numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.support_face
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();
CREATE INDEX idx_support_face_org ON azimut.support_face(org_id);

CREATE TABLE azimut.support_content_block (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  face_id uuid NOT NULL REFERENCES azimut.support_face(id) ON DELETE CASCADE,
  kind text NOT NULL,
  ordinal integer NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_content_block_org ON azimut.support_content_block(org_id);

-- A5.7 Cycle de vie

CREATE TABLE azimut.proof (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  face_id uuid NOT NULL REFERENCES azimut.support_face(id) ON DELETE CASCADE,
  version integer NOT NULL,
  storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','superseded')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewer_id uuid REFERENCES auth.users(id)
);
CREATE INDEX idx_proof_org ON azimut.proof(org_id);

CREATE TABLE azimut.installed_support (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  support_id uuid NOT NULL REFERENCES azimut.support(id) ON DELETE CASCADE,
  installed_at timestamptz NOT NULL DEFAULT now(),
  photo_path text,
  installer_notes text
);
CREATE INDEX idx_installed_support_org ON azimut.installed_support(org_id);

CREATE TABLE azimut.divergence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  installed_support_id uuid NOT NULL REFERENCES azimut.installed_support(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN (
    'outdated_content','wrong_orientation','undersized',
    'missing','superfluous','damaged'
  )),
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  notes text
);
CREATE INDEX idx_divergence_org ON azimut.divergence(org_id);

CREATE TABLE azimut.work_order (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES azimut.site(id) ON DELETE CASCADE,
  scope jsonb,
  estimated_cost numeric,
  currency text NOT NULL DEFAULT 'EUR',
  state text NOT NULL DEFAULT 'draft'
    CHECK (state IN ('draft','issued','in_progress','done','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE INDEX idx_work_order_org ON azimut.work_order(org_id);

-- A5.8 Chartes et règles

CREATE TABLE azimut.charter (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES azimut.site(id) ON DELETE CASCADE,
  name text NOT NULL,
  version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_charter_org ON azimut.charter(org_id);

CREATE TABLE azimut.charter_color (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  charter_id uuid NOT NULL REFERENCES azimut.charter(id) ON DELETE CASCADE,
  key text NOT NULL,
  hex text NOT NULL,
  usage text NOT NULL
);
CREATE INDEX idx_charter_color_org ON azimut.charter_color(org_id);

CREATE TABLE azimut.charter_typeface (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  charter_id uuid NOT NULL REFERENCES azimut.charter(id) ON DELETE CASCADE,
  key text NOT NULL,
  family text NOT NULL,
  weight integer NOT NULL,
  min_size_mm numeric NOT NULL
);
CREATE INDEX idx_charter_typeface_org ON azimut.charter_typeface(org_id);

CREATE TABLE azimut.charter_rule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  charter_id uuid NOT NULL REFERENCES azimut.charter(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN (
    'adjacency_forbidden','min_logo_width','background_allowed',
    'proportion','signature_usage'
  )),
  params jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_charter_rule_org ON azimut.charter_rule(org_id);

CREATE TABLE azimut.lexicon_term (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  charter_id uuid NOT NULL REFERENCES azimut.charter(id) ON DELETE CASCADE,
  lang text NOT NULL CHECK (lang IN ('fr','en')),
  term text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('forbidden','discouraged'))
);
CREATE INDEX idx_lexicon_term_org ON azimut.lexicon_term(org_id);

CREATE TABLE azimut.rules_pack (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  version text NOT NULL,
  jurisdiction text NOT NULL,
  effective_from text NOT NULL,
  source_ref text NOT NULL CHECK (source_ref <> ''),
  checksum text NOT NULL,
  UNIQUE (key, version)
);

CREATE TABLE azimut.rules_pack_rule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rules_pack_id uuid NOT NULL REFERENCES azimut.rules_pack(id) ON DELETE CASCADE,
  code text NOT NULL,
  scope text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}',
  source_ref text NOT NULL CHECK (source_ref <> '')
);
CREATE INDEX idx_rules_pack_rule_pack ON azimut.rules_pack_rule(rules_pack_id);

CREATE TABLE azimut.site_rules_binding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES azimut.site(id) ON DELETE CASCADE,
  rules_pack_id uuid NOT NULL REFERENCES azimut.rules_pack(id) ON DELETE CASCADE,
  bound_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_site_rules_binding_org ON azimut.site_rules_binding(org_id);

ALTER TABLE azimut.site
  ADD CONSTRAINT fk_site_rules_pack
  FOREIGN KEY (rules_pack_id) REFERENCES azimut.rules_pack(id);

-- A5.9 Bornes

CREATE TABLE azimut.kiosk (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES azimut.site(id) ON DELETE CASCADE,
  node_id uuid NOT NULL REFERENCES azimut.node(id) ON DELETE CASCADE,
  azimuth_deg numeric NOT NULL DEFAULT 0,
  default_lang text NOT NULL DEFAULT 'fr',
  building_id uuid NOT NULL REFERENCES azimut.building(id) ON DELETE CASCADE,
  hardware_profile jsonb,
  label text NOT NULL DEFAULT ''
);
CREATE INDEX idx_kiosk_org ON azimut.kiosk(org_id);

CREATE TABLE azimut.kiosk_package (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES azimut.site(id) ON DELETE CASCADE,
  version integer NOT NULL,
  storage_path text NOT NULL,
  checksum text NOT NULL,
  built_at timestamptz NOT NULL DEFAULT now(),
  content_hash text NOT NULL
);
CREATE INDEX idx_kiosk_package_org ON azimut.kiosk_package(org_id);

CREATE TABLE azimut.kiosk_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  kiosk_id uuid NOT NULL REFERENCES azimut.kiosk(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  event_kind text NOT NULL CHECK (event_kind IN ('search','no_result','route_shown','idle_reset')),
  payload jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_kiosk_telemetry_org ON azimut.kiosk_telemetry(org_id);

-- A5.10 Travaux et journal

CREATE TABLE azimut.job (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN (
    'import_plan','import_roster','compile_artworks',
    'build_kiosk_package','export_quantities','audit_site'
  )),
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','running','succeeded','failed','cancelled')),
  payload jsonb NOT NULL DEFAULT '{}',
  result jsonb,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  error text
);
CREATE INDEX idx_job_org ON azimut.job(org_id);
CREATE INDEX idx_job_state ON azimut.job(state) WHERE state IN ('queued','running');

CREATE TABLE azimut.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  before jsonb,
  after jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_log_org ON azimut.audit_log(org_id);
