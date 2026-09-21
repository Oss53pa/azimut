DROP INDEX IF EXISTS azimut.uq_footprint_unit_code_per_level;

ALTER TABLE azimut.footprint
  DROP COLUMN IF EXISTS unit_code;
