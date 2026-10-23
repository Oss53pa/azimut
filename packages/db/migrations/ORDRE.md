# Ordre d'application des migrations

Ce fichier fixe l'ordre. Il fait foi, et non le tri des noms de fichiers.

## Pourquoi il existe

Quatre numéros sont portés par deux migrations chacun (`0018`, `0019`, `0020`
et `0021`) parce que deux travaux ont avancé en parallèle et se sont rejoints
à la fusion. Le tri lexicographique les départage de fait, mais rien ne le
disait, et un outil qui trierait autrement appliquerait le schéma dans un ordre
différent.

## Pourquoi elles ne sont pas renumérotées

Le registre d'application est tenu par nom, dans la table `_migrations`.
Renommer une migration déjà appliquée la ferait réapparaître comme non
appliquée, et sa réexécution échouerait sur des objets existants. Le renommage
casserait donc toute base à jour, pour un gain d'esthétique.

L'ordre ci-dessous est celui, lexicographique, dans lequel les migrations ont
été appliquées et vérifiées : 29 sur 29, sans échec, sur une grappe montée pour
le préalable K4 nº 7. Le figer coûte un fichier et ne casse rien.

## Avant le corpus, sur une installation autonome

`bootstrap-standalone.sql` n'est pas une migration et ne figure pas dans la
liste ci-dessous. Il s'exécute une fois, avant `0001`, sur une base neuve qui
n'est pas hébergée par une plateforme fournissant un schéma `auth`.

Motif : `0002` et `0006` créent trois clés étrangères vers `auth.users`, que
`0024` retire au titre de A2.4, mais `0024` passe après, et sur une base neuve
`0002` échoue avant qu'elle n'ait la parole. Réécrire `0002` et `0006`
corrigerait la cause, au prix de faire diverger toute base à jour de son
registre d'application. Le préalable coûte moins cher et ne casse rien.

Sur une plateforme qui fournit `auth`, ne rien exécuter : ce fichier ne doit
jamais toucher la table de comptes d'un hébergeur, et `0024` ne la supprime pas
non plus, elle n'en retire que les clés étrangères.

## L'ordre

```
0001_setup
0002_a5_1_organization_access
0003_a5_2_site_geometry
0004_a5_3_circulation
0005_a5_4_destinations
0006_a5_5_to_a5_10_remaining
0007_a6_1_rls_policies
0008_inv3_safety_registry
0009_approval_insert_only
0010_d11_delivery_package
0011_k2_1_volume_render_order
0012_a5_6_support_registry_reading_distance
0013_a5_6_support_context
0014_a5_6_support_instance_dimensions
0015_a5_6_support_typology_version
0016_a5_6_face_content_block_reshape
0017_t2_14a_support_version_frozen_hash
0018_atelier_m1_4_measured_calibration
0018_n1_2_footprint_unit_code
0019_atelier_m3_site_fact
0019_n1_2_footprint_kind_closed
0020_atelier_m16_source_claim
0020_n1_2_missing_fields
0021_atelier_m2_parking
0021_s1_site_origin
0022_s1_calibration_timestamp
0023_a5_2_one_calibration_per_plan
0024_a2_4_no_platform_dependency
0025_a6_1_partitioning_effective
0026_e5_1_apply_commands
0027_n2_2_wayfinding_tables
0028_n1_2_site_origin_unit_suffix
0029_a5_2_zone_opening_kind
0030_q5_legal_entity
0031_o4_site_timezone
0032_a5_2_calibration_pixels
0033_a5_2_plan_calibration_point
0034_m01_s3_unit_code_required
0035_a5_3_graph_validation
0036_a5_11_graph_validation_no_cascade
0037_a5_11_approval_no_cascade
0038_a5_11_audit_log_no_cascade
0039_a5_11_no_cascade_to_org_or_site
0040_q9_country
0041_a5_7_divergence_support_node
0042_h6_worksite_tables
0043_h8_budget_tables
0044_i5_inspection_tables
0045_h4_advertising_tables
0046_h5_tenant_sign_tables
0047_a5_7_installed_support_columns
0048_h8_work_order_cost_minor
0049_a5_6_face_block_legacy_optional
0050_m01_s2_control_point_image_px
0051_a4_migrations_registry_in_schema
0052_m01_s2_drop_control_point
0053_a5_11_site_fact_status
0054_a5_8_charter_rule_text_kinds
0055_a5_2_footprint_parking_space
0056_a5_11_site_fact_target
0057_a5_2_zone_footprint_ids
0058_a5_3_parking_space_extension
0059_s_37_drop_parking_uncovered_area
0060_s_35_drop_parking
0061_drop_vehicle_gate
0062_a5_4_pictogram_function_key
0063_a5_4_function_scope_by_registry
0064_a5_4_safety_pictogram_requires_pack
0065_a5_8_rules_binding_role
0066_a5_2_drop_site_rules_pack_id
0067_a12_3_audit_log_insert_only
0068_a5_2_plan_source_content_kind
0069_o11_temporary_closure
0070_a6_1_job_requested_by
0071_t0_11_job_dispatch
0072_j3_4_sketch_layer
0073_j4_review_annotation
0074_r12_message_schedule_approval
0075_a6_2_membres_et_roles
0076_a6_1_cloisonnement_complet
0077_a6_2_fabricants_et_vendor
0078_e5_1_liste_blanche_commandes
0079_a2_4_identite_sous_le_proprietaire
0080_a6_3_double_authentification
0081_d5_d6_seuils_et_stockage
0082_a6_3_validation_des_entrees
0083_a12_3_journal_des_evenements
0084_d5_debit_et_quotas
```

