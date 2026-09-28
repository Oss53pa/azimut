-- A5.2, version 28 : la nature réelle du contenu d'une source de plan.
--
-- « content_kind : nature réelle du contenu, constatée à l'import et non
-- déduite de l'extension. Un plan sans contenu vectoriel reste imprécis toute
-- sa vie : cette information survit à l'écran d'import et expliquera plus
-- tard un résidu de calage médiocre. »
--
--   content_kind in ('vector','raster','undetermined')
--
-- Une ligne enregistrée avant cette colonne n'a jamais eu son contenu lu. Elle
-- reçoit 'undetermined' : M2 veut que le contenu illisible ne soit « jamais
-- présumé vectoriel », et un contenu jamais lu l'est a fortiori. Aucune valeur
-- existante n'est modifiée ; la base de développement n'en compte aucune.
--
-- Aucune valeur par défaut ne reste après la migration : une source de plan
-- enregistrée sans que son contenu ait été jugé doit être refusée, et non
-- déclarée indéterminée à l'insu de l'appelant.

ALTER TABLE azimut.plan_source ADD COLUMN content_kind text;

UPDATE azimut.plan_source SET content_kind = 'undetermined' WHERE content_kind IS NULL;

ALTER TABLE azimut.plan_source ALTER COLUMN content_kind SET NOT NULL;

ALTER TABLE azimut.plan_source
  ADD CONSTRAINT plan_source_content_kind_check
  CHECK (content_kind IN ('vector', 'raster', 'undetermined'));
