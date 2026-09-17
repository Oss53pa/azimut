-- Complément atelier, M2 : stationnement.
--
-- Le socle ne portait rien du stationnement. Un plan d'accueil qui annonce
-- « parking Ouest, 89 places » lisait un chiffre sans rien pour le rattacher au
-- plan qui le fonde.
--
-- Ces tables portent un statut et une source par objet (P1), ce qu'aucune
-- entité antérieure ne fait. Le retrofit de A5 est un autre sujet ; ici la
-- place était libre.
--
-- Ajout additif : tables nouvelles, aucune existante n'est touchée.

CREATE TABLE azimut.parking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  level_id uuid NOT NULL REFERENCES azimut.level(id) ON DELETE CASCADE,
  name text NOT NULL,
  free boolean NOT NULL,
  -- Capacité annoncée par la source, distincte du nombre de places numérisées :
  -- leur écart est précisément ce que le contrôle regarde.
  declared_capacity integer NOT NULL,
  status text NOT NULL,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parking_status_known CHECK (status IN ('existant','proposition','a_verifier','retire')),
  CONSTRAINT parking_source_not_blank CHECK (btrim(source) <> ''),
  CONSTRAINT parking_capacity_non_negative CHECK (declared_capacity >= 0)
);
CREATE INDEX idx_parking_org ON azimut.parking(org_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.parking
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();

CREATE TABLE azimut.parking_space (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  parking_id uuid NOT NULL REFERENCES azimut.parking(id) ON DELETE CASCADE,
  kind text NOT NULL,
  row_label text NOT NULL,
  geom jsonb NOT NULL,
  status text NOT NULL,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parking_space_kind_known CHECK (kind IN ('standard','pmr','livraison')),
  CONSTRAINT parking_space_status_known CHECK (status IN ('existant','proposition','a_verifier','retire')),
  CONSTRAINT parking_space_source_not_blank CHECK (btrim(source) <> '')
);
CREATE INDEX idx_parking_space_org ON azimut.parking_space(org_id);
CREATE INDEX idx_parking_space_parking ON azimut.parking_space(parking_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.parking_space
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();

-- Là où le plan source s'arrête. Sans cette déclaration, un parking à demi
-- numérisé est indiscernable d'un parking numérisé en entier et à demi vide.
CREATE TABLE azimut.parking_uncovered_area (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  parking_id uuid NOT NULL REFERENCES azimut.parking(id) ON DELETE CASCADE,
  geom jsonb,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parking_uncovered_reason_not_blank CHECK (btrim(reason) <> '')
);
CREATE INDEX idx_parking_uncovered_org ON azimut.parking_uncovered_area(org_id);
CREATE INDEX idx_parking_uncovered_parking ON azimut.parking_uncovered_area(parking_id);

CREATE TABLE azimut.vehicle_gate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  level_id uuid NOT NULL REFERENCES azimut.level(id) ON DELETE CASCADE,
  code text NOT NULL,
  role text NOT NULL,
  width_m numeric NOT NULL,
  position jsonb NOT NULL,
  status text NOT NULL,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vehicle_gate_status_known CHECK (status IN ('existant','proposition','a_verifier','retire')),
  CONSTRAINT vehicle_gate_source_not_blank CHECK (btrim(source) <> ''),
  CONSTRAINT vehicle_gate_width_positive CHECK (width_m > 0)
);
CREATE INDEX idx_vehicle_gate_org ON azimut.vehicle_gate(org_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.vehicle_gate
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();

ALTER TABLE azimut.parking ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.parking_space ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.parking_uncovered_area ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.vehicle_gate ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'parking','parking_space','parking_uncovered_area','vehicle_gate'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'CREATE POLICY %I ON azimut.%I FOR ALL TO authenticated USING (org_id IN (SELECT azimut.user_org_ids())) WITH CHECK (org_id IN (SELECT azimut.user_org_ids()))',
      t || '_org_policy', t
    );
  END LOOP;
END;
$$;
