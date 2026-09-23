-- A5.11 et A12.3 — `audit_log` refuse la suppression de son parent.
--
-- Troisième et dernière des tables en insertion seule aujourd'hui créées.
-- `message_schedule_approval`, quatrième table nommée par A12.3, n'existe pas
-- encore : la tranche 2 est suspendue. Elle naîtra directement avec des clés
-- en `RESTRICT`, sans reprise.
--
-- Le journal d'audit est celui que D15 dit anonymiser à la suppression d'un
-- compte, « jamais suppression de la ligne d'audit ». Une cascade depuis
-- l'organisation faisait exactement ce que cette règle interdit.

ALTER TABLE azimut.audit_log
  DROP CONSTRAINT audit_log_org_id_fkey,
  ADD CONSTRAINT audit_log_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;
