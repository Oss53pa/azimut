-- Complément atelier, M16 : écarts entre sources.
--
-- `site_fact` porte une clé unique par site (migration 0019), volontairement :
-- deux valeurs pour « parking gratuit » ne se départagent pas toutes seules, et
-- les stocker toutes deux comme des faits ferait passer une incertitude pour un
-- acquis. Cette migration donne à la seconde valeur l'endroit où exister.
--
-- Une affirmation est ce qu'une source dit d'un objet, à une date. Tant que deux
-- affirmations divergent, il n'y a pas de fait, il y a un écart.
--
-- Ajout additif : deux tables nouvelles, aucune existante n'est touchée.

CREATE TABLE azimut.source_claim (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES azimut.site(id) ON DELETE CASCADE,
  -- La même clé que celle d'un fait du site : l'écart porte sur le même objet.
  key text NOT NULL,
  source text NOT NULL,
  value text NOT NULL,
  recorded_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Une source ne dit qu'une chose d'un objet à une date donnée. Deux valeurs
  -- de la même source le même jour sont une erreur de saisie, pas un écart.
  CONSTRAINT source_claim_unique UNIQUE (site_id, key, source, recorded_on),
  CONSTRAINT source_claim_source_not_blank CHECK (btrim(source) <> '')
);
CREATE INDEX idx_source_claim_org ON azimut.source_claim(org_id);
CREATE INDEX idx_source_claim_key ON azimut.source_claim(site_id, key);

CREATE TABLE azimut.discrepancy_decision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES azimut.site(id) ON DELETE CASCADE,
  key text NOT NULL,
  -- La source dont la valeur est retenue. Nommer la source et non la valeur :
  -- si la source se corrige, la décision suit, au lieu de figer un chiffre.
  decided_source text NOT NULL,
  decided_by text NOT NULL,
  decided_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Un objet n'a qu'une décision courante ; l'historique est au journal (P12).
  CONSTRAINT discrepancy_decision_unique UNIQUE (site_id, key),
  CONSTRAINT discrepancy_decision_by_not_blank CHECK (btrim(decided_by) <> '')
);
CREATE INDEX idx_discrepancy_decision_org ON azimut.discrepancy_decision(org_id);

ALTER TABLE azimut.source_claim ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.discrepancy_decision ENABLE ROW LEVEL SECURITY;

CREATE POLICY source_claim_org_policy ON azimut.source_claim
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

CREATE POLICY discrepancy_decision_org_policy ON azimut.discrepancy_decision
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));
