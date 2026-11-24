-- Retire les contraintes de 0082. Aucune donnée n'est touchée.
ALTER TABLE azimut.opening DROP CONSTRAINT IF EXISTS opening_position_point;
ALTER TABLE azimut.node DROP CONSTRAINT IF EXISTS node_position_point;
DROP FUNCTION IF EXISTS azimut.point_m_valid(jsonb);
