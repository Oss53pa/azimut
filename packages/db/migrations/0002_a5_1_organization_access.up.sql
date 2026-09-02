-- A5.1 Organisation et accès (schéma azimut)

CREATE SCHEMA IF NOT EXISTS azimut;

CREATE OR REPLACE FUNCTION azimut.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE azimut.organization (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.organization
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();

CREATE TABLE azimut.membership (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin','designer','owner_rep','vendor','operator','auditor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);
CREATE INDEX idx_membership_org ON azimut.membership(org_id);
CREATE INDEX idx_membership_user ON azimut.membership(user_id);
