-- H4 — les tables du module 05, régie publicitaire (famille C de la
-- proposition de schéma, 5.1).
--
-- Ni A5 ni la partie B ne définissent ces entités ; la proposition les tire
-- de ce que les écrans et les gardes `guardPlacementBookings`,
-- `auditOptionExpiry` et la réception des visuels lisent déjà. Décision de
-- l'utilisateur du 25/09/2026 : la famille C est engagée, module par module,
-- dans l'ordre 07, 09, 08, 05, 06.
--
-- Chevauchement de réservations : décision du même jour (proposition, 7.7),
-- il n'est PAS interdit en base. Il s'enregistre, et le garde le relève en
-- bloquant ; l'interdire empêcherait de l'enregistrer pour le montrer.
--
-- L'état « libre » d'un emplacement n'est pas stocké : c'est l'absence de
-- réservation. La fiche technique d'un emplacement est générée (H4.2), elle
-- n'a pas de table.
--
-- Additive : quatre tables créées, rien d'existant touché.

CREATE TABLE azimut.ad_placement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES azimut.site(id) ON DELETE RESTRICT,
  code text NOT NULL CHECK (btrim(code) <> ''),
  level_id uuid NOT NULL REFERENCES azimut.level(id) ON DELETE RESTRICT,
  node_id uuid REFERENCES azimut.node(id) ON DELETE SET NULL,
  typology_key text NOT NULL,
  area_m2 numeric NOT NULL CHECK (area_m2 > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (site_id, code)
);
CREATE INDEX idx_ad_placement_org ON azimut.ad_placement(org_id);
CREATE INDEX idx_ad_placement_site ON azimut.ad_placement(site_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.ad_placement
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();

CREATE TABLE azimut.ad_booking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE RESTRICT,
  placement_id uuid NOT NULL REFERENCES azimut.ad_placement(id) ON DELETE RESTRICT,
  state text NOT NULL CHECK (state IN ('option','reserved','occupied','maintenance','retired')),
  from_date date NOT NULL,
  to_date date NOT NULL,
  advertiser_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ad_booking_dates_ordered CHECK (from_date <= to_date)
);
CREATE INDEX idx_ad_booking_org ON azimut.ad_booking(org_id);
CREATE INDEX idx_ad_booking_placement ON azimut.ad_booking(placement_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.ad_booking
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();

CREATE TABLE azimut.ad_option (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE RESTRICT,
  placement_id uuid NOT NULL REFERENCES azimut.ad_placement(id) ON DELETE RESTRICT,
  expires_at date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ad_option_org ON azimut.ad_option(org_id);
CREATE INDEX idx_ad_option_placement ON azimut.ad_option(placement_id);

-- Un visuel enregistré a déjà été assaini à la réception (M05.R5) : son état
-- d'assainissement est un constat, pas une intention. Le verdict est la
-- décision humaine ; `human_review` dit qu'elle n'est pas encore rendue.
CREATE TABLE azimut.ad_creative (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE RESTRICT,
  placement_id uuid NOT NULL REFERENCES azimut.ad_placement(id) ON DELETE RESTRICT,
  format text NOT NULL,
  resolution_dpi integer NOT NULL CHECK (resolution_dpi > 0),
  safe_zone_mm integer NOT NULL CHECK (safe_zone_mm >= 0),
  color_profile text NOT NULL,
  weight_bytes bigint NOT NULL CHECK (weight_bytes >= 0),
  storage_path text,
  sanitation text NOT NULL CHECK (sanitation IN ('clean','failed','deferred')),
  verdict text NOT NULL DEFAULT 'human_review' CHECK (verdict IN ('approved','refused','human_review')),
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ad_creative_org ON azimut.ad_creative(org_id);
CREATE INDEX idx_ad_creative_placement ON azimut.ad_creative(placement_id);

-- ── Cloisonnement (A6.1, A13.3) ───────────────────────────────────────────

ALTER TABLE azimut.ad_placement ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.ad_booking   ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.ad_option    ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.ad_creative  ENABLE ROW LEVEL SECURITY;

ALTER TABLE azimut.ad_placement FORCE ROW LEVEL SECURITY;
ALTER TABLE azimut.ad_booking   FORCE ROW LEVEL SECURITY;
ALTER TABLE azimut.ad_option    FORCE ROW LEVEL SECURITY;
ALTER TABLE azimut.ad_creative  FORCE ROW LEVEL SECURITY;

CREATE POLICY ad_placement_org_policy ON azimut.ad_placement
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

CREATE POLICY ad_booking_org_policy ON azimut.ad_booking
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

CREATE POLICY ad_option_org_policy ON azimut.ad_option
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

CREATE POLICY ad_creative_org_policy ON azimut.ad_creative
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

GRANT SELECT, INSERT, UPDATE, DELETE ON
  azimut.ad_placement, azimut.ad_booking, azimut.ad_option, azimut.ad_creative
TO authenticated;
