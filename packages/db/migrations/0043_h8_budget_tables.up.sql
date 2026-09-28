-- H8 — les tables du module 09, budget (famille C de la proposition de
-- schéma, 5.5).
--
-- Ni A5 ni la partie B ne définissent ces entités ; la proposition les tire
-- de ce que les écrans et le garde `auditCostReferences` lisent déjà.
-- Décision de l'utilisateur du 25/09/2026 : la famille C est engagée, module
-- par module, dans l'ordre 07, 09, 08, 05, 06.
--
-- Montants en `bigint` d'unité mineure avec leur devise (H8). Un coût absent
-- reste NULL, jamais zéro. Une ligne ne mélange pas deux devises : elle n'en
-- porte qu'une.
--
-- `cost_reference` appartient à l'organisation, non au site : un même coût
-- sert tous ses sites.
--
-- Additive : deux tables créées, rien d'existant touché.

CREATE TABLE azimut.cost_reference (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE RESTRICT,
  typology_key text NOT NULL CHECK (btrim(typology_key) <> ''),
  substrate_key text NOT NULL CHECK (btrim(substrate_key) <> ''),
  manufacturer_name text,
  unit_cost_minor bigint CHECK (unit_cost_minor >= 0),
  currency char(3) CHECK (currency ~ '^[A-Z]{3}$'),
  since date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cost_reference_amount_has_currency
    CHECK ((unit_cost_minor IS NULL) = (currency IS NULL))
);
CREATE INDEX idx_cost_reference_org ON azimut.cost_reference(org_id);

CREATE TABLE azimut.budget_line (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES azimut.site(id) ON DELETE RESTRICT,
  phase_key text NOT NULL CHECK (btrim(phase_key) <> ''),
  lot_id uuid REFERENCES azimut.fabrication_lot(id) ON DELETE RESTRICT,
  estimated_minor bigint CHECK (estimated_minor >= 0),
  quoted_minor bigint CHECK (quoted_minor >= 0),
  actual_minor bigint CHECK (actual_minor >= 0),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_budget_line_org ON azimut.budget_line(org_id);
CREATE INDEX idx_budget_line_site ON azimut.budget_line(site_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.budget_line
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();

-- ── Cloisonnement (A6.1, A13.3) ───────────────────────────────────────────

ALTER TABLE azimut.cost_reference ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.budget_line    ENABLE ROW LEVEL SECURITY;

ALTER TABLE azimut.cost_reference FORCE ROW LEVEL SECURITY;
ALTER TABLE azimut.budget_line    FORCE ROW LEVEL SECURITY;

CREATE POLICY cost_reference_org_policy ON azimut.cost_reference
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

CREATE POLICY budget_line_org_policy ON azimut.budget_line
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

GRANT SELECT, INSERT, UPDATE, DELETE ON azimut.cost_reference, azimut.budget_line TO authenticated;
