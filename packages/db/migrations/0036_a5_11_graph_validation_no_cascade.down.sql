ALTER TABLE azimut.graph_validation
  DROP CONSTRAINT graph_validation_org_id_fkey,
  ADD CONSTRAINT graph_validation_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE CASCADE;

ALTER TABLE azimut.graph_validation
  DROP CONSTRAINT graph_validation_site_id_fkey,
  ADD CONSTRAINT graph_validation_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES azimut.site(id) ON DELETE CASCADE;
