-- Retire les faces de typologie de 0089, et leur fonction de rattachement.
-- Destructif pour les faces déclarées depuis : à ne jouer qu'avec l'accord
-- d'Oss53pa (A2.2, point 7).
DROP TABLE IF EXISTS azimut.support_typology_face;
DROP FUNCTION IF EXISTS azimut.support_typology_face_attached();
