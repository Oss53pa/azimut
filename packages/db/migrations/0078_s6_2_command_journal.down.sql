-- Retour de 0078 : le chemin journalisé et le journal disparaissent.
--
-- Comme pour les autres tables en insertion seule, DROP TABLE n'est pas un
-- TRUNCATE et n'en déclenche pas le verrou : le retour reste possible sur une
-- base de développement. Sur une base où des commandes ont été journalisées,
-- il les détruirait ; il ne s'y joue pas (A2.2, point 7).
DROP FUNCTION IF EXISTS azimut.apply_journaled_commands(uuid, uuid, jsonb);
DROP TABLE IF EXISTS azimut.command_journal;
DROP FUNCTION IF EXISTS azimut.guard_command_journal_writer();
DROP FUNCTION IF EXISTS azimut.block_command_journal_truncate();
DROP FUNCTION IF EXISTS azimut.block_command_journal_modification();