## Règle pour la suite

Un numéro, une migration. Une migration nouvelle prend le numéro suivant le
plus élevé de cette liste, et s'y ajoute en dernière ligne. Le test
`migration-order.test.ts` échoue si ce fichier et le répertoire divergent, ou
si un numéro non déjà en collision se dédouble.

---

## Monter une base pour `pnpm test:db`

Les essais `*.db.test.ts` vérifient ce qu'aucune lecture de SQL ne montre : que
le cloisonnement tient en écriture, que la transaction est tout ou rien, et que
l'identité ne fuit pas d'une transaction à la suivante. Ils ne tournent pas
dans `pnpm test`, qui doit passer sur un poste nu.

Deux points comptent, et les manquer fait passer les essais pour de mauvaises
raisons.

**Le propriétaire des tables ne doit pas être superutilisateur.** Un
superutilisateur contourne `FORCE ROW LEVEL SECURITY`, et toutes les sondes de
cloisonnement réussissent alors en ne prouvant rien. C'est l'erreur commise au
premier montage du banc d'essai du préalable K4 nº 7.

**Le rôle applicatif doit être membre de `authenticated`.** Les politiques lui
sont toutes adressées ; un rôle qui n'en est pas membre n'a aucune politique et
ne voit rien.

**Les deux rôles de la file des travaux (0071).** `azimut_compiler` est le
rôle du service de compilation : il n'a aucun droit sur les tables et
n'exécute que les trois fonctions de prise. `azimut_job_dispatch` possède ces
fonctions et ne sert à aucune connexion. La migration les crée s'ils manquent ;
un propriétaire qui n'a pas le droit de créer un rôle les reçoit d'un compte
d'administration, avant les migrations, et doit être membre de
`azimut_job_dispatch` pour lui confier les fonctions. La connexion du service,
en production, est membre de `azimut_compiler` et de `authenticated`, et de
rien d'autre : elle prend un travail sous le premier, puis le traite sous
l'identité de son demandeur.

