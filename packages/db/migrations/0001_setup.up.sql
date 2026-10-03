-- First migration: create the updated_at trigger function
-- Used by all tables that carry an updated_at column (A5)

-- Le registre des migrations n'est pas créé ici. C'est le script de migration
-- qui le tient, avant d'appliquer quoi que ce soit, et il le crée qualifié :
-- `azimut._migrations`. Le créer aussi ici, sans qualifier son schéma, en
-- produisait un second à chaque base neuve — voir la migration 0051.

-- La fonction d'horodatage n'est pas créée ici non plus. Elle l'était sans
-- qualifier son schéma, donc hors du schéma de l'application, et la migration
-- 0002 crée `azimut.set_updated_at` juste après avoir créé le schéma. C'est
-- celle-là que tous les déclencheurs emploient ; celle d'ici n'a jamais servi.
--
-- Le fichier subsiste : le retirer décalerait la numérotation et le registre
-- des migrations déjà appliquées.
