-- Retour de 0074 : la table des décisions disparaît avec ses verrous.
--
-- Une table en insertion seule refuse TRUNCATE, mais DROP TABLE n'est pas un
-- TRUNCATE et n'en déclenche pas le verrou : le retour reste possible sur une
-- base de développement. Sur une base où des décisions ont été enregistrées,
-- ce retour les détruirait ; il ne s'y joue pas (A2.2, point 7).
DROP TABLE IF EXISTS azimut.message_schedule_approval;
DROP FUNCTION IF EXISTS azimut.block_message_schedule_approval_truncate();
DROP FUNCTION IF EXISTS azimut.block_message_schedule_approval_modification();
