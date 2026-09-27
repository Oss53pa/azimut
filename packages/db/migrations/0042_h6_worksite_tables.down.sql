-- Retour de 0042. Les cinq tables n'existaient pas avant ; rien d'antérieur
-- n'est touché.
--
-- Le retour refuse si le module 07 a enregistré quoi que ce soit : supprimer
-- ces lignes avec leurs tables relèverait de A2.2 nº 7. FORCE ROW LEVEL
-- SECURITY est levé pour le contrôle, sans quoi le propriétaire ne verrait
-- aucune ligne et le contrôle passerait à tort ; un refus annule la
-- transaction, et le rétablit avec elle.

ALTER TABLE azimut.fabrication_lot NO FORCE ROW LEVEL SECURITY;
ALTER TABLE azimut.install_slot NO FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM azimut.fabrication_lot) OR EXISTS (SELECT 1 FROM azimut.install_slot) THEN
    RAISE EXCEPTION 'worksite tables hold rows; 0042 cannot be reverted without destroying them';
  END IF;
END $$;

DROP TABLE IF EXISTS azimut.install_reserve;
DROP TABLE IF EXISTS azimut.slot_support;
DROP TABLE IF EXISTS azimut.install_slot;
DROP TABLE IF EXISTS azimut.lot_support;
DROP TABLE IF EXISTS azimut.fabrication_lot;
