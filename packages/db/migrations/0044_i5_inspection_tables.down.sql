-- Retour de 0044. Les deux tables n'existaient pas avant ; rien d'antérieur
-- n'est touché.
--
-- Le retour refuse si une tournée est enregistrée : supprimer ces lignes avec
-- leurs tables relèverait de A2.2 nº 7. FORCE ROW LEVEL SECURITY est levé pour
-- le contrôle ; un refus annule la transaction et le rétablit avec elle.

ALTER TABLE azimut.inspection_round NO FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM azimut.inspection_round) THEN
    RAISE EXCEPTION 'inspection tables hold rows; 0044 cannot be reverted without destroying them';
  END IF;
END $$;

DROP TABLE IF EXISTS azimut.inspection_finding;
DROP TABLE IF EXISTS azimut.inspection_round;
