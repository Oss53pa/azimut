-- J3.4 — la couche d'esquisse : réfléchir sur le plan avant de modéliser.
--
-- Les colonnes de J3.4, et celles que la règle générale de A5 donne à toute
-- table métier : `updated_at`, et `deleted_at` puisque l'utilisateur retire un
-- calque ou gomme un trait (décision de l'utilisatrice, J3.4 ne les listant
-- pas). Un trait gommé est donc supprimé logiquement, comme le reste du
-- modèle, et son retour reste annulable.
--
-- `points` garde le tracé échantillonné avec sa pression : c'est la seule
-- donnée non quantifiée du produit, et elle est cantonnée à cette table (J3.4).
-- Une esquisse n'entre dans aucun calcul ni aucun livrable (J3.3) : aucun
-- chargeur de site ne lit ces tables.
--
-- `color` porte la clé d'une couleur de la palette d'esquisse (jetons
-- `sketch-*`), jamais une valeur : la teinte vit dans le fichier de thème
-- (A2.4), et une esquisse ne peut pas emprunter une couleur de charte.
--
-- Additive : deux tables neuves, aucune ligne existante touchée (A2.2, point 7).

CREATE TABLE azimut.sketch_layer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES azimut.site(id) ON DELETE RESTRICT,
  level_id uuid NOT NULL REFERENCES azimut.level(id) ON DELETE RESTRICT,
  name text NOT NULL,
  owner_id uuid NOT NULL DEFAULT azimut.current_user_id(),
  visible boolean NOT NULL DEFAULT true,
  locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_sketch_layer_org ON azimut.sketch_layer(org_id);
CREATE INDEX idx_sketch_layer_level ON azimut.sketch_layer(level_id);

CREATE TABLE azimut.sketch_stroke (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE RESTRICT,
  layer_id uuid NOT NULL REFERENCES azimut.sketch_layer(id) ON DELETE RESTRICT,
  -- J3.2 : crayon, feutre, marqueur translucide. La gomme n'écrit pas de
  -- trait : elle retire ceux qu'elle touche.
  tool text NOT NULL CHECK (tool IN ('pencil', 'felt', 'marker')),
  color text NOT NULL CHECK (color IN ('graphite', 'brick', 'ultramarine', 'fir')),
  width_base_m numeric NOT NULL CHECK (width_base_m > 0),
  points jsonb NOT NULL CHECK (jsonb_typeof(points) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_sketch_stroke_org ON azimut.sketch_stroke(org_id);
CREATE INDEX idx_sketch_stroke_layer ON azimut.sketch_stroke(layer_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.sketch_layer
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.sketch_stroke
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();

-- A6.1 : cloisonnement par organisation, forcé comme sur toute table portant
-- `org_id` (0025). Les droits de `authenticated` viennent des privilèges par
-- défaut posés par 0025.
ALTER TABLE azimut.sketch_layer ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.sketch_stroke ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.sketch_layer FORCE ROW LEVEL SECURITY;
ALTER TABLE azimut.sketch_stroke FORCE ROW LEVEL SECURITY;

CREATE POLICY sketch_layer_org_policy ON azimut.sketch_layer
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));
CREATE POLICY sketch_stroke_org_policy ON azimut.sketch_stroke
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));
