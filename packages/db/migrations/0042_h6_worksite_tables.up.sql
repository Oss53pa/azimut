-- H6 — les tables du module 07, chantier et pose (famille C de la
-- proposition de schéma, 5.3).
--
-- Ni A5 ni la partie B ne définissent ces entités ; la proposition les tire
-- de ce que les écrans et le garde `auditInstallReserves` lisent déjà, sans
-- plus. Décision de l'utilisateur du 25/09/2026 : la famille C est engagée,
-- module par module, dans l'ordre 07, 09, 08, 05, 06.
--
-- Conventions de A5 et des migrations 0027 et 0039 : `org_id` requis sous
-- cloisonnement, FORCE ROW LEVEL SECURITY, aucune cascade vers
-- `organization` ni vers `site`, énumérés sous CHECK.
--
-- Additive : cinq tables créées, rien d'existant touché.

-- ── fabrication_lot ───────────────────────────────────────────────────────
-- Un lot de fabrication commandé à un fabricant. Son nombre de supports se
-- calcule depuis `lot_support`, il ne se stocke pas.

CREATE TABLE azimut.fabrication_lot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES azimut.site(id) ON DELETE RESTRICT,
  code text NOT NULL CHECK (btrim(code) <> ''),
  manufacturer_name text NOT NULL,
  state text NOT NULL DEFAULT 'ordered'
    CHECK (state IN ('ordered','in_production','delivered','installed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, code)
);
CREATE INDEX idx_fabrication_lot_org ON azimut.fabrication_lot(org_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.fabrication_lot
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();

-- ── lot_support ───────────────────────────────────────────────────────────
-- Un support appartient à un lot au plus.

CREATE TABLE azimut.lot_support (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE RESTRICT,
  lot_id uuid NOT NULL REFERENCES azimut.fabrication_lot(id) ON DELETE CASCADE,
  support_id uuid NOT NULL REFERENCES azimut.support(id) ON DELETE CASCADE,
  UNIQUE (support_id)
);
CREATE INDEX idx_lot_support_org ON azimut.lot_support(org_id);
CREATE INDEX idx_lot_support_lot ON azimut.lot_support(lot_id);

-- ── install_slot ──────────────────────────────────────────────────────────
-- Un créneau de pose. Sans date, il est à planifier.

CREATE TABLE azimut.install_slot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES azimut.site(id) ON DELETE RESTRICT,
  zone_label text NOT NULL,
  planned_on date,
  night_work boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_install_slot_org ON azimut.install_slot(org_id);

CREATE TABLE azimut.slot_support (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE RESTRICT,
  slot_id uuid NOT NULL REFERENCES azimut.install_slot(id) ON DELETE CASCADE,
  support_id uuid NOT NULL REFERENCES azimut.support(id) ON DELETE CASCADE,
  UNIQUE (slot_id, support_id)
);
CREATE INDEX idx_slot_support_org ON azimut.slot_support(org_id);
CREATE INDEX idx_slot_support_slot ON azimut.slot_support(slot_id);

-- ── install_reserve ───────────────────────────────────────────────────────
-- Une réserve de pose. Elle se lève par `lifted_at`, jamais par suppression :
-- le rôle applicatif n'a pas le droit de supprimer, et ni le support ni le
-- lot ne peuvent disparaître en l'emportant.

CREATE TABLE azimut.install_reserve (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE RESTRICT,
  support_id uuid NOT NULL REFERENCES azimut.support(id) ON DELETE RESTRICT,
  lot_id uuid NOT NULL REFERENCES azimut.fabrication_lot(id) ON DELETE RESTRICT,
  observation_key text NOT NULL,
  observed_by text NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  lifted_at timestamptz,
  photo_path text,
  CONSTRAINT install_reserve_lifted_after_observed
    CHECK (lifted_at IS NULL OR lifted_at >= observed_at)
);
CREATE INDEX idx_install_reserve_org ON azimut.install_reserve(org_id);
CREATE INDEX idx_install_reserve_lot ON azimut.install_reserve(lot_id);
CREATE INDEX idx_install_reserve_support ON azimut.install_reserve(support_id);

-- ── Cloisonnement (A6.1, A13.3) ───────────────────────────────────────────

ALTER TABLE azimut.fabrication_lot  ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.lot_support      ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.install_slot     ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.slot_support     ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.install_reserve  ENABLE ROW LEVEL SECURITY;

ALTER TABLE azimut.fabrication_lot  FORCE ROW LEVEL SECURITY;
ALTER TABLE azimut.lot_support      FORCE ROW LEVEL SECURITY;
ALTER TABLE azimut.install_slot     FORCE ROW LEVEL SECURITY;
ALTER TABLE azimut.slot_support     FORCE ROW LEVEL SECURITY;
ALTER TABLE azimut.install_reserve  FORCE ROW LEVEL SECURITY;

CREATE POLICY fabrication_lot_org_policy ON azimut.fabrication_lot
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

CREATE POLICY lot_support_org_policy ON azimut.lot_support
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

CREATE POLICY install_slot_org_policy ON azimut.install_slot
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

CREATE POLICY slot_support_org_policy ON azimut.slot_support
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

CREATE POLICY install_reserve_org_policy ON azimut.install_reserve
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

GRANT SELECT, INSERT, UPDATE, DELETE ON
  azimut.fabrication_lot,
  azimut.lot_support,
  azimut.install_slot,
  azimut.slot_support
TO authenticated;

GRANT SELECT, INSERT, UPDATE ON azimut.install_reserve TO authenticated;

-- Les privilèges par défaut du schéma accordent aussi DELETE : il est retiré
-- nommément, comme pour `approval` (0025). Une réserve se lève, elle ne se
-- supprime pas.
REVOKE DELETE ON azimut.install_reserve FROM authenticated;
