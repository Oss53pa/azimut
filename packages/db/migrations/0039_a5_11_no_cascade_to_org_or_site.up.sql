-- A5.11 — aucune clé étrangère vers `organization` ni vers `site` ne supprime
-- en cascade.
--
-- Les trois migrations précédentes ont porté les tables en insertion seule,
-- que A12.3 nomme. Celle-ci porte la règle générale, qui vaut pour tout le
-- modèle : « Aucune clé étrangère vers `organization` ou vers `site` ne
-- supprime en cascade. »
--
-- Motif, et il n'est pas d'esthétique. La suppression physique d'une
-- organisation ou d'un site n'appartient pas à l'usage courant : ce que
-- l'utilisateur retire est supprimé logiquement, par `deleted_at`. La seule
-- suppression physique prévue est la purge de fin de contrat d'O15, qui vide
-- les tables dans l'ordre de dépendance. Le refus posé ici est ce qui la rend
-- vérifiable : « une table restée peuplée bloque la purge et se signale ».
-- Avec des cascades, une table oubliée se serait vidée sans que personne ne
-- l'ait décidé, et la purge aurait paru complète en l'étant par hasard.
--
-- 76 clés étrangères, sur 58 tables. La purge elle-même n'est pas écrite ici :
-- elle relève de la plateforme, qui n'est pas construite.

ALTER TABLE azimut.building
  DROP CONSTRAINT building_org_id_fkey,
  ADD CONSTRAINT building_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.building
  DROP CONSTRAINT building_site_id_fkey,
  ADD CONSTRAINT building_site_id_fkey FOREIGN KEY (site_id) REFERENCES azimut.site(id) ON DELETE RESTRICT;

ALTER TABLE azimut.building_link
  DROP CONSTRAINT building_link_org_id_fkey,
  ADD CONSTRAINT building_link_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.category
  DROP CONSTRAINT category_org_id_fkey,
  ADD CONSTRAINT category_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.charter
  DROP CONSTRAINT charter_org_id_fkey,
  ADD CONSTRAINT charter_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.charter
  DROP CONSTRAINT charter_site_id_fkey,
  ADD CONSTRAINT charter_site_id_fkey FOREIGN KEY (site_id) REFERENCES azimut.site(id) ON DELETE RESTRICT;

ALTER TABLE azimut.charter_color
  DROP CONSTRAINT charter_color_org_id_fkey,
  ADD CONSTRAINT charter_color_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.charter_rule
  DROP CONSTRAINT charter_rule_org_id_fkey,
  ADD CONSTRAINT charter_rule_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.charter_typeface
  DROP CONSTRAINT charter_typeface_org_id_fkey,
  ADD CONSTRAINT charter_typeface_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.control_point
  DROP CONSTRAINT control_point_org_id_fkey,
  ADD CONSTRAINT control_point_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.decision_point
  DROP CONSTRAINT decision_point_org_id_fkey,
  ADD CONSTRAINT decision_point_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.decision_point
  DROP CONSTRAINT decision_point_site_id_fkey,
  ADD CONSTRAINT decision_point_site_id_fkey FOREIGN KEY (site_id) REFERENCES azimut.site(id) ON DELETE RESTRICT;

ALTER TABLE azimut.delivery_package
  DROP CONSTRAINT delivery_package_org_id_fkey,
  ADD CONSTRAINT delivery_package_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.delivery_package
  DROP CONSTRAINT delivery_package_site_id_fkey,
  ADD CONSTRAINT delivery_package_site_id_fkey FOREIGN KEY (site_id) REFERENCES azimut.site(id) ON DELETE RESTRICT;

ALTER TABLE azimut.destination
  DROP CONSTRAINT destination_org_id_fkey,
  ADD CONSTRAINT destination_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.destination_name
  DROP CONSTRAINT destination_name_org_id_fkey,
  ADD CONSTRAINT destination_name_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.discrepancy_decision
  DROP CONSTRAINT discrepancy_decision_org_id_fkey,
  ADD CONSTRAINT discrepancy_decision_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.discrepancy_decision
  DROP CONSTRAINT discrepancy_decision_site_id_fkey,
  ADD CONSTRAINT discrepancy_decision_site_id_fkey FOREIGN KEY (site_id) REFERENCES azimut.site(id) ON DELETE RESTRICT;

