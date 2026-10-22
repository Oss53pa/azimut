-- A6.1 et A6.2 : le cloisonnement tient aussi par les clés étrangères, les
-- signatures et les fonctions privilégiées.
--
-- Ce qui change :
--
-- 1. Les clés étrangères entre deux tables portant `org_id` deviennent
--    composites : `(org_id, x_id)` vise `(org_id, id)`. Une ligne de A ne peut
--    plus désigner une ligne de B. Avant, la vérification d'une clé étrangère
--    ignorant la sécurité par ligne, viser le `site_id` d'une autre
--    organisation réussissait là où un identifiant absent échouait : la
--    différence révélait l'existence de la ligne (A6.1, second test
--    obligatoire). Désormais les deux cas échouent de la même façon, par la
--    même recherche dans le même index : même code (23503), même message, et
--    le détail ne cite que les valeurs fournies par l'appelant.
-- 2. Les signatures sont posées par la base et ne se réécrivent plus :
--    `approval.reviewer_id`, `review_annotation.author_id`, `resolved_by` et
--    `resolved_at`, `review_annotation_reply.author_id`, `sketch_layer.owner_id`
--    (J3.3 : « une esquisse porte son auteur »). Jusqu'ici une valeur par
--    défaut les remplissait, mais l'appelant pouvait en fournir une autre, et
--    la réécrire ensuite.
-- 3. La validation d'une épreuve met de nouveau l'épreuve à jour. Depuis 0075,
--    le déclencheur, possédé par le propriétaire des tables, membre de
--    `authenticated`, subissait les politiques par rôle : un `owner_rep`
--    validait, et l'épreuve restait `pending` sans que rien ne le dise. Le
--    déclencheur appartient maintenant à `azimut_proof_review`, rôle sans
--    connexion, qui ne voit des épreuves que celles des organisations de
--    l'utilisateur courant, et ne touche que l'épreuve de l'organisation de la
--    validation.
-- 4. Les trois fonctions SECURITY DEFINER de 0009 et 0017 n'avaient pas de
--    chemin de recherche figé. Les deux gardes, qui ne lisent aucune table,
--    perdent le privilège ; le déclencheur de validation garde le sien, avec
--    un chemin vide.
-- 5. Le registre des migrations ne s'accorde plus à `authenticated` ni à
--    `anon` : 0025 lui donnait tous les droits, et `apply_commands` pouvait
--    l'atteindre.
--
-- Additive au sens d'A2.2, point 7 : aucune ligne n'est modifiée ni retirée.
-- Si une ligne existante désigne une ligne d'une autre organisation, la pose
-- de la clé composite échoue et la migration s'annule entière : c'est une
-- fuite à examiner, pas une donnée à corriger en silence.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'azimut_proof_review') THEN
    CREATE ROLE azimut_proof_review NOLOGIN;
  END IF;
END;
$$;

-- ── 1. Clés étrangères composites ─────────────────────────────────────────
--
-- Lues sur le catalogue plutôt qu'écrites une à une : 107 clés, et une liste
-- recopiée à la main en oublierait. Chaque clé garde son nom et son action ;
-- `SET NULL` ne remet à nul que la colonne visée, jamais `org_id`
-- (PostgreSQL 15). Un commentaire marque ce qui a été converti, pour que le
-- retour ne défasse que cela.

DO $$
DECLARE
  r record;
  v_action text;
BEGIN
  FOR r IN
    SELECT DISTINCT c.confrelid::regclass AS ref, t.relname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.confrelid
    WHERE c.connamespace = 'azimut'::regnamespace AND c.contype = 'f'
      AND cardinality(c.conkey) = 1
      AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attname = 'org_id' AND NOT a.attisdropped)
      AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.confrelid AND a.attname = 'org_id' AND NOT a.attisdropped)
    ORDER BY t.relname
  LOOP
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I UNIQUE (org_id, id)', r.ref, r.relname || '_org_id_id_key');
    EXECUTE format('COMMENT ON CONSTRAINT %I ON %s IS %L', r.relname || '_org_id_id_key', r.ref,
      'A6.1 (0076) : cible des clés composites par organisation');
  END LOOP;

  FOR r IN
    SELECT c.conname, c.conrelid::regclass AS tbl, c.confrelid::regclass AS ref,
           a.attname AS col, c.confdeltype
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    JOIN pg_attribute fa ON fa.attrelid = c.confrelid AND fa.attnum = c.confkey[1]
    WHERE c.connamespace = 'azimut'::regnamespace AND c.contype = 'f'
      AND cardinality(c.conkey) = 1 AND fa.attname = 'id'
      AND EXISTS (SELECT 1 FROM pg_attribute o WHERE o.attrelid = c.conrelid AND o.attname = 'org_id' AND NOT o.attisdropped)
      AND EXISTS (SELECT 1 FROM pg_attribute o WHERE o.attrelid = c.confrelid AND o.attname = 'org_id' AND NOT o.attisdropped)
    ORDER BY c.conrelid::regclass::text, c.conname
  LOOP
    v_action := CASE r.confdeltype
      WHEN 'c' THEN 'CASCADE'
      WHEN 'r' THEN 'RESTRICT'
      WHEN 'a' THEN 'NO ACTION'
      WHEN 'n' THEN format('SET NULL (%I)', r.col)
      WHEN 'd' THEN format('SET DEFAULT (%I)', r.col)
    END;
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (org_id, %I) REFERENCES %s (org_id, id) ON DELETE %s',
      r.tbl, r.conname, r.col, r.ref, v_action);
    EXECUTE format('COMMENT ON CONSTRAINT %I ON %s IS %L', r.conname, r.tbl,
      'A6.1 (0076) : clé composite par organisation');
  END LOOP;
