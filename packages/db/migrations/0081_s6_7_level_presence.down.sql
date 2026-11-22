-- Retire ce que 0081 a posé, dans l'ordre inverse.
--
-- La présence est éphémère et se perd sans dommage. Le nom affiché, lui, est
-- saisi par l'administrateur : le retirer le perd. Ce retour en arrière est
-- destiné aux bases d'essai ; sur une base en service, il se décide (A2.2,
-- point 7).

DROP FUNCTION IF EXISTS azimut.level_presence_list(uuid);
DROP FUNCTION IF EXISTS azimut.member_label(uuid, uuid);
DROP POLICY IF EXISTS membership_colleague_label ON azimut.membership;
DROP FUNCTION IF EXISTS azimut.leave_presence(uuid);
DROP FUNCTION IF EXISTS azimut.touch_presence(uuid, jsonb, jsonb);
DROP TABLE IF EXISTS azimut.level_presence;
DROP FUNCTION IF EXISTS azimut.stamp_level_presence();
DROP INDEX IF EXISTS azimut.idx_command_journal_level_author;
DROP FUNCTION IF EXISTS azimut.presence_zone_valid(jsonb);
DROP FUNCTION IF EXISTS azimut.presence_selection_valid(jsonb);
ALTER TABLE azimut.membership DROP COLUMN IF EXISTS display_name;
