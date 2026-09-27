-- H5 — les tables du module 06, enseignes locataires (famille C de la
-- proposition de schéma, 5.2).
--
-- Ni A5 ni la partie B ne définissent ces entités ; la proposition les tire
-- de ce que les écrans et le garde `guardSignProject` lisent déjà. Décision
-- de l'utilisateur du 25/09/2026 : la famille C est engagée, module par
-- module, dans l'ordre 07, 09, 08, 05, 06.
--
-- Le règlement est versionné par sa date d'effet : une version s'applique
-- aux dossiers déposés à partir d'elle. Le dossier se rattache à la cellule
-- réelle par `destination_id` ; le locataire et le code de cellule se lisent
-- dans l'annuaire, ils ne se recopient pas ici.
--
-- Additive : trois tables créées, rien d'existant touché.

CREATE TABLE azimut.tenant_sign_regulation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES azimut.site(id) ON DELETE RESTRICT,
  max_height_mm integer CHECK (max_height_mm > 0),
  max_overhang_mm integer CHECK (max_overhang_mm >= 0),
  allowed_materials jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(allowed_materials) = 'array'),
  allowed_lighting jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(allowed_lighting) = 'array'),
  forbidden_features jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(forbidden_features) = 'array'),
  effective_from date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, effective_from)
);
CREATE INDEX idx_tenant_sign_regulation_org ON azimut.tenant_sign_regulation(org_id);

CREATE TABLE azimut.tenant_sign_dossier (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES azimut.site(id) ON DELETE RESTRICT,
  destination_id uuid NOT NULL REFERENCES azimut.destination(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'submitted' CHECK (state IN ('submitted','instructing','approved','refused')),
  submitted_on date NOT NULL,
  height_mm integer NOT NULL CHECK (height_mm >= 0),
  overhang_mm integer NOT NULL CHECK (overhang_mm >= 0),
  material text NOT NULL,
  lighting text NOT NULL,
  features jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(features) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tenant_sign_dossier_org ON azimut.tenant_sign_dossier(org_id);
CREATE INDEX idx_tenant_sign_dossier_site ON azimut.tenant_sign_dossier(site_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.tenant_sign_dossier
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();

CREATE TABLE azimut.tenant_sign_part (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE RESTRICT,
  dossier_id uuid NOT NULL REFERENCES azimut.tenant_sign_dossier(id) ON DELETE RESTRICT,
  key text NOT NULL CHECK (btrim(key) <> ''),
  provided boolean NOT NULL DEFAULT false,
  storage_path text,
  UNIQUE (dossier_id, key)
);
CREATE INDEX idx_tenant_sign_part_org ON azimut.tenant_sign_part(org_id);
CREATE INDEX idx_tenant_sign_part_dossier ON azimut.tenant_sign_part(dossier_id);

-- ── Cloisonnement (A6.1, A13.3) ───────────────────────────────────────────

ALTER TABLE azimut.tenant_sign_regulation ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.tenant_sign_dossier    ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.tenant_sign_part       ENABLE ROW LEVEL SECURITY;

ALTER TABLE azimut.tenant_sign_regulation FORCE ROW LEVEL SECURITY;
ALTER TABLE azimut.tenant_sign_dossier    FORCE ROW LEVEL SECURITY;
ALTER TABLE azimut.tenant_sign_part       FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_sign_regulation_org_policy ON azimut.tenant_sign_regulation
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

CREATE POLICY tenant_sign_dossier_org_policy ON azimut.tenant_sign_dossier
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

CREATE POLICY tenant_sign_part_org_policy ON azimut.tenant_sign_part
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

GRANT SELECT, INSERT, UPDATE, DELETE ON
  azimut.tenant_sign_regulation, azimut.tenant_sign_dossier, azimut.tenant_sign_part
TO authenticated;
