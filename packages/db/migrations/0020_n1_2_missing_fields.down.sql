ALTER TABLE azimut.destination
  DROP CONSTRAINT IF EXISTS destination_validity_order_check,
  DROP COLUMN IF EXISTS valid_to,
  DROP COLUMN IF EXISTS valid_from;
ALTER TABLE azimut.building
  DROP CONSTRAINT IF EXISTS building_default_edge_width_check,
  DROP COLUMN IF EXISTS default_edge_width_m;
ALTER TABLE azimut.site
  DROP CONSTRAINT IF EXISTS site_active_langs_check,
  DROP COLUMN IF EXISTS reference_elevation_m,
  DROP COLUMN IF EXISTS active_langs;
