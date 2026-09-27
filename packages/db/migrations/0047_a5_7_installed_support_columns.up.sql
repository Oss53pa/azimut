-- A5.7 — les colonnes de `installed_support` que la base n'avait pas
-- (proposition de schéma, 3.1) : version posée, état constaté, et qui l'a
-- relevé, quand.
--
-- Additive, sans transformation : les quatre colonnes sont nullables, une
-- pose enregistrée avant elles n'a simplement pas été relevée. `condition`
-- recopie la liste de A5.7 sous CHECK. `installer_notes`, présente en base et
-- absente de A5.7, est conservée.

ALTER TABLE azimut.installed_support
  ADD COLUMN installed_version integer CHECK (installed_version >= 1),
  ADD COLUMN condition text CHECK (condition IN ('good','worn','damaged','missing')),
  ADD COLUMN surveyed_by uuid,
  ADD COLUMN surveyed_at timestamptz;
