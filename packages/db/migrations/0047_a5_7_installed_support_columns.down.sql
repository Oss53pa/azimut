-- Retour de 0047. Le retour refuse si une pose porte déjà une version, un état
-- ou un relevé : retirer les colonnes les détruirait (A2.2 nº 7). FORCE ROW
-- LEVEL SECURITY est levé pour le contrôle ; un refus annule la transaction et
-- le rétablit avec elle.

ALTER TABLE azimut.installed_support NO FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM azimut.installed_support
    WHERE installed_version IS NOT NULL OR condition IS NOT NULL
       OR surveyed_by IS NOT NULL OR surveyed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'installed_support rows carry survey data; 0047 cannot be reverted without destroying it';
  END IF;
END $$;

ALTER TABLE azimut.installed_support FORCE ROW LEVEL SECURITY;

ALTER TABLE azimut.installed_support
  DROP COLUMN surveyed_at,
  DROP COLUMN surveyed_by,
  DROP COLUMN condition,
  DROP COLUMN installed_version;
