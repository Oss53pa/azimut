-- Retour de 0049 : `side` et `ordinal` redeviennent obligatoires. Le retour
-- refuse s'il existe une face sans `side` ou un bloc sans `ordinal` : les
-- remplir serait inventer une valeur. FORCE ROW LEVEL SECURITY est levé le
-- temps du contrôle, pour que le propriétaire voie toutes les lignes.

ALTER TABLE azimut.support_face NO FORCE ROW LEVEL SECURITY;
ALTER TABLE azimut.support_content_block NO FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM azimut.support_face WHERE side IS NULL) THEN
    RAISE EXCEPTION 'support_face: rows without side exist; 0049 cannot be reverted';
  END IF;
  IF EXISTS (SELECT 1 FROM azimut.support_content_block WHERE ordinal IS NULL) THEN
    RAISE EXCEPTION 'support_content_block: rows without ordinal exist; 0049 cannot be reverted';
  END IF;
END $$;

ALTER TABLE azimut.support_face FORCE ROW LEVEL SECURITY;
ALTER TABLE azimut.support_content_block FORCE ROW LEVEL SECURITY;

ALTER TABLE azimut.support_content_block DROP CONSTRAINT support_content_block_position_present;
ALTER TABLE azimut.support_content_block ALTER COLUMN ordinal SET NOT NULL;
ALTER TABLE azimut.support_face ALTER COLUMN side SET NOT NULL;
