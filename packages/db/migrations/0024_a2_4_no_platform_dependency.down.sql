-- Retour en arrière de 0025. Rétablit la dépendance à la plateforme, et donc
-- le manquement à A2.4 : n'est là que pour la symétrie du corpus.

CREATE OR REPLACE FUNCTION azimut.user_org_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT org_id FROM azimut.membership WHERE user_id = auth.uid();
$$;

DROP FUNCTION IF EXISTS azimut.current_user_id();

ALTER TABLE azimut.membership
  ADD CONSTRAINT membership_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE azimut.proof
  ADD CONSTRAINT proof_reviewer_id_fkey
  FOREIGN KEY (reviewer_id) REFERENCES auth.users(id);
ALTER TABLE azimut.audit_log
  ADD CONSTRAINT audit_log_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES auth.users(id);