**Le rôle propriétaire des membres (0075).** `azimut_membership_admin` possède
les fonctions qui créent une organisation et inscrivent, changent ou retirent
un membre, ainsi que la lecture des organisations où l'utilisateur courant tient
un rôle. Il ne sert à aucune connexion et personne ne l'endosse. Même règle que
pour la file : la migration le crée s'il manque, sinon il est créé avant, et le
propriétaire doit en être membre pour lui confier les fonctions. Sur une
plateforme qui fournit `auth`, il doit aussi pouvoir lire `auth.uid()` : la
migration accorde `USAGE` sur le schéma `auth`, et si le rôle qui migre ne le
peut pas, elle l'annonce par un avertissement. Le pas se fait alors sous un
rôle d'administration : `GRANT USAGE ON SCHEMA auth TO azimut_membership_admin;`.
Tant qu'il manque, les fonctions de membres refusent tout : rien ne s'ouvre.

**Les politiques par rôle (0075).** Toute table nouvelle portant `org_id`
reçoit, dans sa migration, les politiques restrictives `role_read`,
`role_insert`, `role_update` et `role_delete` (seulement les deux premières
pour une table en insertion seule). `a6-2-roles.db.test.ts` lit la base et
échoue si l'une manque.

**Le rôle propriétaire de la validation (0076).** `azimut_proof_review`
possède le déclencheur qui reporte une validation sur son épreuve. Même règle
que les rôles précédents : créé avant les migrations si le propriétaire ne
peut pas créer de rôle, et le propriétaire en est membre. Sur une plateforme
qui fournit `auth`, il doit pouvoir lire `auth.uid()` :
`GRANT USAGE ON SCHEMA auth TO azimut_proof_review;` si la migration l'annonce
par un avertissement. Tant qu'il manque, une validation n'atteint pas son
épreuve.

**Les clés étrangères entre tables d'organisation (0076).** Une clé
étrangère d'une table portant `org_id` vers une autre table portant `org_id`
s'écrit `(org_id, x_id) REFERENCES t (org_id, id)`, et la table visée porte
`UNIQUE (org_id, id)`. Une clé simple laisserait une ligne désigner une ligne
d'une autre organisation. `a6-1-catalogue.db.test.ts` lit la base et échoue
sur toute clé simple de ce genre, comme sur une table sans politique, une
politique ouverte à tous ou une fonction SECURITY DEFINER sans chemin de
recherche figé.

**Le rattachement du `vendor` (0077).** Un compte au rôle `vendor` ne voit
que les lots du fabricant auquel il est rattaché (`vendor_member`), et ce qui
en dépend. Une table nouvelle que ce rôle doit lire reçoit, dans sa
politique `role_read`, la branche qui la relie à `lot_support` ; sinon le
`vendor` ne la voit pas, ce qui est le défaut voulu.

**L'identité sous le propriétaire (0079).** `current_user_id()` s'exécute
sous le propriétaire des tables. Sur une plateforme dont le schéma `auth`
appartient à un autre administrateur, les rôles propriétaires des fonctions
n'ont pas besoin de l'usage de `auth` : les pas manuels décrits pour 0075 et
0076 deviennent sans objet une fois 0079 appliquée.

**Les seuils et le stockage (0081).** Les seuils de taille, de nombre et de
durée vivent dans `azimut.security_setting`, avec leur source ; une
organisation ne peut que les resserrer (`org_security_setting`). Les quatre
espaces de stockage `azimut-*` et leurs politiques sont posés par
`azimut.install_storage()`, que la migration appelle si le schéma `storage`
existe. Si la plateforme le fournit plus tard, ou si la migration l'annonce
par un avertissement de droits : `SELECT azimut.install_storage();` sous un
rôle d'administration.

**Le débit et les quotas (0084).** Les écritures, les changements de
membres, les créations d'organisation et les dépôts de travaux sont comptés
par fenêtre dans `azimut.rate_counter`, sous le rôle sans connexion
`azimut_rate`, avec les seuils de `security_setting` (`rate.*`, `job.*`). Un
dépassement rend une erreur `rate_limited` que PostgREST traduit en 429 avec
`Retry-After`, et laisse une ligne `rate_limited` au journal technique de la
base. Une table créée plus tard reçoit, avec sa garde des entrées, son
déclencheur de débit :

```sql
CREATE TRIGGER rate_write AFTER INSERT OR UPDATE OR DELETE ON azimut.<table>
  FOR EACH STATEMENT EXECUTE FUNCTION azimut.rate_write();
```

