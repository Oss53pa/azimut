-- A5.3 — `graph_validation`, la trace des passages de la validation de
-- complétude du graphe.
--
-- Elle manquait, et son absence rendait la règle M02.W11 invérifiable : « Le
-- tableau des messages ne peut être émis pour revue que si la validation de
-- complétude du graphe est passée, c'est-à-dire si le dernier enregistrement
-- de `graph_validation` du site est passé et porte l'empreinte du graphe
-- actuel. » Sans enregistrement, le prérequis ne pouvait être ni établi ni
-- contredit ; l'écran de validation calculait un résultat qui mourait avec la
-- session.
--
-- `graph_hash` porte l'empreinte canonique des nœuds, arêtes et liaisons du
-- site, section D7.2, **sans profil**. C'est ce qui donne sa valeur à
-- l'enregistrement : une validation ne vaut que pour le graphe dont elle porte
-- l'empreinte, et une modification du graphe la périme sans qu'on ait à
-- supprimer quoi que ce soit.
--
-- Table nouvelle, aucune ligne existante : cette migration ne transforme ni ne
-- supprime aucune donnée.

CREATE TABLE azimut.graph_validation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES azimut.site(id) ON DELETE CASCADE,
  graph_hash text NOT NULL,
  ran_at timestamptz NOT NULL,
  passed boolean NOT NULL,
  blocking_count integer NOT NULL CHECK (blocking_count >= 0),
  warning_count integer NOT NULL CHECK (warning_count >= 0),
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Un passage qui n'a relevé aucune anomalie bloquante est passé, et
  -- réciproquement. Laisser les deux diverger permettrait d'enregistrer un
  -- échec sans motif, ou une réussite démentie par ses propres anomalies.
  CONSTRAINT graph_validation_passed_matches_blocking
    CHECK (passed = (blocking_count = 0))
);

CREATE INDEX idx_graph_validation_org ON azimut.graph_validation(org_id);
-- M02.W11 lit le dernier passage d'un site : l'index le donne sans balayage.
CREATE INDEX idx_graph_validation_site_ran_at
  ON azimut.graph_validation(site_id, ran_at DESC);

-- ── Cloisonnement (A6.1, A13.3) ───────────────────────────────────────────

ALTER TABLE azimut.graph_validation ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.graph_validation FORCE ROW LEVEL SECURITY;

-- ── Insertion seule (A12.3) ───────────────────────────────────────────────
--
-- « `audit_log`, `approval`, `message_schedule_approval` et `graph_validation`
-- sont en insertion seule, garanti par politique en base et non par convention
-- applicative. Toute tentative de modification ou de suppression échoue au
-- niveau de la base. »
--
-- Quatre verrous, comme pour `approval` : pas de politique FOR ALL, droits
-- retirés, déclencheurs de ligne, déclencheur d'instruction pour TRUNCATE que
-- les déclencheurs de ligne ne voient pas.

CREATE POLICY graph_validation_org_select ON azimut.graph_validation
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()));

CREATE POLICY graph_validation_org_insert ON azimut.graph_validation
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

GRANT SELECT, INSERT ON azimut.graph_validation TO authenticated;
-- Les droits par défaut du schéma accordent aussi UPDATE et DELETE à toute
-- table nouvelle : ils sont retirés ici, sans quoi l'insertion seule ne
-- tiendrait qu'à la politique.
REVOKE UPDATE, DELETE ON azimut.graph_validation FROM authenticated;

CREATE FUNCTION azimut.block_graph_validation_modification()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'graph_validation records are insert-only';
END;
$$;

CREATE TRIGGER guard_graph_validation_update
  BEFORE UPDATE ON azimut.graph_validation
  FOR EACH ROW EXECUTE FUNCTION azimut.block_graph_validation_modification();

CREATE TRIGGER guard_graph_validation_delete
  BEFORE DELETE ON azimut.graph_validation
  FOR EACH ROW EXECUTE FUNCTION azimut.block_graph_validation_modification();

CREATE FUNCTION azimut.block_graph_validation_truncate()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'graph_validation records are insert-only and cannot be truncated';
END;
$$;

CREATE TRIGGER guard_graph_validation_truncate
  BEFORE TRUNCATE ON azimut.graph_validation
  FOR EACH STATEMENT EXECUTE FUNCTION azimut.block_graph_validation_truncate();
