-- Report de la PR 26 (master, 0075 à 0077 non appliquées) : deux règles que
-- la chaîne appliquée n'avait pas.
--
-- La base partagée suit la chaîne 0075 à 0084 ; les migrations 0075 à 0077
-- de master n'y ont jamais été appliquées et sont retirées du dépôt (décision
-- d'Oss53pa, 23 octobre 2026). Tout ce qu'elles posaient est déjà tenu par la
-- chaîne appliquée, souvent plus strictement (inscription fermée, auditeur
-- sans écriture, tableau des messages à l'`owner_rep`, journal écrit par la
-- base seule), sauf deux règles, reportées ici :
--
-- 1. Bon à tirer : l'`owner_rep` seul décide. A6.2 donne à l'`admin` « tout
--    dans son organisation », mais R2 (partie R) pose pour le tableau des
--    messages la séparation « celui qui génère ne peut pas approuver ». La même
--    séparation vaut pour le bon à tirer (décision d'Oss53pa, 23 octobre
--    2026) : la maîtrise d'ouvrage valide ce que la conception produit.
--
-- 2. `job` et `kiosk_package` : leur cycle de vie appartient au service de
--    compilation (T-0.11). Le service clôt un travail et enregistre un paquet
--    sous l'identité du demandeur ; ces écritures ne sont admises que d'une
--    session ouverte par le service, dont le rôle de connexion est membre
--    d'`azimut_compiler`. Une session de l'API (`authenticator`) ne l'est pas
--    et ne peut le devenir par aucun réglage qu'elle poserait. Depuis l'API,
--    un membre peut encore :
--      - créer un travail, en file, sans état, résultat ni horaire forgés ;
--      - annuler un travail en file (D9.2, « Annulation utilisateur »), sans
--        rien changer d'autre.
--    Il ne peut ni clore, ni modifier, ni supprimer un travail, ni écrire un
--    paquet de borne.
--
-- Additive : une politique remplacée, trois fonctions, deux déclencheurs.

-- 1. Bon à tirer : l'owner_rep seul.
ALTER POLICY role_insert ON azimut.approval
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids_with_role('{owner_rep}')));

-- 2. Cycle de vie des travaux et des paquets de borne.

-- La session vient-elle du service ? `session_user` est le rôle de connexion,
-- que `SET ROLE` ne change pas.
CREATE FUNCTION azimut.session_is_compiler()
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT pg_catalog.pg_has_role(session_user, 'azimut_compiler', 'MEMBER');
$$;

CREATE FUNCTION azimut.guard_job_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF azimut.session_is_compiler() THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.state <> 'queued' OR NEW.attempts <> 0 OR NEW.result IS NOT NULL
       OR NEW.started_at IS NOT NULL OR NEW.finished_at IS NOT NULL OR NEW.error IS NOT NULL THEN
      RAISE EXCEPTION 'job is created queued; its lifecycle belongs to the compiler service'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.state = 'queued' AND NEW.state = 'cancelled'
     AND to_jsonb(NEW) - 'state' = to_jsonb(OLD) - 'state' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'job lifecycle belongs to the compiler service' USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER guard_job_lifecycle
  BEFORE INSERT OR UPDATE OR DELETE ON azimut.job
  FOR EACH ROW EXECUTE FUNCTION azimut.guard_job_lifecycle();

CREATE FUNCTION azimut.guard_kiosk_package_writer()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF azimut.session_is_compiler() THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'kiosk_package is written by the compiler service only' USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER guard_kiosk_package_writer
  BEFORE INSERT OR UPDATE OR DELETE ON azimut.kiosk_package
  FOR EACH ROW EXECUTE FUNCTION azimut.guard_kiosk_package_writer();
