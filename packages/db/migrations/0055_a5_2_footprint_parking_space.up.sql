-- A5.2 — la nature `parking_space` entre dans l'énumération des empreintes.
--
-- Section S8, règle S-35 : « Une place de stationnement est une empreinte de
-- nature `parking_space`. Un parking est une zone de nature `parking`. Aucune
-- table nouvelle : ce sont les objets du socle, module 01. »
--
-- La nature de zone `parking` était déjà admise par la migration 0029, qui a
-- fermé `zone.kind` sur les six natures d'A5.2. Seule l'empreinte manquait :
-- la migration 0019 avait fermé `footprint.kind` sur les cinq natures que la
-- section portait alors. La version 16 du consolidé en déclare six, et cette
-- migration aligne la contrainte sur la section.
--
-- Additive, et c'est ce qui la rend sûre : la contrainte s'élargit, elle ne se
-- resserre pas. Aucune ligne existante ne peut la violer, aucune donnée n'est
-- lue, transformée ni déplacée. Le cas d'arrêt A2.2, point 7, ne s'ouvre donc
-- pas ici ; il s'ouvre à la descente, où la contrainte se resserre, et la
-- migration inverse le traite.

ALTER TABLE azimut.footprint
  DROP CONSTRAINT IF EXISTS footprint_kind_check;

ALTER TABLE azimut.footprint
  ADD CONSTRAINT footprint_kind_check
  CHECK (kind IN ('cell', 'circulation', 'technical', 'vertical_core', 'outdoor',
                  'parking_space'));
