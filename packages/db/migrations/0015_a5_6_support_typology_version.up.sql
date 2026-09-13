-- A5.6 : typologie de support et versions de support.
-- Deux tables manquantes du modèle A5.6, et le lien typology_id sur support.
-- Purement additif : nouvelles tables, colonne nullable ; aucune donnée
-- existante n'est transformée.

CREATE TABLE azimut.support_typology (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  face_count integer NOT NULL,
  template_key text
);
CREATE INDEX idx_support_typology_org ON azimut.support_typology(org_id);

ALTER TABLE azimut.support
  ADD COLUMN typology_id uuid REFERENCES azimut.support_typology(id) ON DELETE SET NULL;

CREATE TABLE azimut.support_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  support_id uuid NOT NULL REFERENCES azimut.support(id) ON DELETE CASCADE,
  version integer NOT NULL,
  state text NOT NULL DEFAULT 'draft'
    CHECK (state IN ('draft','in_review','approved','superseded')),
  artwork_path text,
  content_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX idx_support_version_org ON azimut.support_version(org_id);
CREATE INDEX idx_support_version_support ON azimut.support_version(support_id);
