-- Q5 — l'entité juridique émettrice, et son rattachement au site.
--
-- Une facture est émise par une entité juridique, pas par une organisation :
-- une société de gestion peut exploiter plusieurs sites détenus par des
-- sociétés différentes. A5.2 porte `site.legal_entity_id`, que le schéma
-- n'avait pas, et Q2 range `legal_entity` à la plateforme.
--
-- Facultative à la création du site, requise avant l'émission de sa première
-- facture (Q5.2). La colonne est donc nullable : la rendre obligatoire
-- empêcherait de modéliser un site avant d'avoir de quoi le facturer, ce que
-- Q5.2 refuse explicitement — « elle ne sert qu'à facturer, et n'est donc pas
-- un préalable au travail de conception ».

CREATE TABLE azimut.legal_entity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  legal_name text NOT NULL,
  registration_ref text,
  tax_ref text,
  address jsonb,
  country_code text NOT NULL,
  currency_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_legal_entity_org ON azimut.legal_entity(org_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.legal_entity
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();

ALTER TABLE azimut.site
  ADD COLUMN legal_entity_id uuid REFERENCES azimut.legal_entity(id) ON DELETE RESTRICT;

-- A6.1 et A13.3 : la politique arrive avec la table.
ALTER TABLE azimut.legal_entity ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.legal_entity FORCE ROW LEVEL SECURITY;

CREATE POLICY legal_entity_org_policy ON azimut.legal_entity
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

GRANT SELECT, INSERT, UPDATE, DELETE ON azimut.legal_entity TO authenticated;
