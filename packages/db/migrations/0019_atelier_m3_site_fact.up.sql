-- Complément atelier, M3 : faits du site et mots qu'ils interdisent.
--
-- Un fait est une affirmation vérifiée qui conditionne ce qu'on écrit sur un
-- support : le parking est gratuit, il n'y a pas de barrière. Il porte sa
-- source et sa date, parce qu'une affirmation sans provenance ne se conteste
-- pas, et les mots que sa véracité bannit.
--
-- Distinct de `lexicon_term` (A5.8), qui porte le vocabulaire de la charte :
-- l'un dit comment on parle, l'autre dit ce qui est vrai. Un terme de charte se
-- corrige en reformulant ; un mot contredisant un fait se corrige en
-- reformulant ou en révisant le fait.
--
-- Ajout additif : table nouvelle, aucune table existante n'est touchée.

CREATE TABLE azimut.site_fact (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES azimut.site(id) ON DELETE CASCADE,
  key text NOT NULL,
  value text NOT NULL,
  source text NOT NULL,
  recorded_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Une clé de fait est unique par site : deux valeurs pour « parking gratuit »
  -- ne se départagent pas, et c'est un écart entre sources (M16), pas un fait.
  CONSTRAINT site_fact_key_unique UNIQUE (site_id, key),
  CONSTRAINT site_fact_source_not_blank CHECK (btrim(source) <> '')
);
CREATE INDEX idx_site_fact_org ON azimut.site_fact(org_id);

-- Les mots interdits sont une table et non un tableau de texte : chacun porte
-- sa langue, et « payment » ne doit pas juger un libellé français.
CREATE TABLE azimut.site_fact_forbidden_word (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  site_fact_id uuid NOT NULL REFERENCES azimut.site_fact(id) ON DELETE CASCADE,
  lang text NOT NULL,
  term text NOT NULL,
  CONSTRAINT site_fact_word_unique UNIQUE (site_fact_id, lang, term),
  CONSTRAINT site_fact_word_not_blank CHECK (btrim(term) <> '')
);
CREATE INDEX idx_site_fact_word_org ON azimut.site_fact_forbidden_word(org_id);
CREATE INDEX idx_site_fact_word_fact ON azimut.site_fact_forbidden_word(site_fact_id);

ALTER TABLE azimut.site_fact ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.site_fact_forbidden_word ENABLE ROW LEVEL SECURITY;

CREATE POLICY site_fact_org_policy ON azimut.site_fact
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

CREATE POLICY site_fact_forbidden_word_org_policy ON azimut.site_fact_forbidden_word
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));
