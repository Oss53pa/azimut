ALTER TABLE azimut.support
  DROP COLUMN IF EXISTS dimensions_source,
  DROP COLUMN IF EXISTS height_mm,
  DROP COLUMN IF EXISTS width_mm;
