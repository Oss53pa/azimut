# Ordre d'application des migrations

Ce fichier fixe l'ordre. Il fait foi, et non le tri des noms de fichiers.

## Pourquoi il existe

Quatre numéros sont portés par deux migrations chacun — `0018`, `0019`, `0020`
et `0021` — parce que deux travaux ont avancé en parallèle et se sont rejoints
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
`0024` retire au titre de A2.4 — mais `0024` passe après, et sur une base neuve
`0002` échoue avant qu'elle n'ait la parole. Réécrire `0002` et `0006`
corrigerait la cause, au prix de faire diverger toute base à jour de son
registre d'application. Le préalable coûte moins cher et ne casse rien.

Sur une plateforme qui fournit `auth`, ne rien exécuter : ce fichier ne doit
jamais toucher la table de comptes d'un hébergeur, et `0024` ne la supprime pas
non plus — elle n'en retire que les clés étrangères.

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

```sh
initdb -D "$PGDATA" -U postgres --auth=trust
pg_ctl -D "$PGDATA" -o '-p 54332' -l "$PGDATA/server.log" start -w

psql -p 54332 -U postgres -d postgres <<'SQL'
CREATE ROLE azimut LOGIN;
CREATE ROLE authenticated NOLOGIN;
GRANT authenticated TO azimut;
CREATE DATABASE azimut OWNER azimut;
SQL

# Installation autonome uniquement : pas sur une plateforme qui fournit `auth`.
psql -p 54332 -U azimut -d azimut -f packages/db/migrations/bootstrap-standalone.sql

for f in packages/db/migrations/0*.up.sql; do
  psql -p 54332 -U azimut -d azimut -v ON_ERROR_STOP=1 -q -f "$f"
done

AZIMUT_TEST_DATABASE_URL='postgres://azimut@127.0.0.1:54332/azimut' pnpm test:db
```

`pnpm test:rls` lance la même suite : c'est elle que ce script annonçait sans
l'avoir.
