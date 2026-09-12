-- Revert D11 delivery persistence.

ALTER TABLE azimut.job DROP CONSTRAINT job_kind_check;
ALTER TABLE azimut.job ADD CONSTRAINT job_kind_check CHECK (kind IN (
  'import_plan','import_roster','compile_artworks',
  'build_kiosk_package','export_quantities','audit_site'
));

DROP TABLE IF EXISTS azimut.delivery_package;
