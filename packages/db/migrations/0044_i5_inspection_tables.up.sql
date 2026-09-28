-- I5.6 — les tournées d'inspection du module 08 (famille C de la proposition
-- de schéma, 5.4).
--
-- Ni A5 ni la partie B ne définissent ces entités ; la proposition les tire
-- de ce que les écrans et le garde `auditSurveySync` lisent déjà. Décision de
-- l'utilisateur du 25/09/2026 : la famille C est engagée, module par module,
-- dans l'ordre 07, 09, 08, 05, 06.
--
-- Elles s'ajoutent à `installed_support`, `divergence` et `work_order`, qui
-- restent la couche de divergence de A5.7. Le nombre de constats d'une
-- tournée se compte, il ne se stocke pas.
--
-- Additive : deux tables créées, rien d'existant touché.

CREATE TABLE azimut.inspection_round (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES azimut.site(id) ON DELETE RESTRICT,
  zone_label text NOT NULL,
  surveyor_id uuid,
  surveyed_on date,
  sync_state text NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_inspection_round_org ON azimut.inspection_round(org_id);
CREATE INDEX idx_inspection_round_site ON azimut.inspection_round(site_id);

-- Un constat est un relevé : ni sa tournée ni son support ne peuvent
-- disparaître en l'emportant.
CREATE TABLE azimut.inspection_finding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE RESTRICT,
  round_id uuid NOT NULL REFERENCES azimut.inspection_round(id) ON DELETE RESTRICT,
  support_id uuid NOT NULL REFERENCES azimut.support(id) ON DELETE RESTRICT,
  nature_key text NOT NULL CHECK (btrim(nature_key) <> ''),
  severity text NOT NULL CHECK (severity IN ('blocking','warning')),
  photo_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_inspection_finding_org ON azimut.inspection_finding(org_id);
CREATE INDEX idx_inspection_finding_round ON azimut.inspection_finding(round_id);

-- ── Cloisonnement (A6.1, A13.3) ───────────────────────────────────────────

ALTER TABLE azimut.inspection_round   ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.inspection_finding ENABLE ROW LEVEL SECURITY;

ALTER TABLE azimut.inspection_round   FORCE ROW LEVEL SECURITY;
ALTER TABLE azimut.inspection_finding FORCE ROW LEVEL SECURITY;

CREATE POLICY inspection_round_org_policy ON azimut.inspection_round
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

CREATE POLICY inspection_finding_org_policy ON azimut.inspection_finding
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

GRANT SELECT, INSERT, UPDATE, DELETE ON azimut.inspection_round, azimut.inspection_finding TO authenticated;
