-- A6.1 — personne ne se rattache seul à une organisation.
--
-- La politique `membership_own_rows` de 0025 valait pour toutes les commandes
-- et ne vérifiait qu'une chose : que la ligne nomme l'utilisateur courant.
-- Elle ne disait rien de l'organisation visée ni du rôle demandé. Établi sur
-- une base montée depuis le corpus :
--
--   · un utilisateur B insérait `(org_id = organisation de A, user_id = B,
--     role = 'admin')`, puis lisait tout ce que A possède ;
--   · un membre `vendor` se donnait `admin` par un UPDATE de sa propre ligne.
--
-- Le cloisonnement de A6.1 tombait donc pour qui connaissait l'identifiant
-- d'une organisation, et les rôles de A6.2 pour quiconque était membre.
--
-- Le mécanisme d'entrée dans une organisation (administration, invitations)
-- relève de L4.1, que le cahier des charges place à l'incrément 4. Aucun
-- parcours de l'application n'écrit `membership` d'ici là. Cette migration ne
-- l'anticipe pas : elle retire à `authenticated` toute écriture sur la table.
-- Un rattachement est un acte d'exploitation, sous le rôle propriétaire, et le
-- restera jusqu'à ce que L4.1 en décide autrement.
--
-- La lecture ne change pas : chacun voit ses propres rattachements, ce dont
-- `user_org_ids()` a besoin, et rien d'autre.
--
-- Cette migration n'ajoute ni ne retire aucune colonne et ne touche à aucune
-- ligne : elle remplace une politique et retire trois droits (A2.2-7).

DROP POLICY IF EXISTS membership_own_rows ON azimut.membership;

CREATE POLICY membership_own_rows_select ON azimut.membership
  FOR SELECT TO authenticated
  USING (user_id = azimut.current_user_id());

-- Les droits se retirent aussi, et pas seulement les politiques : sans droit,
-- la base refuse en le disant ; sans politique, elle ne ferait qu'ignorer la
-- ligne, et une écriture refusée passerait pour une écriture sans effet.
REVOKE INSERT, UPDATE, DELETE ON azimut.membership FROM authenticated;
