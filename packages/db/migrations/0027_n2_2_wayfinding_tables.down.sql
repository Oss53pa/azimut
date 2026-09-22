-- Retour de 0027. Réversible sans condition : les six tables et la colonne
-- n'existaient pas avant, rien d'antérieur n'est touché.

DROP INDEX IF EXISTS azimut.support_code_unique_per_site;
ALTER TABLE azimut.support DROP COLUMN IF EXISTS code;

DROP TABLE IF EXISTS azimut.message_line;
DROP TABLE IF EXISTS azimut.message_schedule;
DROP TABLE IF EXISTS azimut.wayfinding_sequence;
DROP TABLE IF EXISTS azimut.information_level;
DROP TABLE IF EXISTS azimut.naming_rule;
DROP TABLE IF EXISTS azimut.orientation_zone;
