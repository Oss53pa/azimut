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
```

## Règle pour la suite

Un numéro, une migration. Une migration nouvelle prend le numéro suivant le
plus élevé de cette liste, et s'y ajoute en dernière ligne. Le test
`migration-order.test.ts` échoue si ce fichier et le répertoire divergent, ou
si un numéro non déjà en collision se dédouble.
