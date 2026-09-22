-- N2.2 — les six tables du module 02, wayfinding.
--
-- Le module que L6 déclare non optionnel, et dont N4.6 fait le préalable dur
-- de la signalétique, n'avait aucune donnée persistée : 843 lignes de moteur
-- travaillaient en mémoire, sans table ni chemin d'écriture. C'est le défaut
-- que cette migration comble.
--
-- Chaque table porte org_id et arrive avec sa politique de cloisonnement dans
-- la même migration, conformément à A13.3, et avec FORCE ROW LEVEL SECURITY,
-- sans quoi le propriétaire du schéma contournerait la politique (constat 1 du
-- préalable K4 nº 7).
--
-- Cette migration ne transforme ni ne supprime aucune donnée. Elle crée six
-- tables et ajoute une colonne **nullable** à `support` ; voir la note sur
-- `support.code` en fin de fichier.

-- ── orientation_zone ──────────────────────────────────────────────────────

CREATE TABLE azimut.orientation_zone (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES azimut.site(id) ON DELETE CASCADE,
  code text NOT NULL,
  name_fr text NOT NULL,
  name_en text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('mall','entrance','core','service','outdoor')),
  footprint_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orientation_zone_code_length CHECK (char_length(code) BETWEEN 1 AND 8),
  UNIQUE (site_id, code)
);
CREATE INDEX idx_orientation_zone_org ON azimut.orientation_zone(org_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.orientation_zone
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();

-- ── naming_rule ───────────────────────────────────────────────────────────

CREATE TABLE azimut.naming_rule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES azimut.site(id) ON DELETE CASCADE,
  target text NOT NULL CHECK (target IN ('level','zone','door','core','parking')),
  pattern text NOT NULL,
  max_length integer NOT NULL CHECK (max_length > 0),
  uniqueness_scope text NOT NULL CHECK (uniqueness_scope IN ('site','building','level')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_naming_rule_org ON azimut.naming_rule(org_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.naming_rule
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();

-- ── information_level ─────────────────────────────────────────────────────
-- H2.3 : quatre niveaux, une typologie pouvant en porter plusieurs. La clé
-- primaire composite dit qu'un même niveau ne se rattache pas deux fois.

CREATE TABLE azimut.information_level (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  typology_id uuid NOT NULL REFERENCES azimut.support_typology(id) ON DELETE CASCADE,
  level integer NOT NULL CHECK (level BETWEEN 1 AND 4),
  UNIQUE (typology_id, level)
);
CREATE INDEX idx_information_level_org ON azimut.information_level(org_id);

-- ── wayfinding_sequence ───────────────────────────────────────────────────

CREATE TABLE azimut.wayfinding_sequence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES azimut.site(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES azimut.travel_profile(id) ON DELETE CASCADE,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  node_id uuid NOT NULL REFERENCES azimut.node(id) ON DELETE CASCADE,
  expected_level integer NOT NULL CHECK (expected_level BETWEEN 1 AND 4),
  UNIQUE (profile_id, ordinal)
);
CREATE INDEX idx_wayfinding_sequence_org ON azimut.wayfinding_sequence(org_id);

-- ── message_schedule ──────────────────────────────────────────────────────
-- N2.2 et R12 : quatre états, et eux seuls. `in_review` est celui sur lequel
-- R12 fait reposer l'émission pour revue.

CREATE TABLE azimut.message_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES azimut.site(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  state text NOT NULL DEFAULT 'draft'
    CHECK (state IN ('draft','in_review','approved','superseded')),
  generated_at timestamptz NOT NULL,
  inputs_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, version)
);
CREATE INDEX idx_message_schedule_org ON azimut.message_schedule(org_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.message_schedule
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();

-- ── message_line ──────────────────────────────────────────────────────────
-- `decision_point_id` est NOT NULL : M02.W4, « une ligne sans justification est
-- une anomalie bloquante », et N2.7 critère 4 va plus loin — une telle ligne
-- ne peut pas être créée. La contrainte le rend vrai en base, pas seulement
-- dans le moteur.
--
-- `excluded` et `exclusion_reason` : décision d'Atlas Studio reportée en N2.2
-- et H11. M02.W9 impose que l'écartement soit tracé, jamais silencieux.

CREATE TABLE azimut.message_line (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  schedule_id uuid NOT NULL REFERENCES azimut.message_schedule(id) ON DELETE CASCADE,
  support_id uuid NOT NULL REFERENCES azimut.support(id) ON DELETE CASCADE,
  face_index integer NOT NULL CHECK (face_index >= 0),
  block_index integer NOT NULL CHECK (block_index >= 0),
  content jsonb NOT NULL,
  pictogram_id uuid REFERENCES azimut.pictogram(id) ON DELETE SET NULL,
  direction text CHECK (direction IN ('left','right','ahead','up','down','back')),
  information_level integer NOT NULL CHECK (information_level BETWEEN 1 AND 4),
  decision_point_id uuid NOT NULL REFERENCES azimut.node(id) ON DELETE CASCADE,
  stale boolean NOT NULL DEFAULT false,
  excluded boolean NOT NULL DEFAULT false,
  exclusion_reason jsonb,
  CONSTRAINT message_line_exclusion_reason_when_excluded
    CHECK (NOT excluded OR exclusion_reason IS NOT NULL),
  UNIQUE (schedule_id, support_id, face_index, block_index)
);
CREATE INDEX idx_message_line_org ON azimut.message_line(org_id);
CREATE INDEX idx_message_line_schedule ON azimut.message_line(schedule_id);

-- ── support.code ──────────────────────────────────────────────────────────
-- A5.6 et N2.2 : code lisible, unique par site, requis, par exemple D-042.
-- Propriété du module 02 (implantation, scission L0). D11 en fait le segment
-- de support du nom de fichier livré.
--
-- La colonne est créée **nullable**. La rendre NOT NULL demanderait de
-- renseigner les lignes existantes, c'est-à-dire de transformer des données :
-- cas d'arrêt A2.2 nº 7. Le caractère requis se posera par une migration
-- séparée, après décision sur la valeur à donner aux supports déjà écrits.
-- L'unicité, elle, est posée dès maintenant et vaut sur les codes renseignés.

ALTER TABLE azimut.support ADD COLUMN code text;
CREATE UNIQUE INDEX support_code_unique_per_site
  ON azimut.support(site_id, code) WHERE code IS NOT NULL;

-- ── Cloisonnement (A6.1, A13.3) ───────────────────────────────────────────

ALTER TABLE azimut.orientation_zone     ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.naming_rule          ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.information_level    ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.wayfinding_sequence  ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.message_schedule     ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.message_line         ENABLE ROW LEVEL SECURITY;

ALTER TABLE azimut.orientation_zone     FORCE ROW LEVEL SECURITY;
ALTER TABLE azimut.naming_rule          FORCE ROW LEVEL SECURITY;
ALTER TABLE azimut.information_level    FORCE ROW LEVEL SECURITY;
ALTER TABLE azimut.wayfinding_sequence  FORCE ROW LEVEL SECURITY;
ALTER TABLE azimut.message_schedule     FORCE ROW LEVEL SECURITY;
ALTER TABLE azimut.message_line         FORCE ROW LEVEL SECURITY;

CREATE POLICY orientation_zone_org_policy ON azimut.orientation_zone
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

CREATE POLICY naming_rule_org_policy ON azimut.naming_rule
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

CREATE POLICY information_level_org_policy ON azimut.information_level
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

CREATE POLICY wayfinding_sequence_org_policy ON azimut.wayfinding_sequence
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

CREATE POLICY message_schedule_org_policy ON azimut.message_schedule
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

CREATE POLICY message_line_org_policy ON azimut.message_line
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

GRANT SELECT, INSERT, UPDATE, DELETE ON
  azimut.orientation_zone,
  azimut.naming_rule,
  azimut.information_level,
  azimut.wayfinding_sequence,
  azimut.message_schedule,
  azimut.message_line
TO authenticated;
