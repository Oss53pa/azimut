-- Retire la liste fermée des matières. `volume.material_key` redevient un
-- texte libre ; les valeurs écrites restent telles quelles.
ALTER TABLE azimut.volume DROP CONSTRAINT volume_material_key_fkey;
DROP TABLE azimut.volume_material;
