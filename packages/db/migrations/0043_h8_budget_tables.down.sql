-- Retour de 0043. Les deux tables n'existaient pas avant ; rien d'antérieur
-- n'est touché.
--
-- Le retour refuse si le module 09 a enregistré quoi que ce soit : supprimer
-- ces lignes avec leurs tables relèverait de A2.2 nº 7. FORCE ROW LEVEL
-- SECURITY est levé pour le contrôle ; un refus annule la transaction et le
-- rétablit avec elle.

ALTER TABLE azimut.cost_reference NO FORCE ROW LEVEL SECURITY;
ALTER TABLE azimut.budget_line NO FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM azimut.cost_reference) OR EXISTS (SELECT 1 FROM azimut.budget_line) THEN
    RAISE EXCEPTION 'budget tables hold rows; 0043 cannot be reverted without destroying them';
  END IF;
END $$;

DROP TABLE IF EXISTS azimut.budget_line;
DROP TABLE IF EXISTS azimut.cost_reference;