ALTER TABLE azimut.divergence
  DROP CONSTRAINT divergence_org_id_fkey,
  ADD CONSTRAINT divergence_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.edge
  DROP CONSTRAINT edge_org_id_fkey,
  ADD CONSTRAINT edge_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.footprint
  DROP CONSTRAINT footprint_org_id_fkey,
  ADD CONSTRAINT footprint_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.information_level
  DROP CONSTRAINT information_level_org_id_fkey,
  ADD CONSTRAINT information_level_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.installed_support
  DROP CONSTRAINT installed_support_org_id_fkey,
  ADD CONSTRAINT installed_support_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.job
  DROP CONSTRAINT job_org_id_fkey,
  ADD CONSTRAINT job_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.kiosk
  DROP CONSTRAINT kiosk_org_id_fkey,
  ADD CONSTRAINT kiosk_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.kiosk
  DROP CONSTRAINT kiosk_site_id_fkey,
  ADD CONSTRAINT kiosk_site_id_fkey FOREIGN KEY (site_id) REFERENCES azimut.site(id) ON DELETE RESTRICT;

ALTER TABLE azimut.kiosk_package
  DROP CONSTRAINT kiosk_package_org_id_fkey,
  ADD CONSTRAINT kiosk_package_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.kiosk_package
  DROP CONSTRAINT kiosk_package_site_id_fkey,
  ADD CONSTRAINT kiosk_package_site_id_fkey FOREIGN KEY (site_id) REFERENCES azimut.site(id) ON DELETE RESTRICT;

ALTER TABLE azimut.kiosk_telemetry
  DROP CONSTRAINT kiosk_telemetry_org_id_fkey,
  ADD CONSTRAINT kiosk_telemetry_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.legal_entity
  DROP CONSTRAINT legal_entity_org_id_fkey,
  ADD CONSTRAINT legal_entity_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.level
  DROP CONSTRAINT level_org_id_fkey,
  ADD CONSTRAINT level_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.lexicon_term
  DROP CONSTRAINT lexicon_term_org_id_fkey,
  ADD CONSTRAINT lexicon_term_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.membership
  DROP CONSTRAINT membership_org_id_fkey,
  ADD CONSTRAINT membership_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.message_line
  DROP CONSTRAINT message_line_org_id_fkey,
  ADD CONSTRAINT message_line_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.message_schedule
  DROP CONSTRAINT message_schedule_org_id_fkey,
  ADD CONSTRAINT message_schedule_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.message_schedule
  DROP CONSTRAINT message_schedule_site_id_fkey,
  ADD CONSTRAINT message_schedule_site_id_fkey FOREIGN KEY (site_id) REFERENCES azimut.site(id) ON DELETE RESTRICT;

ALTER TABLE azimut.naming_rule
  DROP CONSTRAINT naming_rule_org_id_fkey,
  ADD CONSTRAINT naming_rule_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.naming_rule
  DROP CONSTRAINT naming_rule_site_id_fkey,
  ADD CONSTRAINT naming_rule_site_id_fkey FOREIGN KEY (site_id) REFERENCES azimut.site(id) ON DELETE RESTRICT;

ALTER TABLE azimut.node
  DROP CONSTRAINT node_org_id_fkey,
  ADD CONSTRAINT node_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.opening
  DROP CONSTRAINT opening_org_id_fkey,
  ADD CONSTRAINT opening_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.orientation_zone
  DROP CONSTRAINT orientation_zone_org_id_fkey,
  ADD CONSTRAINT orientation_zone_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.orientation_zone
  DROP CONSTRAINT orientation_zone_site_id_fkey,
  ADD CONSTRAINT orientation_zone_site_id_fkey FOREIGN KEY (site_id) REFERENCES azimut.site(id) ON DELETE RESTRICT;

ALTER TABLE azimut.parking
  DROP CONSTRAINT parking_org_id_fkey,
  ADD CONSTRAINT parking_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.parking_space
  DROP CONSTRAINT parking_space_org_id_fkey,
  ADD CONSTRAINT parking_space_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.parking_uncovered_area
  DROP CONSTRAINT parking_uncovered_area_org_id_fkey,
  ADD CONSTRAINT parking_uncovered_area_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.pictogram
  DROP CONSTRAINT pictogram_org_id_fkey,
  ADD CONSTRAINT pictogram_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.plan_calibration
  DROP CONSTRAINT plan_calibration_org_id_fkey,
  ADD CONSTRAINT plan_calibration_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.plan_calibration_point
  DROP CONSTRAINT plan_calibration_point_org_id_fkey,
  ADD CONSTRAINT plan_calibration_point_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.plan_source
  DROP CONSTRAINT plan_source_org_id_fkey,
  ADD CONSTRAINT plan_source_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.proof
  DROP CONSTRAINT proof_org_id_fkey,
  ADD CONSTRAINT proof_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.route_cache
  DROP CONSTRAINT route_cache_org_id_fkey,
  ADD CONSTRAINT route_cache_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.route_cache
  DROP CONSTRAINT route_cache_site_id_fkey,
  ADD CONSTRAINT route_cache_site_id_fkey FOREIGN KEY (site_id) REFERENCES azimut.site(id) ON DELETE RESTRICT;

