-- O4 et A5.2 — le fuseau horaire du site, requis.
--
-- N1.2 exprime les horaires d'ouverture d'un bâtiment « dans le fuseau du
-- site », et la table n'en portait aucun : l'exigence référençait une donnée
-- qui n'existait pas. O4 le relève comme une incohérence du modèle, pas comme
-- une fonction, et A5.2 rend la colonne requise.
--
-- Tous les horaires, disponibilités d'arêtes, plages de fermeture et échéances
-- de contrat s'interprètent dans ce fuseau. Les horodatages techniques restent
-- en temps universel.
--
-- NOT NULL sans valeur par défaut : aucune ligne n'existe, et en inventer une
-- pour les lignes existantes ferait passer une supposition pour un fait. Si la
-- table portait des lignes, cette migration échouerait bruyamment — ce qui est
-- le comportement voulu.

ALTER TABLE azimut.site ADD COLUMN timezone text NOT NULL;
