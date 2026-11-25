-- Retire ce que 0085 a posé. La révision du graphe et le passage du service
-- se reconstruisent : une validation par le service suffit à les réécrire.

DROP TRIGGER IF EXISTS guard_schedule_submission ON azimut.message_schedule;
DROP FUNCTION IF EXISTS azimut.guard_schedule_submission();
DROP FUNCTION IF EXISTS azimut.record_service_validation(uuid, bigint, uuid);
DROP TRIGGER IF EXISTS graph_revision_on_vertical_link ON azimut.vertical_link;
DROP TRIGGER IF EXISTS graph_revision_on_edge ON azimut.edge;
DROP TRIGGER IF EXISTS graph_revision_on_node ON azimut.node;
DROP FUNCTION IF EXISTS azimut.graph_revision_on_vertical_link();
DROP FUNCTION IF EXISTS azimut.graph_revision_on_edge();
DROP FUNCTION IF EXISTS azimut.graph_revision_on_node();
DROP FUNCTION IF EXISTS azimut.bump_graph_revision(uuid);
DROP FUNCTION IF EXISTS azimut.site_of_level(uuid);
DROP FUNCTION IF EXISTS azimut.site_of_node(uuid);
DROP TABLE IF EXISTS azimut.graph_revision;
