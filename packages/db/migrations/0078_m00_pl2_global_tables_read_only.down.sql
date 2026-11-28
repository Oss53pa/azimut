-- Retour de 0078 : les droits d'écriture de 0025 reviennent.
--
-- TRUNCATE n'est pas rendu : 0025 ne l'avait pas accordé. Ce retour ne touche
-- à aucune ligne et ne sert qu'à revenir sur une base de développement.
GRANT INSERT, UPDATE, DELETE ON azimut.country TO authenticated;
GRANT INSERT, UPDATE, DELETE ON azimut.rules_pack TO authenticated;
GRANT INSERT, UPDATE, DELETE ON azimut.rules_pack_rule TO authenticated;
