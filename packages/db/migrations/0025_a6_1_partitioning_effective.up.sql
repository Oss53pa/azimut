-- A6.1 — rendre le cloisonnement par ligne effectif.
--
-- Constats du préalable K4 nº 7, établis sur une base réelle et consignés dans
-- docs/note-prealable-k4-7-cloisonnement.md :
--
--   1. 52 tables sur 55 n'avaient pas FORCE ROW LEVEL SECURITY, et toutes
--      appartiennent au rôle qui possède le schéma. Le propriétaire contourne
--      les politiques tant que FORCE n'est pas posé : la même requête rendait
--      1 site sous `authenticated` et 2 sous le propriétaire, une somme de
--      5 mètres contre 32.
--   2. Aucune migration ne portait un seul GRANT. Le rôle `authenticated`,
--      auquel toutes les politiques sont adressées, n'avait aucun droit sur le
--      schéma : les politiques n'étaient jamais exercées.
--   3. `approval`, `support_typology` et `support_version` portent `org_id`
--      sans politique ni sécurité activée. La migration 0007 activait la
--      sécurité nommément sur les tables d'alors ; 0009 et 0015 ont créé les
--      leurs sans s'en charger, et rien ne le disait.
--   4. Les deux déclencheurs d'insertion seule de `approval` sont par ligne.
--      TRUNCATE ne les déclenche pas et vidait la table.
--
-- Cette migration n'ajoute ni ne retire aucune colonne, et ne touche à aucune
-- donnée : elle pose des politiques, des droits et un déclencheur (A2.2-7).

-- ── 3. Les trois tables oubliées ──────────────────────────────────────────

ALTER TABLE azimut.approval         ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.support_typology ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.support_version  ENABLE ROW LEVEL SECURITY;

CREATE POLICY support_typology_org_policy ON azimut.support_typology
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

CREATE POLICY support_version_org_policy ON azimut.support_version
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

-- `approval` est en insertion seule (T-2.14a §5). Sa politique le dit, au lieu
-- de s'en remettre aux seuls déclencheurs : pas de FOR ALL, deux politiques
-- qui n'autorisent que la lecture et l'insertion dans son organisation.
CREATE POLICY approval_org_select ON azimut.approval
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()));

CREATE POLICY approval_org_insert ON azimut.approval
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));

-- ── 3 bis. La récursion que FORCE révèle sur `membership` ─────────────────
--
-- Les deux politiques posées par 0007 sur `membership` appellent
-- `user_org_ids()`, qui lit `membership`, qui applique la politique. Tant que
-- la table n'était pas forcée, la fonction, en SECURITY DEFINER, s'exécutait
-- comme propriétaire et contournait la politique : la boucle ne se fermait
-- pas. Sous FORCE, elle se ferme, et toute requête meurt sur un dépassement de
-- pile. Constaté à l'essai, avant d'écrire le test.
--
-- La politique de `membership` devient donc non récursive : chacun voit ses
-- propres rattachements, et rien d'autre. C'est plus strict que la politique
-- générique de A6.1, jamais plus permissif, et c'est exactement l'ensemble
-- dont `user_org_ids()` a besoin.
--
-- Conséquence assumée : la liste des membres d'une organisation n'est plus
-- lisible par cette politique. Ce service relève des droits de rôle de A6.2,
-- dont N13.4 dit que la déclinaison fine reste à faire. Porté en « constaté,
-- non traité ».
DROP POLICY IF EXISTS membership_select ON azimut.membership;
DROP POLICY IF EXISTS membership_manage ON azimut.membership;

CREATE POLICY membership_own_rows ON azimut.membership
  FOR ALL TO authenticated
  USING (user_id = azimut.current_user_id())
  WITH CHECK (user_id = azimut.current_user_id());

-- ── 1. FORCE sur toute table portant org_id ───────────────────────────────
--
-- `organization` y figure : son `id` tient lieu d'org_id et elle porte déjà
-- ses propres politiques. `rules_pack` et `rules_pack_rule` en sont exclues :
-- elles sont globales, sans org_id, et leur politique est en lecture seule —
-- les forcer empêcherait le chargement d'un paquet de règles.
DO $$
DECLARE
  t text;
  forced_tables text[] := ARRAY[
    'organization','membership','site','building','level','zone',
    'plan_source','plan_calibration','footprint','volume','opening',
    'node','edge','vertical_link','building_link','category','pictogram',
    'destination','destination_name','travel_profile','route_cache',
    'decision_point','support','support_face','support_content_block',
    'support_typology','support_version','proof','approval',
    'installed_support','divergence','work_order','charter','charter_color',
    'charter_typeface','charter_rule','lexicon_term','site_rules_binding',
    'kiosk','kiosk_package','kiosk_telemetry','job','audit_log',
    'delivery_package','control_point','site_fact','site_fact_forbidden_word',
    'source_claim','discrepancy_decision','parking','parking_space',
    'parking_uncovered_area','vehicle_gate'
  ];
BEGIN
  FOREACH t IN ARRAY forced_tables LOOP
    EXECUTE format('ALTER TABLE azimut.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END;
$$;

-- ── 2. Les droits du rôle auquel les politiques sont adressées ────────────

GRANT USAGE ON SCHEMA azimut TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA azimut TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA azimut TO authenticated;

-- Une table créée plus tard doit hériter des mêmes droits, sans quoi le défaut
-- que cette migration répare se reproduirait à la prochaine table.
ALTER DEFAULT PRIVILEGES IN SCHEMA azimut
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA azimut
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

-- L'insertion seule de `approval` se garantit aussi par les droits, et non par
-- la seule politique : le rôle n'a ni modification ni suppression sur elle.
REVOKE UPDATE, DELETE ON azimut.approval FROM authenticated;

-- ── 4. TRUNCATE sur la table des approbations ─────────────────────────────
--
-- Les déclencheurs de 0009 sont BEFORE UPDATE et BEFORE DELETE, par ligne.
-- TRUNCATE ne déclenche aucun déclencheur par ligne : vérifié, la table se
-- vidait. Il faut un déclencheur d'instruction.
CREATE OR REPLACE FUNCTION azimut.block_approval_truncate()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'approval records are insert-only and cannot be truncated';
END;
$$;

CREATE TRIGGER guard_approval_truncate
  BEFORE TRUNCATE ON azimut.approval
  FOR EACH STATEMENT EXECUTE FUNCTION azimut.block_approval_truncate();

-- Le journal d'audit est lui aussi en insertion seule (A5.10, A12.3, X4). Il
-- ne porte aujourd'hui ni déclencheur ni restriction de droits : porté en
-- « constaté, non traité », hors du périmètre de cette migration.