Sur une plateforme où le rôle qui migre n'est pas super-utilisateur :
`CREATE ROLE azimut_rate NOLOGIN; GRANT azimut_rate TO <rôle qui migre> WITH INHERIT TRUE;`

**Le journal des événements (0083).** `audit_log` n'est écrit que par la
base : des déclencheurs, sous le rôle sans connexion `azimut_audit`,
journalisent les cinq événements d'A12.3 avec l'identité de la requête.
L'application n'y insère plus. Sur une plateforme où le rôle qui migre n'est
pas super-utilisateur, il doit être membre d'`azimut_audit` avec héritage
pour lui confier les fonctions, comme pour les autres rôles propriétaires :

```sql
CREATE ROLE azimut_audit NOLOGIN;
GRANT azimut_audit TO <rôle qui migre> WITH INHERIT TRUE;
```

**Le propriétaire des tables (D-10).** Le rôle qui possède le schéma et ses
tables est distinct des rôles de l'application, et aucun d'eux ne peut
l'endosser : ni `authenticator`, ni `anon`, ni `authenticated`, ni les rôles du
compilateur. C'est ce qui rend l'insertion seule d'A12.3 effective, puisque le
propriétaire peut retirer les barrières d'une table. Le compilateur se
connecte sous un rôle de connexion propre, membre de `azimut_compiler` et de
`azimut_job_dispatch`, jamais sous le propriétaire.
`d10-proprietaire.db.test.ts` échoue si un rôle de l'application devient
membre du propriétaire.

**La garde des entrées (0082).** Chaque table du schéma, `audit_log`
exceptée, porte le déclencheur `guard_input`, qui refuse un texte à caractère
de contrôle, à forçage de direction ou hors forme NFC, et une valeur au-delà
des plafonds `input.text.max_chars` et `input.json.max_bytes`. Une table créée
plus tard le reçoit dans sa propre migration :

```sql
CREATE TRIGGER guard_input BEFORE INSERT OR UPDATE ON azimut.<table>
  FOR EACH ROW EXECUTE FUNCTION azimut.guard_input();
```

`input-catalogue.db.test.ts` échoue tant qu'une table en est dépourvue, et
tant que le catalogue des colonnes du modèle (`core-model/src/input`) ne
reproduit pas celui de la base. Après une migration qui touche des colonnes,
`AZIMUT_WRITE_INPUT_CATALOGUE=1 pnpm test:rls input-catalogue` le réécrit ;
la déclaration réécrite se relit avant d'être commise.

**La liste blanche des commandes (0078).** `azimut.command_table` dit quelles
tables `apply_commands` peut viser. Une table attribuée à un module dans
`OWNED_TABLES` (`packages/core-model/src/module-ownership.ts`) y entre par
la migration qui la crée, avec ses opérations ; `a6-1-liste-blanche.db.test.ts`
échoue tant que la liste et le registre divergent.

```sh
initdb -D "$PGDATA" -U postgres --auth=trust
pg_ctl -D "$PGDATA" -o '-p 54332' -l "$PGDATA/server.log" start -w

psql -p 54332 -U postgres -d postgres <<'SQL'
CREATE ROLE azimut LOGIN;
CREATE ROLE authenticated NOLOGIN;
GRANT authenticated TO azimut;
CREATE ROLE azimut_compiler NOLOGIN;
CREATE ROLE azimut_job_dispatch NOLOGIN;
GRANT azimut_compiler, azimut_job_dispatch TO azimut;
CREATE ROLE azimut_membership_admin NOLOGIN;
GRANT azimut_membership_admin TO azimut;
CREATE ROLE azimut_proof_review NOLOGIN;
GRANT azimut_proof_review TO azimut;
CREATE ROLE azimut_audit NOLOGIN;
GRANT azimut_audit TO azimut;
CREATE ROLE azimut_rate NOLOGIN;
GRANT azimut_rate TO azimut;
CREATE DATABASE azimut OWNER azimut;
SQL

# Installation autonome uniquement : pas sur une plateforme qui fournit `auth`.
psql -p 54332 -U azimut -d azimut -f packages/db/migrations/bootstrap-standalone.sql

for f in packages/db/migrations/0*.up.sql; do
  psql -p 54332 -U azimut -d azimut -v ON_ERROR_STOP=1 -q -f "$f"
done

DATABASE_URL='postgres://azimut@127.0.0.1:54332/azimut' pnpm seed:reference

AZIMUT_TEST_DATABASE_URL='postgres://azimut@127.0.0.1:54332/azimut' pnpm test:db
```

