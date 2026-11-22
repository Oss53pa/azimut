-- S6.7b — la présence sur un niveau : qui l'a ouvert, sa sélection, sa zone
-- de travail, et le nom sous lequel ses collègues le voient.
--
-- S-22 : « La présence des utilisateurs, leur sélection et leur zone de
-- travail sont visibles. » G4.2 : « Les utilisateurs ayant le niveau ouvert
-- sont affichés en permanence dans la barre d'état, avec leur nom et l'heure
-- de leur dernière modification. »
--
-- Décisions d'Oss53pa consignées dans `docs/decoupage-s6-edition-simultanee.md` :
--   Q1  — la présence est une table, cloisonnée par organisation ;
--   Q12 — le nom affiché est une colonne `display_name` de `membership`, par
--         organisation, saisie par l'administrateur ; vide, seul le rôle
--         s'affiche ; rien n'est lu dans `auth.users` ;
--   Q13 — la sélection est une liste bornée de références `{table, id}`, la
--         zone le rectangle du cadrage en mètres du repère du niveau ; les
--         deux sont validées par schéma en base.
--
-- L'heure de la dernière modification n'est pas rangée ici : elle se lit dans
-- le journal (0078), qui porte l'auteur et le niveau de chaque commande. La
-- recopier serait une seconde source (INV-1).
--
-- La table ne figure ni en A5 ni en S9 ; elle est signalée à l'éditeur, comme
-- `command_journal`.
--
-- Additive : une colonne vide, une table neuve, un index, des fonctions
-- neuves. Aucune ligne existante n'est touchée (A2.2, point 7).

-- ── 1. Le nom affiché ──────────────────────────────────────────────────────
--
-- Les droits d'écriture sur `membership` restent retirés (0075) : la colonne
-- s'écrit par le chemin d'administration (AUTH.7), pas par le poste.

ALTER TABLE azimut.membership
  ADD COLUMN display_name text
    CHECK (display_name IS NULL
           OR (display_name = btrim(display_name) AND char_length(display_name) BETWEEN 1 AND 80));

-- ── 2. La validation par schéma ────────────────────────────────────────────
--
-- Constantes de forme, sans origine normative : 50 références au plus dans
-- une sélection, des coordonnées bornées à un million de mètres.

-- Une contrainte CHECK qui vaut NULL est acceptée : chaque fonction rend donc
-- un booléen défini, faux par défaut. Les conversions numériques ne sont
-- tentées qu'une fois le type vérifié, dans un CASE dont l'ordre est garanti.

CREATE FUNCTION azimut.presence_selection_valid(p_selection jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce(
    CASE WHEN jsonb_typeof(p_selection) = 'array' AND jsonb_array_length(p_selection) <= 50 THEN
      NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_selection) AS e(item)
        WHERE CASE
          WHEN jsonb_typeof(e.item) IS DISTINCT FROM 'object' THEN true
          WHEN (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(e.item) AS k)
               IS DISTINCT FROM ARRAY['id', 'table'] THEN true
          WHEN jsonb_typeof(e.item -> 'table') <> 'string' OR jsonb_typeof(e.item -> 'id') <> 'string' THEN true
          ELSE (e.item ->> 'table') !~ '^[a-z][a-z_]{0,62}$'
            OR (e.item ->> 'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        END
      )
    ELSE false END,
    false);
$$;

