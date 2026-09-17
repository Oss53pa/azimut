ALTER TABLE azimut.site
  DROP CONSTRAINT IF EXISTS site_origin_pair_check,
  DROP COLUMN IF EXISTS origin_y,
  DROP COLUMN IF EXISTS origin_x;
