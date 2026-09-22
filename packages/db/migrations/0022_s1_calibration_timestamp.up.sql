-- M01.S1 — date de l'opération de calage.
--
-- « Le repère site est fixé au premier calage » : la règle est opposable, mais
-- rien dans les données ne disait quel calage était le premier.
-- `plan_source.uploaded_at` date l'import d'un fond, pas son calage, et un fond
-- importé en premier peut être calé en dernier. Cette colonne rend la règle
-- vérifiable.
--
-- Nullable et sans valeur par défaut. `now()` aurait donné à toute ligne
-- existante la date de la migration, faisant passer une inconnue pour un fait
-- et désignant un « premier calage » arbitraire. Tant qu'un calage au moins n'a
-- pas de date, le contrôle M01.S1 se tait plutôt que de deviner. Aucune ligne
-- existante n'est lue ni modifiée.

ALTER TABLE azimut.plan_calibration
  ADD COLUMN calibrated_at timestamptz;