CREATE FUNCTION azimut.presence_zone_valid(p_zone jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce(
    CASE
      WHEN jsonb_typeof(p_zone) IS DISTINCT FROM 'object' THEN false
      WHEN (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(p_zone) AS k)
           IS DISTINCT FROM ARRAY['h', 'w', 'x', 'y'] THEN false
      WHEN jsonb_typeof(p_zone -> 'x') <> 'number' OR jsonb_typeof(p_zone -> 'y') <> 'number'
        OR jsonb_typeof(p_zone -> 'w') <> 'number' OR jsonb_typeof(p_zone -> 'h') <> 'number' THEN false
      ELSE abs((p_zone ->> 'x')::numeric) <= 1000000
       AND abs((p_zone ->> 'y')::numeric) <= 1000000
       AND (p_zone ->> 'w')::numeric > 0 AND (p_zone ->> 'w')::numeric <= 1000000
       AND (p_zone ->> 'h')::numeric > 0 AND (p_zone ->> 'h')::numeric <= 1000000
    END,
    false);
$$;

-- ── 3. La table ────────────────────────────────────────────────────────────

CREATE TABLE azimut.level_presence (
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE CASCADE,
  level_id uuid NOT NULL REFERENCES azimut.level(id) ON DELETE CASCADE,
  -- Sans renvoi vers `auth.users`, table de la plateforme absente d'une
  -- installation autonome (A2.4, migration 0024). Un utilisateur parti n'a
  -- plus de rattachement : `member_label` ne rend rien pour lui, et sa ligne
  -- sort de la liste ; elle expire de toute façon.
  user_id uuid NOT NULL DEFAULT azimut.current_user_id(),
  selection jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (azimut.presence_selection_valid(selection)),
  zone jsonb CHECK (zone IS NULL OR azimut.presence_zone_valid(zone)),
  -- Posée par la base à chaque écriture : un poste ne peut pas se dire
  -- présent plus longtemps qu'il ne l'est.
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (level_id, user_id)
);

CREATE INDEX idx_level_presence_org ON azimut.level_presence(org_id);

-- La dernière modification d'un auteur sur un niveau, lue dans le journal.
CREATE INDEX idx_command_journal_level_author
  ON azimut.command_journal(level_id, author_id, recorded_at);

CREATE FUNCTION azimut.stamp_level_presence()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.seen_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER stamp_level_presence
  BEFORE INSERT OR UPDATE ON azimut.level_presence
  FOR EACH ROW EXECUTE FUNCTION azimut.stamp_level_presence();

-- ── 4. Cloisonnement (A6.1) et rôles (0076, 0079, 0080) ────────────────────
--
-- Chacun lit la présence de ses organisations, et n'écrit que la sienne, sur
-- un niveau de l'organisation qu'il annonce.

ALTER TABLE azimut.level_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.level_presence FORCE ROW LEVEL SECURITY;

CREATE POLICY level_presence_org_select ON azimut.level_presence
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()));

CREATE POLICY level_presence_own_insert ON azimut.level_presence
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (SELECT azimut.user_org_ids())
    AND user_id = azimut.current_user_id()
    AND EXISTS (SELECT 1 FROM azimut.level l WHERE l.id = level_id AND l.org_id = level_presence.org_id)
  );

CREATE POLICY level_presence_own_update ON azimut.level_presence
  FOR UPDATE TO authenticated
  USING (user_id = azimut.current_user_id())
  WITH CHECK (
    org_id IN (SELECT azimut.user_org_ids())
    AND user_id = azimut.current_user_id()
    AND EXISTS (SELECT 1 FROM azimut.level l WHERE l.id = level_id AND l.org_id = level_presence.org_id)
  );

CREATE POLICY level_presence_own_delete ON azimut.level_presence
  FOR DELETE TO authenticated
  USING (user_id = azimut.current_user_id());

-- Les politiques restrictives que toute table portant `org_id` reçoit.
-- L'`auditor` n'écrit nulle part (0076) : il voit qui est présent, il ne
-- s'annonce pas.
CREATE POLICY level_presence_auditor_no_insert ON azimut.level_presence
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (org_id NOT IN (SELECT azimut.user_org_ids_with_role('{auditor}')));
CREATE POLICY level_presence_auditor_no_update ON azimut.level_presence
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (org_id NOT IN (SELECT azimut.user_org_ids_with_role('{auditor}')))
  WITH CHECK (org_id NOT IN (SELECT azimut.user_org_ids_with_role('{auditor}')));
CREATE POLICY level_presence_auditor_no_delete ON azimut.level_presence
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (org_id NOT IN (SELECT azimut.user_org_ids_with_role('{auditor}')));
CREATE POLICY level_presence_marketing_no_access ON azimut.level_presence
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id NOT IN (SELECT azimut.user_org_ids_with_role('{marketing}')))
  WITH CHECK (org_id NOT IN (SELECT azimut.user_org_ids_with_role('{marketing}')));
CREATE POLICY level_presence_mfa_required ON azimut.level_presence
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id NOT IN (SELECT azimut.org_ids_lacking_mfa()))
  WITH CHECK (org_id NOT IN (SELECT azimut.org_ids_lacking_mfa()));

GRANT SELECT, INSERT, UPDATE, DELETE ON azimut.level_presence TO authenticated;
REVOKE TRUNCATE ON azimut.level_presence FROM authenticated;

-- ── 5. S'annoncer, partir ──────────────────────────────────────────────────
--
-- Sous les droits et les politiques de l'appelant, comme `apply_commands`.
-- Un niveau invisible et un niveau absent se refusent de la même façon : le
-- refus ne dit rien d'une autre organisation (A6.1).

