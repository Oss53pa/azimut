-- A5.11 — un fait du site peut désigner l'objet sur lequel il porte.
--
-- « target_kind et target_id sont facultatifs. Renseignés, le fait porte sur
-- cet objet, par exemple la capacité annoncée d'un parking donné ; vides, il
-- porte sur le site entier. L'unicité porte sur le site, la clé et la cible :
-- un site à deux parkings déclare deux capacités. »
--
-- C'est ce qui manquait pour rattacher les contrôles du domaine `PARK` aux
-- objets du socle de la section S8. `site_fact.key` était unique par site, et
-- un site à deux parkings ne pouvait donc déclarer qu'une seule capacité.
--
-- **`target_kind` n'est pas un énuméré fermé, et c'est délibéré.** A5.11 dit
-- « nature et identifiant » sans donner de liste, et le document a déjà deux
-- références polymorphes de cette forme : `audit_log.entity` et
-- `attachment.entity_kind`, l'une comme l'autre sans contrainte de valeur.
-- Fermer la liste ici inventerait une règle que la section ne porte pas, et le
-- premier contrôle qui aurait besoin d'une nature hors liste se heurterait à
-- une contrainte de base au lieu d'une décision. La non-vacuité est en
-- revanche exigée, comme pour `source_ref` : une nature blanche ne désigne
-- rien.
--
-- **Aucune clé étrangère.** Une référence polymorphe ne peut pas en porter, et
-- l'ajout d'une colonne par nature d'objet reviendrait à déclarer la liste
-- fermée que la section refuse. Un fait dont la cible a disparu est donc
-- possible ; c'est aux contrôles de le voir, pas à la base de l'empêcher.
--
-- Additive : deux colonnes nullables, et une unicité qui s'élargit. Une table
-- dont `(site_id, key)` était unique satisfait `(site_id, key, NULL, NULL)`
-- sans transformation. Le cas d'arrêt A2.2, point 7, ne s'ouvre pas ici ; il
-- s'ouvre à la descente, où l'unicité se resserre, et la migration inverse le
-- traite.

ALTER TABLE azimut.site_fact ADD COLUMN target_kind text;
ALTER TABLE azimut.site_fact ADD COLUMN target_id uuid;

-- Une cible est entière ou absente. Une nature sans identifiant ne désigne
-- aucun objet, et un identifiant sans nature ne dit pas dans quelle table le
-- chercher : les deux moitiés se ressembleraient à un fait de site, et c'est
-- précisément la confusion que la cible sert à lever.
ALTER TABLE azimut.site_fact
  ADD CONSTRAINT site_fact_target_complete
  CHECK ((target_kind IS NULL) = (target_id IS NULL));

ALTER TABLE azimut.site_fact
  ADD CONSTRAINT site_fact_target_kind_not_blank
  CHECK (target_kind IS NULL OR btrim(target_kind) <> '');

-- `NULLS NOT DISTINCT` est ce qui rend l'unicité effective sur les faits de
-- site. Sans lui, Postgres tient deux `NULL` pour distincts et la même clé
-- pourrait être déclarée deux fois pour le site entier, ce que l'ancienne
-- contrainte interdisait. Disponible depuis PostgreSQL 15 ; la grappe de
-- développement est en 16.
ALTER TABLE azimut.site_fact DROP CONSTRAINT site_fact_key_unique;

ALTER TABLE azimut.site_fact
  ADD CONSTRAINT site_fact_key_target_unique
  UNIQUE NULLS NOT DISTINCT (site_id, key, target_kind, target_id);