`pnpm seed:reference` verse les référentiels globaux depuis leurs fichiers,
aujourd'hui les pays de Q9. Il s'exécute dans tous les environnements, à chaque
déploiement, à la différence de `db:reset` qui refuse hors du local : un
référentiel absent en production ferait refuser des créations de site pour une
raison qui n'a rien de métier.

`pnpm test:rls` lance la même suite : c'est elle que ce script annonçait sans
l'avoir.

## Étanchéité par PostgREST

A10.4 nº 2 veut l'étanchéité « y compris par canal indirect », et A6.1 nomme
ces canaux : message d'erreur, compteur, temps de réponse. Aucun n'est
traversé par une connexion SQL directe. L'application parle à PostgREST, qui
décide du rôle depuis un jeton, expose un schéma, rend des compteurs en
en-tête et formule ses propres messages. La suite
`a10-4-etancheite-postgrest.db.test.ts` passe donc par ce chemin.

Elle ne s'exécute que si `AZIMUT_TEST_POSTGREST` désigne un binaire PostgREST.
Sans lui, elle est ignorée plutôt que fausse : un essai d'étanchéité qui
passerait sans avoir rien interrogé serait pire que son absence.

Deux rôles sont posés une fois, par un compte d'administration, parce que le
propriétaire de la base n'a pas le droit d'en créer :

```sql
CREATE ROLE anon NOLOGIN NOINHERIT;
CREATE ROLE authenticator LOGIN NOINHERIT;
GRANT anon, authenticated TO authenticator;
GRANT USAGE ON SCHEMA azimut TO anon;
```

`auth.uid()` est installé par la suite elle-même. C'est un objet de la
plateforme, que Supabase fournit en production et que la base de développement
n'a pas ; sa définition reproduit celle de Supabase, la revendication `sub` du
jeton. Il n'entre dans aucune migration : la partie Q le range du côté de la
plateforme, pas du produit.

Le rôle n'a pas de mot de passe : la base de développement est jointe en
`trust` depuis le bouclage. Sur une installation qui en demande un, il se pose
localement et se porte dans `AZIMUT_TEST_POSTGREST_DB_URI` : jamais dans le
dépôt, que A2.4 et A6.3 interdisent l'un et l'autre.

```
AZIMUT_TEST_DATABASE_URL='postgres://azimut@127.0.0.1:5433/azimut' \
AZIMUT_TEST_POSTGREST_DB_URI='postgres://authenticator@127.0.0.1:5433/azimut' \
AZIMUT_TEST_JWT_SECRET="$(openssl rand -hex 32)" \
AZIMUT_TEST_POSTGREST=/chemin/vers/postgrest \
pnpm test:rls
```

`AZIMUT_TEST_JWT_SECRET` est le secret de signature des jetons du banc. Aucune
valeur n'est écrite dans le dépôt et aucune valeur de repli n'existe : un
secret par défaut signerait avec une valeur connue de tout lecteur du dépôt.

Sans `AZIMUT_TEST_POSTGREST`, la suite d'étanchéité se saute : c'est la
tolérance d'un poste qui n'a pas le binaire, et elle s'arrête là. Une chaîne
dont c'est le travail pose en plus `AZIMUT_REQUIRE_POSTGREST=1`, et un binaire
manquant la fait alors échouer au lieu de la sauter : un essai qu'aucune chaîne
n'exécute n'existe pas. La chaîne d'A13.2 le pose, et installe PostgREST
12.2.3, version figée et empreinte vérifiée.