CREATE FUNCTION azimut.touch_presence(p_level_id uuid, p_selection jsonb, p_zone jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT l.org_id INTO v_org FROM azimut.level l WHERE l.id = p_level_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'presence refused' USING ERRCODE = '42501';
  END IF;
  INSERT INTO azimut.level_presence(org_id, level_id, user_id, selection, zone)
  VALUES (v_org, p_level_id, azimut.current_user_id(), coalesce(p_selection, '[]'::jsonb), p_zone)
  ON CONFLICT (level_id, user_id)
  DO UPDATE SET selection = EXCLUDED.selection, zone = EXCLUDED.zone;
END;
$$;

CREATE FUNCTION azimut.leave_presence(p_level_id uuid)
RETURNS void
LANGUAGE sql
SET search_path = ''
AS $$
  DELETE FROM azimut.level_presence
  WHERE level_id = p_level_id AND user_id = azimut.current_user_id();
$$;

-- ── 6. Lire qui est là ─────────────────────────────────────────────────────
--
-- Le nom d'un collègue est dans son rattachement, que l'appelant ne lit pas :
-- 0075 ne laisse voir à chacun que les siens, et la table est en FORCE ROW
-- LEVEL SECURITY, si bien qu'une fonction SECURITY DEFINER y reste soumise.
--
-- Ouvrir la table aux collègues par une politique ordinaire défaireait 0075
-- pour toute lecture directe, et une politique de `membership` qui consulte
-- `membership` se rappellerait sans fin. Le passage est donc étroit, sur le
-- modèle du garde `azimut.journal_writer` (0078) :
--
--   1. `member_label` vérifie d'abord, sur les seuls rattachements de
--      l'appelant, qu'il est membre de l'organisation, qu'il n'y est pas
--      `marketing`, et que son second facteur est tenu (0079, 0080) ;
--   2. elle pose alors, le temps de sa lecture, un réglage de transaction qui
--      nomme cette organisation, et le retire aussitôt ;
--   3. la politique `membership_colleague_label` ne s'ouvre que pour
--      l'organisation ainsi nommée.
--
-- Un client PostgREST ne peut pas poser ce réglage : aucune fonction exposée
-- ne le fait, hors celle-ci. La fonction rend le nom affiché et le rôle, rien
-- d'autre.

CREATE POLICY membership_colleague_label ON azimut.membership
  FOR SELECT TO authenticated
  USING (org_id::text = current_setting('azimut.member_label_org', true));

CREATE FUNCTION azimut.member_label(p_org uuid, p_user uuid)
RETURNS TABLE (display_name text, role text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_org NOT IN (SELECT azimut.user_org_ids())
     OR p_org IN (SELECT azimut.user_org_ids_with_role('{marketing}'))
     OR p_org IN (SELECT azimut.org_ids_lacking_mfa()) THEN
    RETURN;
  END IF;
  PERFORM set_config('azimut.member_label_org', p_org::text, true);
  RETURN QUERY
    SELECT m.display_name, m.role FROM azimut.membership m
    WHERE m.org_id = p_org AND m.user_id = p_user;
  PERFORM set_config('azimut.member_label_org', '', true);
END;
$$;

REVOKE ALL ON FUNCTION azimut.member_label(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION azimut.member_label(uuid, uuid) TO authenticated;

-- Les présents d'un niveau. Une présence non renouvelée depuis 30 secondes
-- est tenue pour partie ; constante technique, sans origine normative, que
-- le poste respecte en se renouvelant plus souvent.
CREATE FUNCTION azimut.level_presence_list(p_level_id uuid)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  role text,
  selection jsonb,
  zone jsonb,
  seen_at timestamptz,
  last_change_at timestamptz
)
LANGUAGE sql
SET search_path = ''
AS $$
  SELECT p.user_id, lbl.display_name, lbl.role, p.selection, p.zone, p.seen_at,
         (SELECT max(j.recorded_at) FROM azimut.command_journal j
          WHERE j.level_id = p.level_id AND j.author_id = p.user_id)
  FROM azimut.level_presence p
  CROSS JOIN LATERAL azimut.member_label(p.org_id, p.user_id) AS lbl
  WHERE p.level_id = p_level_id
    AND p.seen_at > now() - interval '30 seconds'
  ORDER BY p.user_id;
$$;

REVOKE ALL ON FUNCTION azimut.touch_presence(uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION azimut.leave_presence(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION azimut.level_presence_list(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION azimut.touch_presence(uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION azimut.leave_presence(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION azimut.level_presence_list(uuid) TO authenticated;
