-- A5.11 et A12.3 — `graph_validation` refuse la suppression de son parent.
--
-- A12.3 met cette table en insertion seule, garanti en base : aucune
-- modification, aucune suppression, pour aucun rôle. A5.3 lui donnait
-- pourtant `ON DELETE CASCADE` vers `site` et vers `organization`. Les deux
-- ne tiennent pas ensemble : la cascade est une suppression, le déclencheur
-- la refuse, et un site validé devenait indéboulonnable sans que rien ne dise
-- pourquoi — le refus venait d'un déclencheur, pas de la clé.
--
-- A5.11 tranche : aucune clé étrangère vers `organization` ni vers `site` ne
-- supprime en cascade, et les tables en insertion seule refusent la
-- suppression de leur parent tant que leurs lignes existent. `RESTRICT` porte
-- ce refus à l'endroit où il se lit, sur la clé elle-même.
--
-- La suppression physique reste possible par la seule voie que A12.3 nomme :
-- la purge de fin de contrat d'O15, qui vide les tables dans l'ordre de
-- dépendance. Elle n'est pas écrite ici : elle relève de la plateforme.

ALTER TABLE azimut.graph_validation
  DROP CONSTRAINT graph_validation_org_id_fkey,
  ADD CONSTRAINT graph_validation_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.graph_validation
  DROP CONSTRAINT graph_validation_site_id_fkey,
  ADD CONSTRAINT graph_validation_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES azimut.site(id) ON DELETE RESTRICT;
