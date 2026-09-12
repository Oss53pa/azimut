-- D11 Archive de livraison — table de persistance et extension des types de job.
-- Additif : aucune donnée existante n'est détruite ni transformée.

CREATE TABLE azimut.delivery_package (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES azimut.site(id) ON DELETE CASCADE,
  site_code text NOT NULL,
  building text NOT NULL,
  level text NOT NULL,
  version integer NOT NULL,
  archive_name text NOT NULL,
  storage_path text NOT NULL,
  checksum text NOT NULL,
  file_count integer NOT NULL,
  total_bytes bigint NOT NULL,
  total_supports integer NOT NULL,
  total_faces integer NOT NULL,
  cross_check_ok boolean NOT NULL,
  built_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_delivery_package_org ON azimut.delivery_package(org_id);

-- Row Level Security, cohérent avec les autres tables portant org_id (A6.1).
ALTER TABLE azimut.delivery_package ENABLE ROW LEVEL SECURITY;
CREATE POLICY delivery_package_org_policy ON azimut.delivery_package
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

-- Les jobs build_delivery_archive et build_wall_plans deviennent admis.
ALTER TABLE azimut.job DROP CONSTRAINT job_kind_check;
ALTER TABLE azimut.job ADD CONSTRAINT job_kind_check CHECK (kind IN (
  'import_plan','import_roster','compile_artworks','build_delivery_archive',
  'build_wall_plans','build_kiosk_package','export_quantities','audit_site'
));
