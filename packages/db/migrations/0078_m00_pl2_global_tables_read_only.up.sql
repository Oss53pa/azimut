-- M00.PL2 — les tables de référence globales sont en lecture seule pour
-- l'application.
--
-- `country` (0040), `rules_pack` et `rules_pack_rule` (0006, politiques en
-- 0007) sont alimentées par fichier et par migration, jamais par l'interface.
-- Elles ne portent pas de colonne `org_id` : une ligne y vaut pour toutes les
-- organisations.
--
-- 0025 a accordé SELECT, INSERT, UPDATE et DELETE sur toutes les tables du
-- schéma à `authenticated`. Sur ces trois tables, seule une politique SELECT
-- existe, et c'est elle seule qui refusait l'écriture. Une politique d'écriture
-- ajoutée plus tard, ou une table rendue `NO FORCE`, rouvrait la modification
-- d'une référence commune à toutes les organisations.
--
-- Établi avant ce retrait : aucun parcours de l'application n'écrit ces tables
-- sous `authenticated`. `pnpm seed:reference` verse `country` sous le rôle
-- propriétaire ; les paquets de règles entrent par migration.
--
-- Les droits se retirent, et pas seulement les politiques : sans droit, la base
-- refuse en le disant ; sans politique, elle ignore la ligne, et une écriture
-- refusée passerait pour une écriture sans effet.
--
-- Cette migration n'ajoute ni ne retire aucune colonne et ne touche à aucune
-- ligne : elle retire des droits (A2.2-7).
--
-- Les droits par défaut de 0025 ne changent pas : ils valent pour les tables
-- cloisonnées par `org_id`, qui sont la règle. Une nouvelle table globale doit
-- retirer ses droits d'écriture elle-même ; l'essai
-- `m00-pl2-tables-globales.db.test.ts` échoue sinon.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON azimut.country FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON azimut.rules_pack FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON azimut.rules_pack_rule FROM authenticated;
