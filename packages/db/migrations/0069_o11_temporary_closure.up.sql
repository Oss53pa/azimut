-- O11 — fermetures temporaires.
--
-- « Une fermeture temporaire porte une ou plusieurs arêtes, une date de début,
-- une date de fin, un motif. » Modèle d'O11 :
--   temporary_closure (id, org_id, site_id, edge_ids jsonb, from_at, to_at, reason)
-- Propriétaire : module 01, le socle (Q2) — elle modifie la disponibilité des
-- arêtes, qui sont des données du socle.
--
-- Les bornes sont des instants locaux du site (O4 : « plages de fermeture »
-- interprétées dans le fuseau du site), d'où `timestamp` sans fuseau ; la fin
-- est incluse et suit le début. Le motif est libre : O11 n'en donne pas de
-- liste.
--
-- `provisional_support` (la signalétique provisoire, module 02) n'est pas créé
-- ici : il entre avec la tranche qui la produit.
--
-- Additive : une table créée, rien d'existant touché. Les fermetures écrites
-- auparavant dans `edge.availability` ne sont ni lues ni déplacées.

CREATE TABLE azimut.temporary_closure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES azimut.site(id) ON DELETE RESTRICT,
  edge_ids jsonb NOT NULL
    CHECK (jsonb_typeof(edge_ids) = 'array' AND jsonb_array_length(edge_ids) > 0),
  from_at timestamp NOT NULL,
  to_at timestamp NOT NULL,
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT temporary_closure_range CHECK (to_at >= from_at)
);
CREATE INDEX idx_temporary_closure_org ON azimut.temporary_closure(org_id);
CREATE INDEX idx_temporary_closure_site ON azimut.temporary_closure(site_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.temporary_closure
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();

-- A6.1 et A13.3 : la politique arrive avec la table.
ALTER TABLE azimut.temporary_closure ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.temporary_closure FORCE ROW LEVEL SECURITY;

CREATE POLICY temporary_closure_org_policy ON azimut.temporary_closure
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

GRANT SELECT, INSERT, UPDATE, DELETE ON azimut.temporary_closure TO authenticated;
