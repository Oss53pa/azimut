-- A5.7 — la divergence se rattache au support, ou au nœud d'un point non
-- couvert. Décision du 25/09/2026 sur la proposition de schéma (3.2),
-- options 1 et 3 :
--
-- 1. `support_id`, comme A5.7 le porte. Le rattachement à la pose
--    (`installed_support_id`) reste possible mais devient facultatif : une
--    divergence « superflu » ou « absent » ne suppose pas de pose enregistrée.
-- 3. `node_id`, hors A5.7, pour enregistrer un point de décision sans
--    support. Il s'enregistre sous la nature `missing` : la liste A5.7 des
--    natures reste inchangée.
--
-- Une ligne porte l'un ou l'autre, au moins : une divergence qui ne désigne
-- rien ne se relève pas.
--
-- `notes` (texte) cède la place à `detail` (JSON) comme A5.7 le porte. Chaque
-- note existante est recopiée sous la clé `notes`, puis la colonne est
-- retirée : aucune donnée n'est gardée en double (INV-1).
--
-- Transformation de données existantes (A2.2 nº 7), décidée : `support_id`
-- se déduit de la pose par jointure, `detail` de `notes`. Rien ne se perd ;
-- la migration descendante restitue les deux.
--
-- Cloisonnement. `divergence` et `installed_support` sont en FORCE ROW LEVEL
-- SECURITY (0025) : exécutée par leur propriétaire sans identité, la recopie
-- ne verrait aucune ligne, et `notes` serait retirée sans avoir été recopiée.
-- FORCE est donc levé le temps de la recopie et rétabli avant la fin ; le
-- lanceur applique chaque migration dans une transaction, aucune session ne
-- voit l'état intermédiaire. Un contrôle final refuse la migration si une
-- ligne n'a pas été recopiée.

ALTER TABLE azimut.divergence
  ADD COLUMN support_id uuid REFERENCES azimut.support(id) ON DELETE CASCADE,
  ADD COLUMN node_id uuid REFERENCES azimut.node(id) ON DELETE CASCADE,
  ADD COLUMN detail jsonb;

ALTER TABLE azimut.divergence NO FORCE ROW LEVEL SECURITY;
ALTER TABLE azimut.installed_support NO FORCE ROW LEVEL SECURITY;

UPDATE azimut.divergence AS d
  SET support_id = i.support_id
  FROM azimut.installed_support AS i
  WHERE d.installed_support_id = i.id;

UPDATE azimut.divergence
  SET detail = jsonb_build_object('notes', notes)
  WHERE notes IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM azimut.divergence
    WHERE (installed_support_id IS NOT NULL AND support_id IS NULL)
       OR (notes IS NOT NULL AND detail IS NULL)
  ) THEN
    RAISE EXCEPTION 'divergence backfill incomplete: support_id or detail missing after copy';
  END IF;
END $$;

ALTER TABLE azimut.divergence FORCE ROW LEVEL SECURITY;
ALTER TABLE azimut.installed_support FORCE ROW LEVEL SECURITY;

ALTER TABLE azimut.divergence
  ALTER COLUMN installed_support_id DROP NOT NULL,
  DROP COLUMN notes,
  ADD CONSTRAINT divergence_designates_support_or_node
    CHECK (support_id IS NOT NULL OR node_id IS NOT NULL);

CREATE INDEX idx_divergence_support ON azimut.divergence(support_id);
CREATE INDEX idx_divergence_node ON azimut.divergence(node_id);
