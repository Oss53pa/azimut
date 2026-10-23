-- A6.2 — les rôles s'appliquent en base, là où le cahier des charges les dit
-- sans ambiguïté.
--
-- Jusqu'ici aucune politique ne lisait `membership.role` : un `auditor`, un
-- `designer` ou un `vendor` avait en base les droits d'un `admin`. Cette
-- migration pose les seules règles que A6.2 et R2 (partie R) énoncent explicitement :
--
--   1. `auditor` — « lecture seule intégrale, journaux compris, aucune
--      écriture ». Aucune insertion, modification ni suppression, sur aucune
--      table de son organisation.
--   2. `approval` (bon à tirer) — la décision appartient à `owner_rep`
--      (« validation et signature des bons à tirer ») et à `admin` (« tout dans
--      son organisation »). `designer` est exclu en toutes lettres (« pas de
--      validation »), les autres rôles n'ont pas ce droit. La décision est
--      prise en son propre nom : `reviewer_id` est l'utilisateur courant.
--   3. `message_schedule_approval` — R2 (partie R) : approuver ou rejeter un tableau des
--      messages appartient à `owner_rep` seul ; `admin` et `designer` en sont
--      exclus par la séparation « celui qui génère ne peut pas approuver ». Le
--      relecteur externe d'O7 n'a pas encore de rôle en base.
--   4. `audit_log` — une entrée est écrite au nom de l'utilisateur courant
--      (A12.3, et « ses approbations et son journal d'audit restent
--      attribués »). Une entrée au nom d'un autre, ou de personne, est refusée.
--
-- Ce qui n'est pas tranché reste hors de cette migration : le rattachement du
-- `vendor` à un lot (absent de A5), les droits fins de `operator` et de
-- `marketing`, et qui peut lancer ou clore un travail (`job`, `kiosk_package`).
--
-- Aucune colonne, aucune ligne : des politiques et une fonction (A2.2-7).

-- Les organisations où l'utilisateur courant tient l'un des rôles donnés.
-- Même construction que `user_org_ids()` : la lecture de `membership` passe par
-- sa politique de lecture, qui ne rappelle aucune fonction, donc sans boucle.
CREATE FUNCTION azimut.user_org_ids_with_role(roles text[])
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT org_id FROM azimut.membership
  WHERE user_id = azimut.current_user_id() AND role = ANY (roles);
$$;

-- ── 1. auditor : aucune écriture ──────────────────────────────────────────
--
-- Politiques RESTRICTIVE : elles s'ajoutent en ET aux politiques existantes et
-- ne peuvent que retirer. Une par commande d'écriture, sur chaque table qui
-- porte `org_id`, lue dans le catalogue et non dans une liste écrite à la main.
--
-- Les quatre tables en insertion seule de A12.3 en sont exclues : elles ne
-- portent, par construction, aucune politique de modification ni de
-- suppression, et une seule d'insertion. L'`auditor` y est écarté dans cette
-- politique d'insertion même (sections 2 à 5).
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'org_id' AND NOT a.attisdropped
    WHERE n.nspname = 'azimut' AND c.relkind IN ('r', 'p')
      AND c.relname NOT IN ('approval', 'audit_log', 'graph_validation', 'message_schedule_approval')
    ORDER BY c.relname
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON azimut.%I AS RESTRICTIVE FOR INSERT TO authenticated '
      'WITH CHECK (org_id NOT IN (SELECT azimut.user_org_ids_with_role(''{auditor}'')))',
      t || '_auditor_no_insert', t);
    EXECUTE format(
      'CREATE POLICY %I ON azimut.%I AS RESTRICTIVE FOR UPDATE TO authenticated '
      'USING (org_id NOT IN (SELECT azimut.user_org_ids_with_role(''{auditor}''))) '
      'WITH CHECK (org_id NOT IN (SELECT azimut.user_org_ids_with_role(''{auditor}'')))',
      t || '_auditor_no_update', t);
    EXECUTE format(
      'CREATE POLICY %I ON azimut.%I AS RESTRICTIVE FOR DELETE TO authenticated '
      'USING (org_id NOT IN (SELECT azimut.user_org_ids_with_role(''{auditor}'')))',
      t || '_auditor_no_delete', t);
  END LOOP;
END;
$$;

-- `organization` porte son identifiant dans `id`, non dans `org_id`.
CREATE POLICY organization_auditor_no_update ON azimut.organization
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (id NOT IN (SELECT azimut.user_org_ids_with_role('{auditor}')))
  WITH CHECK (id NOT IN (SELECT azimut.user_org_ids_with_role('{auditor}')));
CREATE POLICY organization_auditor_no_delete ON azimut.organization
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (id NOT IN (SELECT azimut.user_org_ids_with_role('{auditor}')));

-- ── 2. approval : owner_rep ou admin, en son propre nom ───────────────────

DROP POLICY IF EXISTS approval_org_insert ON azimut.approval;
CREATE POLICY approval_org_insert ON azimut.approval
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (SELECT azimut.user_org_ids_with_role('{owner_rep,admin}'))
    AND reviewer_id = azimut.current_user_id()
  );

-- ── 3. message_schedule_approval : owner_rep seul ─────────────────────────

DROP POLICY IF EXISTS message_schedule_approval_org_insert ON azimut.message_schedule_approval;
CREATE POLICY message_schedule_approval_org_insert ON azimut.message_schedule_approval
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (SELECT azimut.user_org_ids_with_role('{owner_rep}'))
    AND user_id = azimut.current_user_id()
  );

-- ── 4. audit_log : au nom de l'utilisateur courant, jamais par l'auditor ──

DROP POLICY IF EXISTS audit_log_org_insert ON azimut.audit_log;
CREATE POLICY audit_log_org_insert ON azimut.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (SELECT azimut.user_org_ids())
    AND org_id NOT IN (SELECT azimut.user_org_ids_with_role('{auditor}'))
    AND actor_id = azimut.current_user_id()
  );

-- ── 5. graph_validation : jamais par l'auditor ────────────────────────────

DROP POLICY IF EXISTS graph_validation_org_insert ON azimut.graph_validation;
CREATE POLICY graph_validation_org_insert ON azimut.graph_validation
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (SELECT azimut.user_org_ids())
    AND org_id NOT IN (SELECT azimut.user_org_ids_with_role('{auditor}'))
  );
