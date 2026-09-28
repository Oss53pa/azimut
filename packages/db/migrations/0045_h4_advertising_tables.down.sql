-- Retour de 0045. Les quatre tables n'existaient pas avant ; rien d'antérieur
-- n'est touché.
--
-- Le retour refuse si un emplacement est enregistré : supprimer ces lignes
-- avec leurs tables relèverait de A2.2 nº 7. FORCE ROW LEVEL SECURITY est levé
-- pour le contrôle ; un refus annule la transaction et le rétablit avec elle.

ALTER TABLE azimut.ad_placement NO FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM azimut.ad_placement) THEN
    RAISE EXCEPTION 'advertising tables hold rows; 0045 cannot be reverted without destroying them';
  END IF;
END $$;

DROP TABLE IF EXISTS azimut.ad_creative;
DROP TABLE IF EXISTS azimut.ad_option;
DROP TABLE IF EXISTS azimut.ad_booking;
DROP TABLE IF EXISTS azimut.ad_placement;