ALTER TABLE azimut.site
  DROP CONSTRAINT site_org_id_fkey,
  ADD CONSTRAINT site_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.site_fact
  DROP CONSTRAINT site_fact_org_id_fkey,
  ADD CONSTRAINT site_fact_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.site_fact
  DROP CONSTRAINT site_fact_site_id_fkey,
  ADD CONSTRAINT site_fact_site_id_fkey FOREIGN KEY (site_id) REFERENCES azimut.site(id) ON DELETE RESTRICT;

ALTER TABLE azimut.site_fact_forbidden_word
  DROP CONSTRAINT site_fact_forbidden_word_org_id_fkey,
  ADD CONSTRAINT site_fact_forbidden_word_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.site_rules_binding
  DROP CONSTRAINT site_rules_binding_org_id_fkey,
  ADD CONSTRAINT site_rules_binding_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.site_rules_binding
  DROP CONSTRAINT site_rules_binding_site_id_fkey,
  ADD CONSTRAINT site_rules_binding_site_id_fkey FOREIGN KEY (site_id) REFERENCES azimut.site(id) ON DELETE RESTRICT;

ALTER TABLE azimut.source_claim
  DROP CONSTRAINT source_claim_org_id_fkey,
  ADD CONSTRAINT source_claim_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.source_claim
  DROP CONSTRAINT source_claim_site_id_fkey,
  ADD CONSTRAINT source_claim_site_id_fkey FOREIGN KEY (site_id) REFERENCES azimut.site(id) ON DELETE RESTRICT;

ALTER TABLE azimut.support
  DROP CONSTRAINT support_org_id_fkey,
  ADD CONSTRAINT support_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.support
  DROP CONSTRAINT support_site_id_fkey,
  ADD CONSTRAINT support_site_id_fkey FOREIGN KEY (site_id) REFERENCES azimut.site(id) ON DELETE RESTRICT;

ALTER TABLE azimut.support_content_block
  DROP CONSTRAINT support_content_block_org_id_fkey,
  ADD CONSTRAINT support_content_block_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.support_face
  DROP CONSTRAINT support_face_org_id_fkey,
  ADD CONSTRAINT support_face_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.support_typology
  DROP CONSTRAINT support_typology_org_id_fkey,
  ADD CONSTRAINT support_typology_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.support_version
  DROP CONSTRAINT support_version_org_id_fkey,
  ADD CONSTRAINT support_version_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.travel_profile
  DROP CONSTRAINT travel_profile_org_id_fkey,
  ADD CONSTRAINT travel_profile_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.travel_profile
  DROP CONSTRAINT travel_profile_site_id_fkey,
  ADD CONSTRAINT travel_profile_site_id_fkey FOREIGN KEY (site_id) REFERENCES azimut.site(id) ON DELETE RESTRICT;

ALTER TABLE azimut.vehicle_gate
  DROP CONSTRAINT vehicle_gate_org_id_fkey,
  ADD CONSTRAINT vehicle_gate_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.vertical_link
  DROP CONSTRAINT vertical_link_org_id_fkey,
  ADD CONSTRAINT vertical_link_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.volume
  DROP CONSTRAINT volume_org_id_fkey,
  ADD CONSTRAINT volume_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.wayfinding_sequence
  DROP CONSTRAINT wayfinding_sequence_org_id_fkey,
  ADD CONSTRAINT wayfinding_sequence_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.wayfinding_sequence
  DROP CONSTRAINT wayfinding_sequence_site_id_fkey,
  ADD CONSTRAINT wayfinding_sequence_site_id_fkey FOREIGN KEY (site_id) REFERENCES azimut.site(id) ON DELETE RESTRICT;

ALTER TABLE azimut.work_order
  DROP CONSTRAINT work_order_org_id_fkey,
  ADD CONSTRAINT work_order_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.work_order
  DROP CONSTRAINT work_order_site_id_fkey,
  ADD CONSTRAINT work_order_site_id_fkey FOREIGN KEY (site_id) REFERENCES azimut.site(id) ON DELETE RESTRICT;

ALTER TABLE azimut.zone
  DROP CONSTRAINT zone_org_id_fkey,
  ADD CONSTRAINT zone_org_id_fkey FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;