END;
$$;

-- ── 2. Signatures posées par la base ──────────────────────────────────────
--
-- À l'insertion, la colonne nommée reçoit l'utilisateur courant, quoi que
-- l'appelant ait fourni ; sans utilisateur courant, l'écriture est refusée.
-- À la mise à jour, elle garde sa valeur. Le nom de colonne vient de la
-- définition du déclencheur, jamais de l'appelant.

CREATE FUNCTION azimut.stamp_current_user()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_me uuid := azimut.current_user_id();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF v_me IS NULL THEN
      RAISE EXCEPTION 'EDIT.WRITE_REFUSED' USING ERRCODE = '42501';
    END IF;
    NEW := jsonb_populate_record(NEW, jsonb_build_object(TG_ARGV[0], v_me));
  ELSE
    NEW := jsonb_populate_record(NEW, jsonb_build_object(TG_ARGV[0], to_jsonb(OLD) -> TG_ARGV[0]));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER stamp_reviewer_id BEFORE INSERT ON azimut.approval
  FOR EACH ROW EXECUTE FUNCTION azimut.stamp_current_user('reviewer_id');
CREATE TRIGGER stamp_author_id BEFORE INSERT OR UPDATE ON azimut.review_annotation
  FOR EACH ROW EXECUTE FUNCTION azimut.stamp_current_user('author_id');
CREATE TRIGGER stamp_author_id BEFORE INSERT OR UPDATE ON azimut.review_annotation_reply
  FOR EACH ROW EXECUTE FUNCTION azimut.stamp_current_user('author_id');
CREATE TRIGGER stamp_owner_id BEFORE INSERT OR UPDATE ON azimut.sketch_layer
  FOR EACH ROW EXECUTE FUNCTION azimut.stamp_current_user('owner_id');

-- La clôture d'une annotation (0073) n'était signée qu'au changement d'état :
-- une insertion déjà close, ou une mise à jour de `resolved_by` seul, passait
-- la signature de l'appelant. Elle est maintenant posée à toute écriture.
CREATE OR REPLACE FUNCTION azimut.review_annotation_sign() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
BEGIN
  IF NEW.state = 'open' THEN
    NEW.resolved_by := NULL;
    NEW.resolved_at := NULL;
  ELSIF TG_OP = 'INSERT' OR OLD.state = 'open' THEN
    NEW.resolved_by := azimut.current_user_id();
    NEW.resolved_at := now();
  ELSE
    NEW.resolved_by := OLD.resolved_by;
    NEW.resolved_at := OLD.resolved_at;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER review_annotation_sign ON azimut.review_annotation;
CREATE TRIGGER review_annotation_sign BEFORE INSERT OR UPDATE ON azimut.review_annotation
  FOR EACH ROW EXECUTE FUNCTION azimut.review_annotation_sign();

-- ── 3. La validation met l'épreuve à jour ─────────────────────────────────

CREATE OR REPLACE FUNCTION azimut.apply_approval_to_proof()
RETURNS trigger
SECURITY DEFINER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  UPDATE azimut.proof
    SET status = NEW.decision,
        reviewed_at = NEW.decided_at,
        reviewer_id = NEW.reviewer_id
    WHERE id = NEW.proof_id
      AND org_id = NEW.org_id
      AND status = 'pending';
  RETURN NEW;
END;
$$;

GRANT USAGE ON SCHEMA azimut TO azimut_proof_review;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    GRANT USAGE ON SCHEMA auth TO azimut_proof_review;
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE WARNING 'GRANT USAGE ON SCHEMA auth TO azimut_proof_review refusé : à exécuter par un rôle d''administration (ORDRE.md, 0076).';
END;
$$;
GRANT SELECT (id, org_id, status), UPDATE (status, reviewed_at, reviewer_id) ON azimut.proof TO azimut_proof_review;

CREATE POLICY proof_review_select ON azimut.proof
  FOR SELECT TO azimut_proof_review
  USING (org_id IN (SELECT azimut.user_org_ids()));
CREATE POLICY proof_review_update ON azimut.proof
  FOR UPDATE TO azimut_proof_review
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

REVOKE ALL ON FUNCTION azimut.apply_approval_to_proof() FROM PUBLIC;
GRANT CREATE ON SCHEMA azimut TO azimut_proof_review;
ALTER FUNCTION azimut.apply_approval_to_proof() OWNER TO azimut_proof_review;
REVOKE CREATE ON SCHEMA azimut FROM azimut_proof_review;

-- ── 4. Les gardes sans privilège ──────────────────────────────────────────

ALTER FUNCTION azimut.block_approval_modification() SECURITY INVOKER SET search_path = '';
ALTER FUNCTION azimut.guard_support_version_frozen_hash() SECURITY INVOKER SET search_path = '';

-- ── 5. Le registre des migrations ─────────────────────────────────────────
--
-- Il n'existe que sous `scripts/migrate.js` ; un montage par `psql` (CI) ne le
-- crée pas.

DO $$
BEGIN
  IF to_regclass('azimut._migrations') IS NOT NULL THEN
    REVOKE ALL ON azimut._migrations FROM PUBLIC, authenticated;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      REVOKE ALL ON azimut._migrations FROM anon;
    END IF;
  END IF;
  IF to_regclass('azimut._migrations_id_seq') IS NOT NULL THEN
    REVOKE ALL ON SEQUENCE azimut._migrations_id_seq FROM PUBLIC, authenticated;
  END IF;
END;
$$;
