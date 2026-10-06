-- Retour de 0073 : les annotations de révision disparaissent avec leurs
-- réponses. Elles n'entrent dans aucun calcul ni livrable : rien d'autre n'en
-- dépend.
DROP TABLE IF EXISTS azimut.review_annotation_reply;
DROP TABLE IF EXISTS azimut.review_annotation;
DROP FUNCTION IF EXISTS azimut.review_annotation_sign();
