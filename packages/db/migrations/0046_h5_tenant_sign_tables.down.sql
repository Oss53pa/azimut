-- Retour de 0046. Les trois tables n'existaient pas avant ; rien d'antérieur
-- n'est touché.
--
-- Le retour refuse si un règlement ou un dossier est enregistré : supprimer
-- ces lignes avec leurs tables relèverait de A2.2 nº 7. FORCE ROW LEVEL
-- SECURITY est levé pour le contrôle ; un refus annule la transaction et le
-- rétablit avec elle.

ALTER TABLE azimut.tenant_sign_regulation NO FORCE ROW LEVEL SECURITY;
ALTER TABLE azimut.tenant_sign_dossier NO FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM azimut.tenant_sign_regulation) OR EXISTS (SELECT 1 FROM azimut.tenant_sign_dossier) THEN
    RAISE EXCEPTION 'tenant sign tables hold rows; 0046 cannot be reverted without destroying them';
  END IF;
END $$;

DROP TABLE IF EXISTS azimut.tenant_sign_part;
DROP TABLE IF EXISTS azimut.tenant_sign_dossier;
DROP TABLE IF EXISTS azimut.tenant_sign_regulation;
