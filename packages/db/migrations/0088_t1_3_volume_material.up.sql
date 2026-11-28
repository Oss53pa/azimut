-- T-1.3 — la matière d'un volume, en liste fermée. Décision d'Oss53pa du
-- 28 novembre 2026 : « liste fermée en donnée », liste courte neutre, avec
-- `unspecified` pour un volume dont la matière n'est pas connue, sans relâcher
-- NOT NULL sur `volume.material_key`.
--
-- La liste est une donnée, pas du code : elle vit dans cette table et dans
-- `packages/db/src/reference/volume-material.json`, que le studio lit sur un
-- poste sans base. Les deux concordent, et `t-1-3-matiere.db.test.ts` le
-- vérifie : une matière ajoutée ici sans le fichier, ou l'inverse, le fait
-- échouer.
--
-- Les lignes sont posées par la migration, et non par `seed:reference` comme
-- les pays : la clé étrangère qui suit doit trouver la liste au moment où elle
-- se pose, sur toute installation, avant qu'un volume puisse s'écrire.
--
-- A2.2, point 7 : aucune ligne existante n'est transformée. Si un volume porte
-- une matière hors de la liste, la clé étrangère refuse de se poser et la
-- migration échoue en le disant ; rien n'est réécrit d'office.

CREATE TABLE azimut.volume_material (
  key text PRIMARY KEY CHECK (key ~ '^[a-z][a-z_]{0,31}$'),
  name_fr text NOT NULL CHECK (name_fr <> '' AND char_length(name_fr) <= 64),
  name_en text NOT NULL CHECK (name_en <> '' AND char_length(name_en) <= 64),
  ordinal integer NOT NULL UNIQUE CHECK (ordinal > 0),
  source_ref text NOT NULL CHECK (source_ref <> '')
);

INSERT INTO azimut.volume_material (key, name_fr, name_en, ordinal, source_ref) VALUES
  ('concrete', 'Béton', 'Concrete', 1, 'Décision d''Oss53pa du 28 novembre 2026 (T-1.3, liste fermée des matières)'),
  ('masonry', 'Maçonnerie', 'Masonry', 2, 'Décision d''Oss53pa du 28 novembre 2026 (T-1.3, liste fermée des matières)'),
  ('glass', 'Verre', 'Glass', 3, 'Décision d''Oss53pa du 28 novembre 2026 (T-1.3, liste fermée des matières)'),
  ('metal', 'Métal', 'Metal', 4, 'Décision d''Oss53pa du 28 novembre 2026 (T-1.3, liste fermée des matières)'),
  ('wood', 'Bois', 'Wood', 5, 'Décision d''Oss53pa du 28 novembre 2026 (T-1.3, liste fermée des matières)'),
  ('plaster', 'Plâtre et cloison', 'Plaster and partition', 6, 'Décision d''Oss53pa du 28 novembre 2026 (T-1.3, liste fermée des matières)'),
  ('vegetation', 'Végétal', 'Vegetation', 7, 'Décision d''Oss53pa du 28 novembre 2026 (T-1.3, liste fermée des matières)'),
  ('unspecified', 'Non précisée', 'Unspecified', 8, 'Décision d''Oss53pa du 28 novembre 2026 (T-1.3, liste fermée des matières)');

-- Table globale, sans `org_id` : elle ne se cloisonne pas, elle se lit. Même
-- traitement que `country` en 0040.
ALTER TABLE azimut.volume_material ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.volume_material FORCE ROW LEVEL SECURITY;

CREATE POLICY volume_material_read ON azimut.volume_material
  FOR SELECT TO authenticated USING (true);

-- Lecture seule pour l'application (M00.PL2) : la liste change par migration,
-- jamais par l'interface. Les privilèges par défaut du schéma (0025) donnent
-- aussi l'écriture à `authenticated` ; la politique la refuserait, le droit est
-- retiré tout de même, pour que le refus ne dépende pas d'elle seule.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON azimut.volume_material FROM authenticated;
GRANT SELECT ON azimut.volume_material TO authenticated;

ALTER TABLE azimut.volume
  ADD CONSTRAINT volume_material_key_fkey
  FOREIGN KEY (material_key) REFERENCES azimut.volume_material(key)
  ON UPDATE RESTRICT ON DELETE RESTRICT;
