-- Retire les tables d'habillage de 0086, et leurs fonctions.
-- Destructif pour les lignes d'habillage écrites depuis : à ne jouer qu'avec
-- l'accord d'Oss53pa (A2.2, point 7).
DROP TABLE IF EXISTS azimut.decoration_shape;
DROP TABLE IF EXISTS azimut.decoration_layer;
DROP FUNCTION IF EXISTS azimut.decoration_shape_attached();
DROP FUNCTION IF EXISTS azimut.decoration_layer_attached();
DROP FUNCTION IF EXISTS azimut.decoration_style_valid(jsonb);
DROP FUNCTION IF EXISTS azimut.style_role_valid(jsonb);
DROP FUNCTION IF EXISTS azimut.decoration_geometry_valid(jsonb);
DROP FUNCTION IF EXISTS azimut.length_m_valid(jsonb);
DROP FUNCTION IF EXISTS azimut.points_m_valid(jsonb, integer);
