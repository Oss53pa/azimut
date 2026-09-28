-- Un seul registre de migrations, dans le schéma de l'application.
--
-- Le registre était créé sans qualifier son schéma, par le script de
-- migration et par la migration 0001. Un nom non qualifié se résout par le
-- chemin de recherche, qui commence par `"$user"` : sous un rôle nommé
-- `azimut`, la table atterrissait dans le schéma `azimut`, et sous tout autre
-- rôle dans le schéma par défaut. Deux registres coexistaient donc, chacun
-- ignorant ce que l'autre avait appliqué, et un montage sous le mauvais rôle
-- rejouait l'intégralité des migrations.
--
-- Le schéma est créé ici parce que le registre le précède : la migration 0002
-- ne s'est pas encore exécutée quand le script écrit sa première ligne.
--
-- Le déplacement conserve les lignes. Rien n'est détruit, rien n'est rejoué.

CREATE SCHEMA IF NOT EXISTS azimut;

DO $$
BEGIN
  IF to_regclass('public._migrations') IS NOT NULL
     AND to_regclass('azimut._migrations') IS NULL THEN
    ALTER TABLE public._migrations SET SCHEMA azimut;
  END IF;
END $$;

-- Le schéma par défaut ne porte aucun objet de l'application. Quand les deux
-- registres coexistent, celui du schéma par défaut est le doublon accidentel :
-- ses lignes sont reprises avant qu'il ne parte, jamais perdues.
DO $$
BEGIN
  IF to_regclass('public._migrations') IS NOT NULL
     AND to_regclass('azimut._migrations') IS NOT NULL THEN
    INSERT INTO azimut._migrations (name, applied_at)
      SELECT name, applied_at FROM public._migrations
      ON CONFLICT (name) DO NOTHING;
    DROP TABLE public._migrations;
  END IF;
END $$;

-- Second doublon de même origine : la migration 0001 crée `set_updated_at`
-- sans qualifier son schéma, et la 0002 crée `azimut.set_updated_at` juste
-- après le schéma. Ce sont les triggers de la seconde que toutes les tables
-- emploient ; la première n'a jamais servi. Une fonction ne porte aucune
-- donnée : la retirer ne perd rien.
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;
