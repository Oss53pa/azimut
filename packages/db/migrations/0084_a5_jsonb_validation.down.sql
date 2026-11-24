-- Retire les contraintes et fonctions de 0084. Aucune donnée n'est touchée.

ALTER TABLE azimut.work_order DROP CONSTRAINT IF EXISTS work_order_scope_contained;
ALTER TABLE azimut.travel_profile DROP CONSTRAINT IF EXISTS travel_profile_weights_contained;
ALTER TABLE azimut.travel_profile DROP CONSTRAINT IF EXISTS travel_profile_excluded_edge_kinds_contained;
ALTER TABLE azimut.support_face DROP CONSTRAINT IF EXISTS support_face_langs_contained;
ALTER TABLE azimut.support_content_block DROP CONSTRAINT IF EXISTS support_content_block_binding_contained;
ALTER TABLE azimut.route_cache DROP CONSTRAINT IF EXISTS route_cache_path_contained;
ALTER TABLE azimut.legal_entity DROP CONSTRAINT IF EXISTS legal_entity_address_contained;
ALTER TABLE azimut.kiosk_telemetry DROP CONSTRAINT IF EXISTS kiosk_telemetry_payload_contained;
ALTER TABLE azimut.kiosk DROP CONSTRAINT IF EXISTS kiosk_hardware_profile_contained;
ALTER TABLE azimut.job DROP CONSTRAINT IF EXISTS job_result_contained;
ALTER TABLE azimut.job DROP CONSTRAINT IF EXISTS job_payload_contained;
ALTER TABLE azimut.edge DROP CONSTRAINT IF EXISTS edge_availability_contained;
ALTER TABLE azimut.divergence DROP CONSTRAINT IF EXISTS divergence_detail_contained;
ALTER TABLE azimut.charter_rule DROP CONSTRAINT IF EXISTS charter_rule_params_contained;
ALTER TABLE azimut.building DROP CONSTRAINT IF EXISTS building_opening_hours_contained;
ALTER TABLE azimut.audit_log DROP CONSTRAINT IF EXISTS audit_log_after_contained;
ALTER TABLE azimut.audit_log DROP CONSTRAINT IF EXISTS audit_log_before_contained;
ALTER TABLE azimut.support_content_block DROP CONSTRAINT IF EXISTS support_content_block_config_retired;
ALTER TABLE azimut.rules_pack_rule DROP CONSTRAINT IF EXISTS rules_pack_rule_params_scalars;
ALTER TABLE azimut.graph_validation DROP CONSTRAINT IF EXISTS graph_validation_findings_shape;
ALTER TABLE azimut.orientation_zone DROP CONSTRAINT IF EXISTS orientation_zone_footprint_ids_uuids;
ALTER TABLE azimut.support_content_block DROP CONSTRAINT IF EXISTS support_content_block_free_text_langs;
ALTER TABLE azimut.message_line DROP CONSTRAINT IF EXISTS message_line_content_shape;
ALTER TABLE azimut.footprint DROP CONSTRAINT IF EXISTS footprint_geometry_polygon;

DROP FUNCTION IF EXISTS azimut.polygon_m_valid(jsonb);
DROP FUNCTION IF EXISTS azimut.message_content_valid(jsonb);
DROP FUNCTION IF EXISTS azimut.scalar_params_valid(jsonb);
DROP FUNCTION IF EXISTS azimut.findings_valid(jsonb);
DROP FUNCTION IF EXISTS azimut.uuid_array_valid(jsonb);
DROP FUNCTION IF EXISTS azimut.lang_texts_valid(jsonb);
DROP FUNCTION IF EXISTS azimut.jsonb_contained(jsonb, text[]);
