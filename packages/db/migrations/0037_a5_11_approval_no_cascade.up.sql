-- A5.11 et A12.3 — `approval` refuse la suppression de ses parents.
--
-- Même défaut que celui corrigé en 0036, et plus ancien : la table est en
-- insertion seule depuis 0009, et ses deux clés supprimaient en cascade. Une
-- épreuve supprimée emportait ses approbations, c'est-à-dire la trace de ce
-- que la maîtrise d'ouvrage a signé.
--
-- `proof_id` passe aussi en `RESTRICT`, bien que `proof` ne soit ni
-- l'organisation ni le site : A12.3 dit « aucune clé étrangère ne supprime en
-- cascade une ligne de ces tables », sans distinguer le parent. Une
-- approbation ne disparaît que par la purge d'O15.

ALTER TABLE azimut.approval
  DROP CONSTRAINT approval_org_id_fkey,
  ADD CONSTRAINT approval_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES azimut.organization(id) ON DELETE RESTRICT;

ALTER TABLE azimut.approval
  DROP CONSTRAINT approval_proof_id_fkey,
  ADD CONSTRAINT approval_proof_id_fkey
    FOREIGN KEY (proof_id) REFERENCES azimut.proof(id) ON DELETE RESTRICT;
