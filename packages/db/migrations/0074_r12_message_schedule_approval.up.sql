-- R12 et H11 — `message_schedule_approval`, la trace des décisions sur un
-- tableau des messages : approbation ou rejet.
--
-- H11 : « message_schedule_approval (id, org_id, schedule_id, user_id,
-- decision, comment, decided_at, inputs_hash) ; decision in ('approved',
-- 'rejected') ; insertion seule ; comment requis si decision = 'rejected' :
-- c'est le motif de rejet. » R12 : l'approbation porte « l'approbateur, la
-- date et l'empreinte des entrées », et n'écrit jamais dans `approval`, qui
-- appartient au module 04. L3 : propriété du module 02.
--
-- A12.3 la nomme parmi les quatre tables en insertion seule ; 0038 notait
-- qu'elle naîtrait directement avec des clés en `RESTRICT`. Une décision est
-- un fait daté : elle ne disparaît ni avec l'organisation, ni avec le site,
-- ni avec le tableau qu'elle juge.
--
-- L'approbateur et la date sont pris en base, comme la signature d'une
-- annotation close (0073) : le studio ne connaît pas l'identité de
-- l'utilisateur, et une signature fournie par l'appelant se falsifierait. La
-- politique d'insertion refuse un `user_id` qui ne serait pas celui de la
-- session.
--
-- Additive : une table neuve, aucune ligne existante touchée (A2.2, point 7).

CREATE TABLE azimut.message_schedule_approval (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE RESTRICT,
  schedule_id uuid NOT NULL REFERENCES azimut.message_schedule(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL DEFAULT azimut.current_user_id(),
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  comment text,
  decided_at timestamptz NOT NULL DEFAULT now(),
  inputs_hash text NOT NULL CHECK (btrim(inputs_hash) <> ''),
  -- R12 : « Motif obligatoire » au rejet. Un motif blanc n'en est pas un.
  CONSTRAINT message_schedule_approval_rejection_reason
    CHECK (decision <> 'rejected' OR (comment IS NOT NULL AND btrim(comment) <> ''))
);

CREATE INDEX idx_message_schedule_approval_org ON azimut.message_schedule_approval(org_id);
CREATE INDEX idx_message_schedule_approval_schedule
  ON azimut.message_schedule_approval(schedule_id, decided_at DESC);

-- ── Cloisonnement (A6.1, A13.3) ───────────────────────────────────────────

ALTER TABLE azimut.message_schedule_approval ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.message_schedule_approval FORCE ROW LEVEL SECURITY;

CREATE POLICY message_schedule_approval_org_select ON azimut.message_schedule_approval
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()));

CREATE POLICY message_schedule_approval_org_insert ON azimut.message_schedule_approval
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (SELECT azimut.user_org_ids())
    AND user_id = azimut.current_user_id()
  );

-- ── Insertion seule (A12.3) ───────────────────────────────────────────────
--
-- Quatre verrous, comme pour `approval` et `graph_validation` : pas de
-- politique FOR ALL, droits retirés, déclencheurs de ligne, déclencheur
-- d'instruction pour TRUNCATE que les déclencheurs de ligne ne voient pas.

GRANT SELECT, INSERT ON azimut.message_schedule_approval TO authenticated;
REVOKE UPDATE, DELETE ON azimut.message_schedule_approval FROM authenticated;

CREATE FUNCTION azimut.block_message_schedule_approval_modification()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'message_schedule_approval records are insert-only';
END;
$$;

CREATE TRIGGER guard_message_schedule_approval_update
  BEFORE UPDATE ON azimut.message_schedule_approval
  FOR EACH ROW EXECUTE FUNCTION azimut.block_message_schedule_approval_modification();

CREATE TRIGGER guard_message_schedule_approval_delete
  BEFORE DELETE ON azimut.message_schedule_approval
  FOR EACH ROW EXECUTE FUNCTION azimut.block_message_schedule_approval_modification();

CREATE FUNCTION azimut.block_message_schedule_approval_truncate()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'message_schedule_approval records are insert-only and cannot be truncated';
END;
$$;

CREATE TRIGGER guard_message_schedule_approval_truncate
  BEFORE TRUNCATE ON azimut.message_schedule_approval
  FOR EACH STATEMENT EXECUTE FUNCTION azimut.block_message_schedule_approval_truncate();
