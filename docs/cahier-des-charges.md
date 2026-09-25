# Cahier des charges de développement
## Azimut, logiciel de conception signalétique et de parcours d'orientation pour ERP

Éditeur : Atlas Studio
Version consolidée. Document unique destiné à l'agent de développement et à toute personne intervenant sur le code.

---

## A0. Comment lire ce document

**Document unique.** Cette version consolidée remplace les seize documents antérieurs. Ils ne font plus foi et ne doivent plus être consultés.

**Aucune préséance à arbitrer.** Les corrections décidées au fil des versions ont été reportées dans les sections qu'elles modifient. Une règle qui figure à deux endroits, par exemple les jetons de couleur en partie A et en partie F, y est écrite à l'identique, et chaque table n'a qu'une seule définition. Une contradiction trouvée entre deux passages est un défaut du document : l'agent s'arrête et la signale selon la procédure d'arrêt et de demande de la section A2.2, et n'applique aucune des deux versions.

**Une seule liste de points ouverts.** Les sections de fin de partie intitulées « ce que cette partie ne couvre pas » sont conservées pour l'historique et marquées comme telles. La seule liste qui fait foi est le registre de la partie K.

**Organisation.**

| Partie | Objet |
| --- | --- |
| A | Socle permanent : invariants, règles de conduite, pile, modèle de données, contrats, qualité |
| B | Lots de développement par incrément |
| C | Annexes opérationnelles : sites de référence, fichier de conduite, revue |
| D | Conventions, formats et algorithmes |
| E | Édition et capacités vectorielles |
| F | Interface et design système |
| G | Résolution de points ouverts |
| H | Carte des modules |
| I | Atelier de dessin et transformation des plans |
| J | Stylet, esquisse, pictogrammes et bibliothèques |
| K | Registre des points ouverts |
| L | Fiches de modules et modèle d'intégration |
| M | Spécification des écrans de la première tranche |
| N | Cahier des charges détaillé par module |
| O | Audit par parcours d'usage |
| P | Module 13, application visiteur |
| Q | Plateforme, propriété des tables, devises, entité juridique, taxes, incidents |
| R | Écran du tableau des messages, spécification au champ près |
| S | Ateliers de conception : vues, couleurs, calques, cotation, exports, édition simultanée, assistant |
| Annexe T | Consigne de la tâche T-2.14a |
| Annexe Z | Journal de consolidation |

---

# PARTIE A. SOCLE PERMANENT

## A1. Produit, invariants et vocabulaire

### A1.1 Ce que fait le produit

Azimut permet de concevoir, produire et maintenir en condition la signalétique et les parcours d'orientation d'un établissement recevant du public, à neuf comme sur patrimoine existant.

### A1.2 Invariants

Ces cinq règles ne se négocient dans aucune tâche. Toute proposition qui les contredit est refusée, quelle qu'en soit la justification technique.

**INV-1. Source unique, rendus dérivés.**
Le site est modélisé une fois. Le plan technique, la vue isométrique, la vue en plan simplifié, les plans muraux orientés, les panneaux, le parcours animé, le quantitatif et le paquet de borne sont tous calculés depuis les mêmes données. Aucun livrable n'est dessiné à la main. Aucune donnée n'est dupliquée pour les besoins d'un rendu.

**INV-2. Un panneau est une vue, pas un dessin.**
Le contenu d'une face de support est résolu depuis le tableau des messages au moment du rendu, et le tableau des messages est lui-même généré depuis le graphe, le plan de jalonnement et l'annuaire (partie H, règle M02.W6 de la partie N). Le contenu n'est jamais saisi librement, sauf pour les blocs explicitement typés comme libres.

**INV-3. Le registre de sécurité est cloisonné.**
Aucune charte client ne peut modifier une couleur, une géométrie, un pictogramme ou une proportion relevant du registre de sécurité. Le moteur refuse l'opération et lève une erreur. Il n'avertit pas, il ne dégrade pas, il refuse.

**INV-4. Le rendu est déterministe.**
Deux compilations d'un même état de données produisent des fichiers strictement identiques, octet pour octet. Voir A9.

**INV-5. Aucune valeur réglementaire dans le code.**
Toute constante d'origine normative (hauteur de caractère minimale, ratio de contraste, dimension de pictogramme, hauteur d'implantation) provient d'un paquet de règles versionné, chargé en donnée. Écrire une telle valeur dans le code source est une faute bloquante. Voir A2.4.

### A1.3 Vocabulaire imposé

Le vocabulaire ci-dessous est utilisé partout : noms de tables, noms de types, noms de variables, messages d'erreur, libellés d'interface. Aucun synonyme.

| Terme | Anglais (code) | Définition |
| --- | --- | --- |
| Organisation | organization | Client, unité de cloisonnement des données |
| Site | site | Ensemble bâti géré comme un tout |
| Bâtiment | building | Unité bâtie ayant ses accès propres |
| Niveau | level | Étage, avec altitude |
| Empreinte | footprint | Polygone au sol |
| Volume | volume | Empreinte + altitude de base + hauteur |
| Nœud | node | Point du graphe de circulation |
| Arête | edge | Segment de circulation entre deux nœuds |
| Liaison verticale | vertical_link | Arête reliant deux niveaux |
| Destination | destination | Lieu où l'usager veut se rendre |
| Profil | travel_profile | Jeu de règles de déplacement d'une catégorie d'usager |
| Parcours | route | Chemin calculé pour un profil |
| Point de décision | decision_point | Nœud où le parcours offre plus d'un choix |
| Support | support | Objet physique portant de l'information |
| Face | support_face | Une des faces d'un support |
| Exécution | artwork | Fichier de fabrication d'une face |
| Bon à tirer | proof | Version d'exécution soumise à validation |
| Support posé | installed_support | État physique constaté sur site |
| Divergence | divergence | Écart entre le conçu et le posé |
| Paquet de règles | rules_pack | Jeu de règles normatives versionné |
| Charte | charter | Identité visuelle d'un client |
| Paquet de borne | kiosk_package | Artefact statique déployé sur borne |

Termes interdits dans le code et l'interface, parce qu'ils sont ambigus : `map`, `plan` seul, `sign` seul, `panel`, `label`, `item`, `element`, `data` employé comme nom de variable métier.

---

## A2. Règles de conduite de l'agent de développement

Cette section prime sur toutes les autres. Elle décrit comment travailler, pas quoi construire.

### A2.1 Périmètre d'une tâche

Une tâche modifie uniquement ce qu'elle déclare modifier.

Sont interdits dans une tâche qui ne les demande pas explicitement : renommer un symbole existant, reformater un fichier non touché par la tâche, mettre à jour une dépendance, corriger un bug repéré au passage, refactoriser, supprimer du code jugé mort, harmoniser un style, ajouter une fonctionnalité qui semble manquer.

Un problème repéré hors périmètre se signale dans le rapport de fin de tâche, sous la rubrique « constaté, non traité ». Il ne se corrige pas dans la foulée.

### A2.2 Arrêt obligatoire et demande

L'agent s'arrête et demande, au lieu de décider, dans les cas suivants :

1. Une valeur réglementaire, une norme ou un seuil manque et devrait venir d'un paquet de règles.
2. La tâche exige un choix de modèle de données non prévu en A5.
3. Deux exigences de ce document se contredisent.
4. Une bibliothèque tierce nouvelle semble nécessaire.
5. Le respect d'un invariant A1.2 rend la tâche impossible telle qu'écrite.
6. Une donnée client réelle, un plan ou une charte serait nécessaire pour tester.
7. Une migration de base détruirait ou transformerait des données existantes.

Dans ces cas, l'agent produit une note courte décrivant l'alternative et attend. Il ne choisit pas l'option qui lui semble raisonnable.

### A2.3 Vérification avant annonce

Une tâche n'est jamais annoncée terminée sans que les commandes suivantes aient été exécutées et soient passées, dans cet ordre :

```
pnpm typecheck
pnpm lint
pnpm test
pnpm test:visual
```

Le rapport de fin de tâche indique la sortie réelle de ces commandes, pas un résumé. Si une commande échoue, la tâche n'est pas terminée. Annoncer terminé sans avoir exécuté les tests est la faute la plus grave prévue par ce document.

Ce qui n'a pas pu être vérifié est indiqué explicitement, avec la raison.

### A2.4 Interdictions permanentes

- Écrire en dur une valeur d'origine normative. Voir INV-5.
- Écrire en dur une couleur hors du fichier de jetons de thème. Voir A11.
- Introduire une source d'indéterminisme dans un moteur. Voir A9.
- Contourner le cloisonnement par organisation, y compris en test.
- Committer un secret, une clé, une chaîne de connexion, un jeton.
- Committer une donnée client réelle, un plan réel, une charte réelle.
- Désactiver une règle de lint, ignorer un test, marquer un test en attente pour faire passer une tâche.
- Utiliser une fonctionnalité de la plateforme d'hébergement non disponible en installation autonome. Voir A3.4.
- Créer un fichier de plus de 400 lignes sans découpage.
- Employer `any` en TypeScript. `unknown` puis restriction de type.

### A2.5 Granularité des commits

Un commit par unité cohérente et compilable. Message au format `type(portée): description à l'infinitif`, types autorisés : `feat`, `fix`, `test`, `docs`, `chore`, `refactor`, `perf`, `migration`.

Un commit ne mélange jamais une migration de base et du code applicatif.

### A2.6 Rapport de fin de tâche

Format imposé :

```
Tâche : <identifiant>
Fait : <liste des changements réels>
Fichiers touchés : <liste>
Vérifications : <sortie des 4 commandes>
Constaté, non traité : <liste ou "rien">
Décisions prises : <liste ou "aucune">
Non vérifié : <liste ou "rien">
```

---

## A3. Pile technique

### A3.1 Versions imposées

| Élément | Choix | Version |
| --- | --- | --- |
| Langage | TypeScript | 5.x, mode strict complet |
| Exécution | Node.js | 22 LTS |
| Gestionnaire de paquets | pnpm | 9.x, workspaces |
| Front | React + Vite | React 18, Vite 5 |
| Rendu | SVG natif | aucune bibliothèque de dessin |
| Base de données | PostgreSQL via Supabase | PostgreSQL 15+ |
| Accès données | Drizzle ORM | dernière stable |
| Authentification | Supabase Auth | |
| Stockage objet | Supabase Storage | |
| Fonctions serveur | Supabase Edge Functions (Deno) | tâches courtes uniquement |
| Service de compilation | Node autonome, conteneurisé | tâches longues |
| Tests unitaires | Vitest | |
| Tests de bout en bout | Playwright | |
| Génération PDF | à trancher en tâche T-0.9 | voir A2.2 |

### A3.2 Séparation des responsabilités serveur

Supabase porte : la base, l'authentification, le cloisonnement par ligne, le stockage des artefacts, les opérations courtes.

Un **service de compilation** Node autonome porte tout ce qui dépasse quelques secondes : compilation en lot des exécutions, génération PDF/X, fabrication du paquet de borne, imports volumineux. Il consomme une file de travaux stockée en base. Il ne contient aucune logique métier propre : il orchestre les moteurs de A7.

### A3.3 Bibliothèques

Toute bibliothèque nouvelle passe par A2.2. Sont préautorisées uniquement : `zod` pour la validation, `date-fns` pour les dates, `nanoid` pour les identifiants non métier.

Sont interdites : toute bibliothèque de dessin ou de diagramme, toute bibliothèque de gestion d'état globale, toute bibliothèque de composants d'interface prête à l'emploi, toute bibliothèque de calcul géométrique tant que le besoin n'est pas démontré par un test.

### A3.4 Contrainte de réversibilité d'hébergement

Le produit doit rester déployable sur une installation Supabase autonome, pour les clients soumis à une exigence de résidence des données.

Conséquence directe : seules les fonctionnalités disponibles dans la distribution auto-hébergeable sont utilisables. Toute dépendance à un service géré non réimplantable est interdite. Cette contrainte se vérifie : la CI déploie sur une instance autonome et fait tourner la suite de bout en bout.

---

## A4. Structure du dépôt

Dépôt unique, workspaces pnpm.

```
azimut/
  apps/
    studio/            application de conception (React + Vite)
    kiosk-runtime/     runtime du paquet de borne (statique, sans framework lourd)
    compiler/          service de compilation Node
  packages/
    core-model/        types métier, schémas zod, invariants
    engine-graph/      validation et parcours
    engine-layout/     composition, dimensions, contrôles
    engine-iso/        projection isométrique et zones cliquables
    engine-artwork/    exécutions, PDF, quantitatif
    engine-package/    fabrication du paquet de borne
    rules/             chargement et validation des paquets de règles
    design-tokens/     jetons de thème
    db/                schéma Drizzle, migrations, politiques RLS
    testkit/           jeux de sites de référence, utilitaires de test
  rules-packs/         paquets de règles, en données versionnées
  docs/
  CLAUDE.md
```

### A4.1 Règle de dépendance

Les paquets `engine-*` ne dépendent que de `core-model` et `rules`.

Ils ne connaissent ni la base de données, ni le DOM, ni le système de fichiers, ni le réseau, ni l'horloge, ni l'aléatoire. Une fonction de moteur prend des données en entrée et retourne des données en sortie. C'est ce qui les rend testables et déterministes.

Toute violation de cette règle est un échec de revue, sans discussion.

Le sens des dépendances est : `apps` dépend de `engine-*` dépend de `core-model`. Jamais l'inverse. Aucune dépendance croisée entre `engine-*`.

---

## A5. Modèle de données

PostgreSQL. Toutes les tables métier portent `org_id`. Clés primaires en `uuid`. Horodatages `created_at`, `updated_at` en `timestamptz`. Suppression logique par `deleted_at` sur les entités que l'utilisateur peut retirer.

### A5.1 Organisation et accès

```sql
organization        (id, name, slug, created_at, updated_at)
membership          (id, org_id, user_id, role, created_at)
                    role in ('admin','designer','owner_rep','vendor','operator','auditor','marketing')
```

`role` correspond aux sept rôles définis en A6.2.

### A5.2 Site et géométrie

```sql
site                (id, org_id, legal_entity_id, name, country_code, timezone,
                     active_langs jsonb, origin_x_m numeric, origin_y_m numeric,
                     reference_elevation_m numeric,
                     created_at, updated_at, deleted_at)
-- Le rattachement aux paquets de règles n'est pas une colonne du site : il est
-- porté par site_rules_binding, qui admet un socle et une surcouche. Une colonne
-- unique ici serait une seconde source pour la même chose.
-- timezone : requis. legal_entity_id : facultatif à la création, requis avant la
-- première facture (partie Q, section Q5). name : nom propre, non traduit.
building            (id, org_id, site_id, name, independent_access boolean, opening_hours jsonb,
                     default_edge_width_m numeric)
level               (id, org_id, building_id, name, ordinal int, elevation_m numeric)
zone                (id, org_id, level_id, name, kind, footprint_ids jsonb)
-- footprint_ids : empreintes couvertes par la zone, appartenance déclarée et non
-- calculée, comme pour la zone d'orientation de la partie H.
                    kind in ('commercial','food','service','technical','parking','outdoor')

plan_source         (id, org_id, level_id, storage_path, media_type, uploaded_at)
plan_calibration    (id, org_id, plan_source_id, scale_m_per_px numeric,
                     origin_x_px numeric, origin_y_px numeric, rotation_deg numeric,
                     reference_distance_m numeric)
plan_calibration_point (id, org_id, calibration_id, ordinal int,
                     image_x_px numeric, image_y_px numeric)
-- Seules colonnes en pixels de la base (règle M01.S2) : elles décrivent l'image source,
-- jamais le site. origin_x_px, origin_y_px : position, dans l'image, de l'origine
-- du repère site. Les points de calage permettent de rejouer le calage à l'identique.

footprint           (id, org_id, level_id, unit_code, geometry jsonb, kind)
                    kind in ('cell','circulation','technical','vertical_core','outdoor',
                             'parking_space')
                    geometry = polygone en coordonnées métier, mètres
                    unit_code : requis si kind = 'cell', unique par niveau
volume              (id, org_id, footprint_id, base_elevation_m numeric,
                     height_m numeric, material_key)
opening             (id, org_id, footprint_id, position jsonb, width_m numeric, kind)
                    kind in ('door','automatic_door','emergency_door','shop_front','bay')
```

Contrainte : un `footprint.geometry` est un polygone simple, fermé, non auto-intersectant, au minimum 3 sommets. Validé en base par contrainte de vérification et en application par `zod`.

### A5.3 Circulation

```sql
node                (id, org_id, level_id, kind, position jsonb, label)
                    kind in ('entrance','junction','landing','elevator','stair',
                             'escalator','emergency_exit','restroom','security_post',
                             'information_point','destination_access')

edge                (id, org_id, from_node_id, to_node_id,
                     width_m numeric, slope_pct numeric,
                     accessible boolean, direction, 
                     availability jsonb, evacuation_route boolean, length_m numeric)
                    direction in ('both','forward','backward')

vertical_link       (id, org_id, edge_id, kind, capacity int, accessible boolean)
parking_space       (id, org_id, footprint_id, space_kind, row_label)
                    space_kind in ('standard','accessible','family','electric','delivery')
-- Extension d'une empreinte de nature `parking_space`, une ligne par empreinte,
-- sur le modèle de vertical_link qui étend une arête. Ne porte que ce que
-- l'empreinte générique n'a pas à porter : le type de place et son repère de travée.
                    kind in ('elevator','stair','escalator','ramp')

building_link       (id, org_id, edge_id, from_building_id, to_building_id, sheltered boolean)
graph_validation    (id, org_id, site_id, graph_hash, ran_at, passed boolean,
                     blocking_count int, warning_count int, findings jsonb)
-- Insertion seule, un enregistrement par passage de la validation de complétude.
-- graph_hash : empreinte canonique des nœuds, arêtes et liaisons du site, section D7.2,
-- sans profil. Une validation ne vaut que pour le graphe dont elle porte l'empreinte.
```

Contrainte : `edge.length_m` est calculé, jamais saisi. Une arête relie deux nœuds distincts. Une arête entre deux niveaux différents doit avoir une ligne `vertical_link`.

### A5.4 Destinations

```sql
category            (id, org_id, sector_key, code, parent_id)
pictogram           (id, org_id, category_id, family_id, registry, code, svg_path,
                     source, standard_ref, rules_pack_id, function_key,
                     comprehension_state, comprehension_rate numeric, tested_at,
                     created_by)
-- function_key : à quoi sert ce pictogramme, et non d'où il vient. C'est par elle
-- qu'un moteur demande « le pictogramme d'accessibilité » sans connaître son code.
-- Vocabulaire à espace de noms, enrichi dans le même commit que son premier usage,
-- par exemple access.accessible, access.hearing_loop, service.restroom.
-- Pour le registre de sécurité, la désignation vient du paquet de règles et n'est
-- jamais saisie : c'est lui qui porte ces pictogrammes. rules_pack_id est alors
-- obligatoire, contrainte posée en base : un pictogramme de sécurité sans paquet
-- n'est vu par aucun site, c'est donc une donnée morte. Pour le registre
-- d'orientation, la désignation est libre et le paquet reste vide.
-- Portée d'unicité d'une fonction : le paquet de règles pour le registre de
-- sécurité, l'organisation pour le registre d'orientation. Une organisation qui
-- exploite deux sites rattachés à deux paquets différents porte légitimement deux
-- pictogrammes de même fonction, un par paquet : l'unicité par organisation les
-- déclarerait ambigus à tort.
                    registry in ('safety','wayfinding')
                    source in ('rules_pack','library','custom')
                    comprehension_state in ('untested','tested','failed')
-- Définition unique. standard_ref et rules_pack_id sont requis si registry = 'safety'.
-- family_id et comprehension_state concernent le registre d'orientation (partie J).
destination         (id, org_id, footprint_id, node_id, category_id,
                     occupant_name, occupancy_status, display_priority int,
                     valid_from date, valid_to date)
                    occupancy_status in ('occupied','vacant','reserved','under_fit_out')
destination_name    (id, org_id, destination_id, lang, value)
                    lang in ('fr','en')
```

Règle : un `pictogram` de `registry = 'safety'` est en lecture seule pour toute organisation. Il provient d'un paquet de règles, jamais d'un import client. Application de INV-3.

### A5.5 Parcours

```sql
travel_profile      (id, org_id, site_id, key, name,
                     excluded_edge_kinds jsonb, weights jsonb,
                     require_accessible boolean, honor_hours boolean)

route_cache         (id, org_id, site_id, profile_id, from_node_id, to_node_id,
                     path jsonb, cost numeric, computed_at, inputs_hash)

decision_point      (id, org_id, site_id, profile_id, node_id,
                     branch_count int, computed_at, inputs_hash)
```

`route_cache` et `decision_point` sont des tables de cache. Elles sont invalidées par `inputs_hash`, empreinte de l'état du graphe et du profil. Elles ne sont jamais la source de vérité et peuvent être vidées sans perte.

### A5.6 Supports

```sql
support             (id, org_id, site_id, code, node_id, typology_id,
                     azimuth_deg numeric, reading_distance_m numeric,
                     width_mm int, height_mm int, dimensions_source,
                     substrate_key, mounting jsonb, registry, information_levels jsonb,
                     created_at, updated_at, deleted_at)
                    dimensions_source in ('computed','overridden')
                    registry in ('safety','wayfinding')

-- code : texte lisible, unique par site, requis, par exemple D-042 (partie R).
-- Propriété scindée (partie L, section L0) : implantation, soit code, node_id, azimuth_deg,
-- typology_id, reading_distance_m, information_levels, au module 02 ; fabrication, soit width_mm, height_mm,
-- dimensions_source, substrate_key, mounting, au module 04.

support_typology    (id, org_id, key, name, face_count int, template_key,
                     default_substrate, registry)
                    registry in ('safety','wayfinding')

support_face        (id, org_id, support_id, face_index int, template_key, langs jsonb)

content_block       (id, org_id, face_id, block_index int, kind, binding jsonb, free_text jsonb)
                    kind in ('resolved','free','pictogram','map','legend')

support_version     (id, org_id, support_id, version int, state, artwork_path,
                     content_hash, created_at, created_by)
                    state in ('draft','in_review','approved','superseded')

proof               (id, org_id, support_version_id, storage_path, issued_at)
approval            (id, org_id, proof_id, user_id, decision, comment, decided_at, signature_hash)
                    decision in ('approved','rejected')
```

Règles : `dimensions_source = 'computed'` est le défaut. Une saisie manuelle des dimensions bascule en `'overridden'` et déclenche un contrôle bloquant si le format devient non conforme. `approval` est en insertion seule, jamais modifiable ni supprimable. Application de A12.3.

### A5.7 Patrimoine et divergence

```sql
installed_support   (id, org_id, support_id, installed_version int,
                     installed_at, condition, photo_path, surveyed_by, surveyed_at)
                    condition in ('good','worn','damaged','missing')

divergence          (id, org_id, support_id, kind, state, detected_at, resolved_at, detail jsonb)
                    state in ('detected','resolved','accepted')
                    kind in ('outdated_content','wrong_orientation','undersized',
                             'missing','superfluous','damaged')

work_order          (id, org_id, site_id, scope jsonb, estimated_cost numeric,
                     currency, state, created_at, closed_at)
                    state in ('draft','issued','in_progress','done','cancelled')
```

### A5.8 Chartes et règles

```sql
charter             (id, org_id, site_id, name, version, created_at)
charter_color       (id, org_id, charter_id, key, usage,
                     reference_system, reference_code,
                     lab_l numeric, lab_a numeric, lab_b numeric,
                     display_hex, source_of_truth,
                     declared_by, declared_at)
                    reference_system in ('pantone','ral','ncs','cmyk','rgb','none')
                    source_of_truth in ('reference','lab','display')
-- Définition unique, issue de la chaîne colorimétrique de la partie G.
charter_typeface    (id, org_id, charter_id, key, family, weight, min_size_mm)
charter_rule        (id, org_id, charter_id, kind, params jsonb)
                    kind in ('adjacency_forbidden','min_logo_width','background_allowed',
                             'proportion','signature_usage','forbidden_character',
                             'max_sentence_words')
lexicon_term        (id, org_id, charter_id, lang, term, severity)
                    severity in ('forbidden','discouraged')
-- Aucune valeur de charte n'est écrite dans le code : caractères interdits, limite
-- de phrase, largeurs et tailles minimales viennent tous de ces tables.
-- Quand la charte ne porte pas une règle, le contrôle correspondant ne s'exécute
-- pas et le signale, comme pour un paquet de règles absent. Il n'applique aucune
-- valeur par défaut : une règle absente n'est pas une règle permissive.

rules_pack          (id, key, version, jurisdiction, effective_from, source_ref, checksum)
rules_pack_rule     (id, rules_pack_id, code, scope, params jsonb, source_ref)
site_rules_binding  (id, org_id, site_id, rules_pack_id, role, bound_at)
                    role in ('base','overlay')
-- Cette table fait foi pour le rattachement d'un site à ses paquets. Un site porte
-- au plus un socle et au plus une surcouche pays, section D3.6.
-- Précédence, pour une même fonction de pictogramme comme pour une règle : la
-- surcouche l'emporte sur le socle. L'ambiguïté ne se juge qu'à l'intérieur d'un
-- même paquet ; deux paquets qui désignent la même fonction ne sont pas ambigus.
```

`rules_pack` et `rules_pack_rule` sont globales, non rattachées à une organisation, en lecture seule pour l'application. Elles sont alimentées par les fichiers de `rules-packs/` au déploiement. Chaque règle porte `source_ref`, référence documentaire de son origine. Une règle sans `source_ref` est rejetée au chargement.

### A5.9 Bornes

```sql
kiosk               (id, org_id, site_id, node_id, azimuth_deg numeric,
                     default_lang, building_id, hardware_profile jsonb, label)
kiosk_package       (id, org_id, site_id, version int, storage_path,
                     checksum, built_at, content_hash)
kiosk_telemetry     (id, org_id, kiosk_id, occurred_at, event_kind, payload jsonb)
                    event_kind in ('search','no_result','route_shown','idle_reset')
```

`kiosk_telemetry.payload` ne contient aucune donnée à caractère personnel. Contrôle automatisé en test.

### A5.10 Travaux et journal

```sql
job                 (id, org_id, kind, state, payload jsonb, result jsonb,
                     attempts int, created_at, started_at, finished_at, error)
                    kind in ('import_plan','import_roster','compile_artworks',
                             'build_kiosk_package','export_quantities','audit_site')
                    state in ('queued','running','succeeded','failed','cancelled')

audit_log           (id, org_id, actor_id, action, entity, entity_id,
                     before jsonb, after jsonb, occurred_at)
```

`audit_log` est en insertion seule. Voir A12.3.

### A5.11 Faits du site, source et statut

```sql
site_fact    (id, org_id, site_id, key, value jsonb, status, source_ref,
              target_kind, target_id, declared_by, declared_at)
             status in ('existing','proposal','to_verify')
-- target_kind et target_id sont facultatifs. Renseignés, le fait porte sur cet objet,
-- par exemple la capacité annoncée d'un parking donné ; vides, il porte sur le site
-- entier. L'unicité porte sur le site, la clé et la cible : un site à deux parkings
-- déclare deux capacités.
```

**Convention de clé.** Une clé de fait est composée d'un espace de noms et d'un nom, séparés par un point, et chaque clé déclare le type attendu de sa valeur. Sans ce type, un jour quelqu'un écrira « oui » là où un autre attend un booléen.

| Clé | Type attendu | Cible |
| --- | --- | --- |
| `parking.capacity` | entier | zone de nature `parking` |
| `parking.free` | booléen | zone de nature `parking` |
| `parking.undigitized_spaces` | entier | empreinte de nature `parking_space` |
| `parking.undigitized_reason` | texte | empreinte de nature `parking_space` |

Une clé nouvelle s'ajoute à cette table, avec son type et sa cible, dans le même commit que son premier usage. Une valeur qui ne correspond pas au type déclaré est refusée.

Un fait du site est une donnée déclarée qui n'appartient à aucune autre table : capacité annoncée d'un parking, surface commercialisable, nombre de places de livraison, tout chiffre qu'un livrable affiche et que la géométrie ne produit pas.

**M01.S11.** Tout fait du site porte sa source et son statut. Un fait de statut `proposal` ne s'affiche jamais comme un existant. Un nombre affiché dans un livrable provient d'un fait ou d'un calcul, jamais d'un littéral écrit dans un gabarit. Un texte de livrable qui contredit un fait déclaré est refusé. Un écart entre deux sources reste ouvert et visible tant qu'il n'est pas tranché.

C'est la même discipline que celle des paquets de règles : rien ne s'affiche sans sa source. Elle fonde les contrôles des domaines `PARK` et `DOC`.

**Le statut d'un fait et celui d'un objet sont deux choses distinctes.** Un fait déclaré, par exemple la capacité annoncée d'un parking, porte son statut sur `site_fact`. Un objet dessiné qui n'existe pas encore, par exemple une place de stationnement en projet, porte le sien sur l'objet, là où le modèle le déclare. Les deux obéissent à la même règle, un objet ou un fait de statut `proposal` ne s'affiche jamais comme un existant, et ils ne se confondent pas : rassembler les deux sur une seule table ne gagnerait rien.

### A5.12 Suppression

Règle transverse, valable pour tout le modèle.

- Ce que l'utilisateur retire est supprimé logiquement, par `deleted_at`. La suppression physique n'appartient pas à l'usage courant.
- Aucune clé étrangère vers `organization` ou vers `site` ne supprime en cascade. Les tables en insertion seule de la section A12.3 refusent la suppression de leur parent tant que leurs lignes existent.
- La suppression physique d'une organisation ou d'un site n'a lieu que par la purge de fin de contrat de la section O15, dans l'ordre de dépendance, ce refus garantissant qu'aucune trace ne disparaît par accident ni par oubli.

---

## A6. Sécurité et cloisonnement

### A6.1 Cloisonnement par ligne

Le cloisonnement s'applique en base, par politique de sécurité au niveau des lignes, sur **toutes** les tables portant `org_id`. Jamais dans le code applicatif.

Politique générique : une ligne n'est visible que si `org_id` figure parmi les organisations dont l'utilisateur courant est membre.

Test obligatoire, exécuté à chaque migration : pour chaque table portant `org_id`, une politique existe et est active. Une table nouvelle sans politique fait échouer la CI.

Second test obligatoire : un utilisateur de l'organisation A ne peut lire, écrire, ni détecter l'existence d'aucune ligne de l'organisation B, y compris par message d'erreur, par compteur, ou par différence de temps de réponse sur une clé étrangère.

### A6.2 Rôles et droits

| Rôle | Droits |
| --- | --- |
| `admin` | Tout dans son organisation, y compris chartes, gabarits, utilisateurs |
| `designer` | Modélisation, graphe, supports, composition, pas de validation |
| `owner_rep` | Validation et signature des bons à tirer, lecture du reste |
| `vendor` | Lecture des exécutions du seul lot qui lui est rattaché, dépôt d'épreuves |
| `operator` | Annuaire, poses, divergences, déclenchement de régénération |
| `auditor` | Lecture seule intégrale, journaux compris, aucune écriture |
| `marketing` | Campagnes, promotions et événements, et inscriptions au programme de fidélité de son site, section P9. Aucun accès aux autres modules |

Le rôle `vendor` est le plus contraint et le plus facile à mal implémenter : sa visibilité est limitée par rattachement explicite, pas par organisation. Il fait l'objet de tests dédiés.

### A6.3 Exigences transverses

- Chiffrement en transit et au repos.
- Double authentification obligatoire pour `admin` et `owner_rep`.
- Aucun secret dans le dépôt, variables d'environnement uniquement, fichier d'exemple sans valeur réelle.
- Validation de toute entrée par `zod` à la frontière, y compris les données venant de la base.
- Conformité OWASP ASVS niveau 2 comme cible de revue.

---

## A7. Contrats des moteurs

Chaque moteur est une fonction pure ou un ensemble de fonctions pures. Signature de principe : entrée typée, sortie typée, aucune exception pour les cas métier, résultat explicite pour les échecs.

Convention de retour :

```ts
type Outcome<T> =
  | { ok: true; value: T; warnings: Finding[] }
  | { ok: false; findings: Finding[] };

type Finding = {
  code: string;          // stable, jamais traduit, ex. "GRAPH.ORPHAN_NODE"
  severity: 'blocking' | 'warning' | 'info';
  entity: { kind: string; id: string } | null;
  params: Record<string, string | number>;
  ruleRef: string | null; // référence au paquet de règles, si origine normative
};
```

Les messages destinés à l'utilisateur sont produits par la couche d'interface depuis `code` et `params`. Un moteur ne produit jamais de texte destiné à l'affichage.

**Refus d'une entrée invalide.** Un moteur qui reçoit une entrée qu'il ne peut pas traiter, une référence introuvable, une dimension nulle ou négative, un fichier vide, une structure mal formée, refuse par une anomalie bloquante portant un code du catalogue. Il ne lève pas d'exception, ne retourne pas de résultat partiel et ne comble aucune valeur manquante. Cette règle vaut pour tous les moteurs, y compris ceux à venir, et fonde les codes de référence introuvable du catalogue.

### A7.1 engine-graph

- `validateGraph(site)` : complétude. Détecte nœuds orphelins, zones inatteignables, destinations non reliées, impasses non justifiées, niveaux sans liaison verticale accessible, arêtes de longueur nulle, graphe non connexe.
- `computeRoute(graph, profile, from, to)` : plus court chemin pondéré.
- `deriveDecisionPoints(graph, profile, destinations)` : nœuds où le parcours offre plus d'un choix.
- `auditCoverage(graph, profile, supports)` : points de décision non couverts, supports ne servant aucun parcours.
- `auditEvacuation(graph)` : couverture des cheminements d'évacuation.
- `auditAccessibility(graph, profile)` : destinations non atteignables par un profil accessible.

Règle : `auditCoverage` refuse de produire un taux si `validateGraph` n'est pas passé. Application de l'exigence de complétude.

### A7.2 engine-layout

- `resolveFaceContent(face, messageLines, langs)` : résolution du contenu depuis les lignes du tableau des messages, jamais depuis le graphe directement (règle M04.G1 de la partie N).
- `computeDimensions(content, readingDistance, rulesPack, charter)` : format déduit du contenu, de la distance de lecture et de la langue la plus longue.
- `checkLegibility`, `checkContrast`, `checkLexicon`, `checkChromaticAdjacency`, `checkDestinationValidity`.
- `renderFace(face, resolvedContent, charter, rulesPack)` : SVG.

### A7.3 engine-iso

- `project(volumes, angle)` : projection à angle fixe.
- `orderOcclusions(projected)` : tri par profondeur, départage déterministe documenté.
- `deriveHitAreas(projected)` : zones cliquables dérivées des polygones projetés.
- `renderIsometric(scene, activeLevel, mode)` : rendu, modes `active_level` et `exploded`.
- `renderSimplifiedPlan(level, options)` : vue orthogonale accessible, obligatoire.
- `renderRouteAnimation(route, scene)` : tracé progressif, plus équivalent statique.

### A7.4 engine-artwork

- `renderOrientedMap(support, scene, graph)` : un rendu par implantation, orienté selon `azimuth_deg`.
- `renderEvacuationPlan(level, graph, rulesPack)` : livrable nommé, règles propres.
- `renderTactile(face, langs)` : braille intégral, non abrégé. Voir C4.
- `exportArtwork(svg, target)` : PDF/X, PDF/A.
- `computeQuantities(supports)` : quantitatif.

### A7.5 engine-package

- `buildKioskPackage(site, scene, graph, directory, version)` : artefact statique autonome.
- `verifyPackage(package)` : intégrité, empreinte, absence de dépendance réseau.

### A7.6 rules

- `loadRulesPack(path)` : chargement, validation, refus si `source_ref` manquant.
- `resolveRule(pack, code, scope)` : lecture d'une règle.
- Aucune règle n'est jamais résolue par défaut. L'absence d'une règle attendue est une erreur, jamais une valeur de repli.

---

## A8. Conventions de code

- TypeScript strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` activés.
- `any` interdit. `unknown` puis restriction.
- Pas d'exception pour un cas métier prévu. Les exceptions signalent un bug.
- Fichiers de code de 400 lignes maximum. Fonctions de 50 lignes maximum. Cette limite vise les fichiers source, jamais les documents : une matrice de traçabilité ou un cahier des charges n'a pas à s'y plier.
- Nommage : anglais dans le code, français dans l'interface. Le vocabulaire de A1.3 fait foi dans les deux.
- Unités toujours dans le nom : `_m`, `_mm`, `_deg`, `_pct`. Une variable de dimension sans unité dans son nom est refusée en revue.
- Aucun commentaire expliquant ce que fait le code. Commentaires réservés à ce que le code ne peut pas dire : origine d'une règle, raison d'un contournement, référence normative.
- Import absolu par alias de paquet, jamais de chemin relatif remontant de plus d'un niveau.

---

## A9. Déterminisme

Application de INV-4. Un moteur ne peut pas produire deux sorties différentes pour la même entrée.

Sources d'indéterminisme interdites dans `engine-*` :

- `Math.random`, tout générateur pseudo-aléatoire.
- `Date.now`, `new Date()`, toute lecture d'horloge. Une date nécessaire est passée en paramètre.
- Itération sur un objet ou une structure dont l'ordre n'est pas garanti. Trier explicitement avant.
- Tri non stable, ou tri dont la fonction de comparaison peut retourner 0 pour deux éléments distincts. Prévoir toujours un critère de départage final sur l'identifiant.
- Génération d'identifiants dans un rendu.
- Dépendance à la locale du système pour la comparaison de chaînes, le formatage des nombres ou des dates.
- Flottants dont l'arrondi n'est pas explicité. Toute coordonnée écrite dans un SVG est arrondie à une précision fixée et documentée.

Test obligatoire, exécuté sur chaque site de référence : compiler deux fois de suite, comparer les empreintes des sorties, exiger l'égalité stricte.

---

## A10. Stratégie de tests

### A10.1 Niveaux

| Niveau | Outil | Portée |
| --- | --- | --- |
| Unitaire | Vitest | `engine-*`, `rules`, `core-model` |
| Intégration | Vitest | accès données, politiques de cloisonnement, travaux |
| Non-régression visuelle | Vitest + comparaison SVG | tous les rendus |
| Bout en bout | Playwright | parcours utilisateur de `studio` et de `kiosk-runtime` |

### A10.2 Seuils

- Couverture supérieure à 85 % sur `engine-graph`, `engine-layout`, `engine-iso`, `engine-artwork`, `engine-package`.
- Aucun seuil de couverture sur les interfaces. La couverture d'interface est un mauvais indicateur, elle n'est pas mesurée.
- Zéro test ignoré. Un test qui ne peut pas passer est supprimé ou corrigé, jamais mis en attente.

### A10.3 Non-régression visuelle

Les rendus sont comparés en SVG sérialisé, pas en image. La comparaison est textuelle et exacte, rendue possible par A9. Un écart attendu suppose la mise à jour explicite de l'empreinte de référence dans le même commit, avec justification dans le message.

### A10.4 Tests obligatoires par nature

Certains tests ne sont pas facultatifs et conditionnent la CI :

1. Politique de cloisonnement présente et active sur chaque table portant `org_id`.
2. Étanchéité entre deux organisations, y compris par canal indirect.
3. Déterminisme sur chaque site de référence.
4. Aucune valeur normative en dur : analyse statique cherchant les littéraux numériques suspects dans `engine-*`.
5. Aucune couleur en dur hors de `design-tokens`.
6. Aucun `engine-*` n'importe le DOM, la base, le réseau ou l'horloge.
7. Absence de donnée à caractère personnel dans la télémétrie.
8. Refus effectif de toute modification d'un élément du registre de sécurité par une charte.

---

## A11. Interface, thème et accessibilité

### A11.1 Jetons

Toutes les couleurs, tailles et espacements passent par `packages/design-tokens`. Aucune valeur en dur ailleurs. C'est ce qui rend le second thème peu coûteux.

Thème par défaut, dit Papier :

```
surface-page        #FBFAF8
surface-panel       #FFFFFF
surface-canvas      #F7F5F1
surface-sunken      #F2EEE8
border-hairline     #E3DFD8
border-strong       #CFC8BC
border-interactive  #8E867C
text-primary        #1C1F24
text-secondary      #5A606B
text-muted          #656B75
accent              #17457A
accent-soft         #EDF2F8
accent-secondary    #26695C
```

Valeurs mesurées au contraste, détail en partie F, sections F2.3 et F2.4.

Couleurs réservées, communes à tous les thèmes, à usage sémantique exclusif :

```
state-blocking      #B32F26
state-warning       #96560A
state-valid         #2A7047
state-info          #2B6CB0
```

Un thème sombre, dit Instrument, est prévu en incrément 4. Il impose un second jeu complet de couleurs sémantiques, les valeurs claires étant illisibles sur fond sombre.

### A11.2 Règles d'emploi

- Les quatre couleurs réservées ne servent jamais à décorer. Contrôle en revue.
- L'accent ne signifie qu'une chose : une valeur produite par un moteur. Ce que l'utilisateur a saisi reste en neutre.
- La zone de travail reste en fond clair quel que soit le thème actif. La prévisualisation d'un support et l'écran de validation d'un bon à tirer ne se jugent que dans les conditions de lecture du support réel.
- Aucune couleur d'interface ne doit pouvoir être confondue avec une couleur de contenu client ni avec une couleur de sécurité normalisée.

### A11.3 Accessibilité

- Cible WCAG 2.2 niveau AA sur `studio` et sur `kiosk-runtime`.
- Contrastes mesurés au calcul, pas appréciés à l'œil. Test automatisé sur les couples de jetons.
- Vue en plan simplifié obligatoire partout où l'isométrie est proposée.
- Mode à animation réduite respecté, avec équivalent statique de toute animation de parcours.
- Exigences propres aux bornes, à traiter comme des exigences fonctionnelles et non comme du confort : sortie audio avec prise casque, commandes tactiles physiques repérables au toucher pour la navigation de base, hauteur de zone d'interaction compatible avec un usage assis, cible tactile minimale dimensionnée, mode contraste renforcé accessible en un geste, temporisation d'inactivité allongée en mode accessible, alternative sonore à toute information portée par la seule couleur.

---

## A12. Observabilité et traçabilité

### A12.1 Journalisation technique

Journal structuré en JSON. Aucun secret, aucune donnée personnelle, aucune géométrie complète. Identifiants seulement.

### A12.2 Travaux

Chaque travail de la table `job` est traçable de bout en bout : état, durée, tentatives, erreur, résultat. Un travail échoué est rejouable sans effet de bord.

### A12.3 Journal d'audit

`audit_log`, `approval`, `message_schedule_approval` et `graph_validation` sont en insertion seule, garanti en base et non par convention applicative. Aucune modification et aucune suppression ne sont possibles, pour aucun rôle, administration comprise.

**Une seule exception, nommée et tracée** : la purge de fin de contrat de la section O15, exécutée par la plateforme à travers une procédure dédiée. Elle est la seule voie de suppression de ces lignes. Une cascade n'en est pas une : aucune clé étrangère ne supprime en cascade une ligne de ces tables.

Sont journalisés au minimum : validation ou rejet d'un bon à tirer, changement de paquet de règles rattaché à un site, publication d'un paquet de borne, suppression logique d'une entité, changement de rôle d'un membre.

---

## A13. Environnements, intégration continue, migrations

### A13.1 Environnements

Trois : local, recette, production. Aucune donnée client réelle hors production.

### A13.2 Chaîne d'intégration

Sur chaque proposition de fusion, dans l'ordre, arrêt au premier échec :

```
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm test:visual
pnpm test:rls
pnpm test:determinism
pnpm test:e2e
pnpm build
```

Un déploiement quotidien sur instance Supabase autonome vérifie la contrainte A3.4.

### A13.3 Migrations

- Une migration par commit, jamais mélangée à du code applicatif.
- Toute migration est réversible, ou déclare explicitement qu'elle ne l'est pas et pourquoi.
- Une migration destructive relève de A2.2 : arrêt et demande.
- Toute table nouvelle portant `org_id` arrive avec sa politique de cloisonnement dans la même migration.

---

## A14. Définition de terminé

Une tâche est terminée quand, et seulement quand, tous ces points sont vrais :

1. Le code compile en mode strict, sans avertissement.
2. Le lint passe, sans règle désactivée.
3. Les tests passent, aucun ignoré, aucun ajouté en attente.
4. Les tests de non-régression visuelle passent, ou les empreintes sont mises à jour dans le même commit avec justification.
5. Les critères d'acceptation de la tâche sont vérifiés par une commande, pas par une appréciation.
6. Aucune valeur normative ni couleur en dur n'a été introduite.
7. Aucun fichier hors périmètre déclaré n'a été modifié.
8. Le rapport de fin de tâche au format A2.6 est produit, avec la sortie réelle des commandes.
9. Ce qui n'a pas pu être vérifié est déclaré.

---

# PARTIE B. LOTS DE DÉVELOPPEMENT

## B0. Gradient de précision

La précision de cette partie décroît volontairement avec l'horizon.

| Incrément | Horizon | Grain | Statut |
| --- | --- | --- | --- |
| 0. Fondations | immédiat | tâche | ferme |
| 1. Audit de signalétique | 3 à 4 mois | tâche | ferme |
| 2. Production des supports | 4 à 5 mois | tâche | ferme |
| 3. Bornes et exploitation | 3 à 4 mois | lot | à détailler avant démarrage |
| 4. Industrialisation | 3 à 4 mois | lot | à détailler avant démarrage |
| 5 et 6. Extensions | au-delà | exigence | à spécifier le moment venu |

Détailler aujourd'hui les tâches de l'incrément 6 produirait un texte réécrit avant d'être lu. Le grain retenu est celui auquel la description reste vraie.

Chaque incrément porte un critère de sortie qui n'est pas technique. Un incrément dont le code fonctionne mais dont le critère de sortie n'est pas atteint n'est pas terminé, il est à réorienter.

---

## B1. Incrément 0. Fondations

Objectif : disposer d'un socle sur lequel toute tâche ultérieure se pose sans décision d'architecture.

**Critère de sortie :** la chaîne d'intégration A13.2 passe entièrement sur un dépôt vide de logique métier, et le test d'étanchéité entre organisations est vert.

### T-0.1 Squelette du dépôt
Objectif : structure A4, workspaces pnpm, TypeScript strict, lint, formatage.
Acceptation : `pnpm typecheck` et `pnpm lint` passent sur un dépôt sans code métier. Le graphe de dépendances des paquets respecte A4.1, vérifié par une règle de lint dédiée.

### T-0.2 Chaîne d'intégration
Objectif : A13.2 complète, y compris les emplacements des tests qui n'existent pas encore.
Acceptation : la chaîne s'exécute et échoue proprement si une étape manque. Aucune étape n'est ignorée silencieusement.

### T-0.3 Base et migrations
Objectif : outillage Drizzle, première migration, environnement local reproductible.
Acceptation : `pnpm db:reset` reconstruit une base vide identique. Une migration réversible est démontrée à l'aller et au retour.

### T-0.4 Schéma A5.1 et A5.2
Objectif : organisation, membres, site, bâtiment, niveau, zone, sources de plan, calage, empreintes, volumes, ouvertures.
Acceptation : contraintes de vérification en place, dont polygone simple fermé non auto-intersectant. Tests d'insertion valide et invalide pour chaque contrainte.

### T-0.5 Authentification et rôles
Objectif : Supabase Auth, table des membres, sept rôles de A6.2.
Acceptation : un utilisateur sans organisation ne voit rien. Changement de rôle journalisé.

### T-0.6 Cloisonnement par ligne
Objectif : politiques sur toutes les tables portant `org_id`, plus les deux tests obligatoires de A6.1.
Acceptation : `pnpm test:rls` passe. Ajouter une table sans politique fait échouer la CI, démontré par un test qui vérifie l'échec.
Cas limites : lecture par clé étrangère, message d'erreur révélateur, différence de temps de réponse, compteur agrégé.

### T-0.7 Jetons de thème
Objectif : `design-tokens` avec le thème Papier de A11.1 et les quatre couleurs réservées.
Acceptation : test d'analyse statique refusant toute couleur écrite hors de ce paquet. Test de contraste calculé sur chaque couple de jetons, seuil AA.

### T-0.8 Chargeur de paquets de règles
Objectif : paquet `rules`, format de fichier, validation, refus d'une règle sans `source_ref`, absence de valeur de repli.
Acceptation : un paquet valide se charge, un paquet sans `source_ref` est rejeté avec un code d'erreur stable, une règle absente lève une erreur au lieu de retourner une valeur par défaut.
Note : le contenu réel des paquets ne fait pas partie de cette tâche. Voir C4.

### T-0.9 Décision sur la génération PDF
Objectif : évaluer et trancher la bibliothèque de génération PDF/X et PDF/A.
Acceptation : note comparative de deux ou trois options, avec preuve de conformité PDF/X sur un fichier d'essai vérifié par un outil tiers, et démonstration du déterminisme de sortie.
Relève de A2.2 : la décision est proposée, pas prise seul.

### T-0.10 Trousse de test
Objectif : `testkit`, jeux de sites de référence de C1, utilitaires de comparaison SVG.
Acceptation : chaque site de référence se charge en base et en mémoire, avec empreinte stable.

### T-0.11 Service de compilation
Objectif : squelette du service Node, consommation de la file `job`, reprise après échec.
Acceptation : un travail factice s'exécute, échoue, est rejoué sans effet de bord, et laisse une trace complète.

### T-0.12 Vérification d'auto-hébergement
Objectif : déploiement sur instance Supabase autonome dans la chaîne quotidienne.
Acceptation : la suite de bout en bout passe sur cette instance. Toute dépendance non réimplantable fait échouer l'étape.

### T-0.13 Bibliothèque de composants et états
Objectif : composants de la liste fermée de la section F6, chacun dans ses états repos, survol, focus, actif, désactivé, erreur et chargement, section F6.1.
Acceptation : chaque composant existe dans ses sept états, avec non-régression visuelle par état et par langue. Aucun composant hors de la liste. L'indicateur de focus est distinct de l'indicateur de sélection.

### T-0.14 Jeu d'icônes et règle de non-confusion
Objectif : jeu d'icônes d'interface conforme à la section F9 : tracé seul, épaisseur constante, taille de base 16 pixels, incorporé.
Acceptation : contrôle automatique vérifiant qu'aucune icône n'est en aplat plein ni inscrite dans une forme fermée pleine, ni dans une couleur de sécurité. Chaque icône porte un texte de remplacement. Aucune icône chargée depuis le réseau.

### T-0.15 Dictionnaires et mécanisme bilingue
Objectif : mécanisme de traduction de la section D12 : toute chaîne passe par une clé de la forme domaine.écran.élément, avec une entrée par code d'anomalie et par langue active.
Acceptation : un test échoue si un code du catalogue n'a pas d'entrée dans chaque langue active. Analyse statique refusant toute chaîne écrite dans un composant. Les écrans sont contrôlables dans chaque langue, section F10.3.

### T-0.16 Métriques de police et registre des polices
Objectif : extraction des métriques de police à la construction, table versionnée portant une empreinte, mesure du texte exclusivement depuis cette table, registre des polices, section G5.
Acceptation : la mesure calculée concorde avec un rendu de référence. Un changement de version de police invalide les rendus concernés. Une police sans licence déclarée ne peut pas être incorporée dans un livrable distribué et lève `FONT.NOT_EMBEDDABLE`.

---

## B2. Incrément 1. Audit de signalétique

Objectif : modéliser un site, saisir son graphe, calculer les parcours, reprendre un carnet de supports existant et produire un rapport d'audit. Aucune production de support à ce stade.

**Critère de sortie :** deux audits vendus et payés à des clients réels.

### T-1.1 Import et calage d'un plan
Objectif : téléversement d'un plan raster ou PDF, calage à l'échelle par deux points de référence, rotation.
Acceptation : un plan calé restitue une distance connue à moins de 1 % d'erreur. Le calage est rejouable et donne le même résultat.
Cas limites : plan pivoté, plan à échelle non uniforme, plan multipage, plan sans échelle indiquée.

### T-1.2 Saisie des empreintes
Objectif : éditeur de polygones sur le plan calé, accrochage, édition de sommets.
Acceptation : un polygone auto-intersectant est refusé à la saisie avec un code d'erreur stable. Les coordonnées stockées sont en mètres, jamais en pixels.

### T-1.2b Motif de commande et annulation
Objectif : toute modification de donnée passe par une commande sérialisable et réversible, avec pile d'annulation, regroupement par geste et sauvegarde locale, section E5. Préalable à T-1.4.
Acceptation : annuler puis rétablir rend un état identique. La pile est vidée à la synchronisation. Le rejeu d'une séquence d'opérations enregistrée donne deux fois le même état final, section E4.4.

### T-1.2c Outils métier de tracé
Objectif : outils de la section E7.2 : tracé de cellule, décalage parallèle, division et fusion de cellules, tracé d'axe produisant nœuds et arêtes, placement de nœud typé, duplication en série, report de niveau.
Acceptation : chaque outil produit une géométrie qui passe les contrôles de saisie. La division et la fusion conservent ou arbitrent explicitement les attributs. Le tracé d'axe ne produit aucun doublon.

### T-1.2d Magnétisme et contraintes
Objectif : cibles, tolérance exprimée en pixels écran, priorité entre cibles et contraintes de tracé, section E8.
Acceptation : à état de vue et geste identiques, la cible retenue est identique. L'ordre de priorité entre cibles est celui de la section E8.2.

### T-1.3 Volumes
Objectif : altitude de base, hauteur, matière par empreinte.
Acceptation : un volume sans hauteur est refusé. Les valeurs par défaut proviennent du niveau, jamais d'une constante.

### T-1.4 Saisie du graphe
Objectif : nœuds typés, arêtes, longueur calculée, attributs de A5.3.
Acceptation : `edge.length_m` est recalculé à toute modification de position et n'est jamais saisissable. Une arête reliant un nœud à lui-même est refusée.

### T-1.5 Liaisons verticales et inter-bâtiments
Objectif : ascenseurs, escaliers, escaliers mécaniques, rampes, passages entre bâtiments.
Acceptation : une arête entre deux niveaux sans liaison verticale associée est refusée. Un bâtiment à accès indépendant sans liaison est signalé, pas refusé.

### T-1.6 Validation de complétude
Objectif : `validateGraph` complet, avec tous les cas de A7.1.
Acceptation : chaque cas de détection dispose d'un site de référence dédié qui le déclenche, et d'un site voisin qui ne le déclenche pas.

### T-1.7 Destinations et annuaire
Objectif : destinations, catégories, dénominations bilingues, statut d'occupation.
Acceptation : une destination sans nœud d'accès est signalée par `validateGraph`. Une dénomination manquante dans une langue active est signalée.

### T-1.8 Bibliothèques sectorielles
Objectif : jeux de catégories et de pictogrammes préchargés par secteur, éditables par le client.
Acceptation : un pictogramme du registre de sécurité est en lecture seule, toute tentative de modification échoue au niveau de la base. Application de INV-3.

### T-1.9 Profils de parcours
Objectif : profils paramétrables, pondérations, exclusions, contraintes horaires.
Acceptation : un profil accessible n'emprunte aucune arête non accessible. Un profil d'évacuation n'emprunte aucun ascenseur. Vérifié sur les sites de référence.

### T-1.10 Moteur de parcours
Objectif : `computeRoute`, pondération, cache et invalidation par empreinte des entrées.
Acceptation : le même couple origine et destination donne le même chemin à chaque appel. Modifier une arête invalide le cache concerné et lui seul.
Cas limites : destination inatteignable, plusieurs chemins de coût égal, graphe non connexe, arête indisponible à l'heure demandée.

### T-1.11 Points de décision
Objectif : `deriveDecisionPoints`.
Acceptation : sur chaque site de référence, la liste attendue est produite exactement. Un nœud à une seule issue n'est jamais un point de décision.

### T-1.12 Audits
Objectif : couverture, accessibilité, évacuation.
Acceptation : `auditCoverage` refuse de produire un taux tant que `validateGraph` échoue, avec un code d'erreur dédié.

### T-1.13 Reprise de carnet existant
Objectif : import tableur d'un carnet de supports, rattachement aux nœuds, relevé d'état, photographie.
Acceptation : un import partiellement erroné importe les lignes valides, rejette les autres, et produit un rapport ligne à ligne. Aucun import silencieusement tronqué.
Cas limites : doublons, nœud inexistant, azimut absent, colonnes en désordre, encodage non standard, séparateur décimal en virgule.

### T-1.14 Rapport de rapprochement
Objectif : trois listes, supports superflus, points de décision non couverts, supports mal orientés ou sous-dimensionnés.
Acceptation : le rapport est reproductible et exportable. Chaque ligne référence une entité par son identifiant, jamais par son libellé seul.

### T-1.15 Écran de conception
Objectif : interface de A11, arborescence, zone de travail, panneau de propriétés.
Acceptation : aucune violation détectable automatiquement aux niveaux A et AA sur les écrans livrés, résultats incomplets listés pour revue manuelle. Aucune couleur hors jetons.

### T-1.16 Présence et verrouillage consultatif
Objectif : présence des utilisateurs sur un niveau et verrou consultatif au niveau de l'objet, avec expiration et passage en force journalisé, section G4.2.
Acceptation : un verrou expiré tombe de lui-même. Un passage en force est journalisé et nomme le détenteur du verrou. Aucun verrou ne bloque sans recours. Un objet verrouillé lève `EDIT.OBJECT_LOCKED`.

---

## B3. Incrément 2. Production des supports

Objectif : produire les exécutions fabricables et le quantitatif, avec leurs contrôles.

**Critère de sortie :** un carnet complet accepté par un fabricant réel et posé.

### T-2.1 Typologies de supports
Objectif : typologies paramétrables, nombre de faces, gabarit associé.
Acceptation : ajouter une typologie ne demande aucune modification de code.

### T-2.2 Gabarits de face
Objectif : gabarits déclaratifs, blocs de contenu typés.
Acceptation : un gabarit est une donnée, pas un composant. Test le prouvant par ajout d'un gabarit en test.

### T-2.3 Résolution du contenu
Objectif : `resolveFaceContent` depuis les lignes du tableau des messages.
Acceptation : modifier une destination change le contenu résolu de toutes les faces concernées, et d'aucune autre. Application de INV-2.

### T-2.4 Calcul des dimensions
Objectif : `computeDimensions`, format déduit du contenu, de la distance de lecture et de la langue la plus longue.
Acceptation : la hauteur de caractère provient du paquet de règles, jamais du code. Le passage en mode saisi manuel bascule `dimensions_source` et déclenche un contrôle bloquant si le format devient non conforme.

### T-2.5 Contrôles
Objectif : lisibilité, contraste, lexique, adjacence chromatique, validité des destinations.
Acceptation : chaque contrôle produit un `Finding` avec `ruleRef` renseigné si son origine est normative. Un contrôle sans référence quand il en faut une fait échouer un test.

### T-2.6 Cloisonnement du registre de sécurité
Objectif : refus effectif de toute application d'une charte au registre de sécurité.
Acceptation : test dédié pour chaque type de tentative, couleur, géométrie, pictogramme, proportion. Chacune échoue avec un code distinct.

### T-2.7 Projection isométrique
Objectif : `project`, `orderOcclusions`, `deriveHitAreas`.
Acceptation : les zones cliquables sont dérivées, jamais stockées comme géométrie indépendante. Un changement d'occupant ne demande aucun redécoupage. Le tri des occultations est déterministe, règle de départage documentée.

### T-2.8 Vue en plan simplifié
Objectif : `renderSimplifiedPlan`, obligatoire.
Acceptation : disponible partout où l'isométrie l'est. Contraste vérifié au calcul. Densité d'information réduite mesurée par un critère explicite, pas par appréciation.

### T-2.9 Plans muraux orientés
Objectif : `renderOrientedMap`, un rendu par implantation.
Acceptation : deux supports d'azimut différent produisent deux fichiers différents. Ce qui est devant l'usager est en haut du panneau, vérifié par un test géométrique.

### T-2.10 Plans d'évacuation
Objectif : livrable nommé, règles propres d'orientation, de légende et de contenu.
Acceptation : ne peut être produit que sous un paquet de règles rattaché. Refus explicite si absent.

### T-2.11 Chaîne tactile et braille
Objectif : `renderTactile`, braille intégral non abrégé, en français et en anglais.
Acceptation : géométrie des points conforme au paquet de règles. Voir C4, le standard de transcription est un point non tranché.

### T-2.12 Exécutions PDF
Objectif : export PDF/X et PDF/A, profils colorimétriques par substrat.
Acceptation : conformité vérifiée par un outil tiers dans la chaîne d'intégration. Deux exports du même contenu sont identiques.

### T-2.13 Quantitatif
Objectif : `computeQuantities`, export tableur.
Acceptation : les totaux se recoupent avec le nombre de supports en base. Écart nul exigé, pas toléré.

### T-2.14 Versions et bons à tirer
Objectif : versionnage, états, épreuves, approbations.
Acceptation : `approval` est en insertion seule au niveau de la base. Une tentative de modification échoue même avec un rôle `admin`.

### T-2.15 Rendu de face
Objectif : `renderFace`, SVG.
Acceptation : non-régression visuelle sur l'ensemble des gabarits et des sites de référence.

### T-2.16 Compilation en lot
Objectif : compilation de 300 supports par le service de compilation.
Acceptation : moins de 10 minutes. Reprise après interruption sans doublon ni perte.

### T-2.17 Couche d'habillage
Objectif : calques et formes d'habillage, strictement séparés de la couche métier, sections E9.2 et E9.3.
Acceptation : aucun objet d'habillage ne participe à un calcul : parcours, couverture, quantitatif ou zone cliquable.

### T-2.18 Annotations et symboles d'habillage
Objectif : annotations bilingues à filet de rappel, et bibliothèque de symboles d'habillage, sections E9.3 et E9.5.
Acceptation : les annotations existent dans chaque langue active. Aucun symbole d'habillage ne peut être confondu avec un pictogramme du registre de sécurité.

### T-2.19 Composition de page
Objectif : mise en page d'un plan, bloc de titre, marges et format, section E9.3.
Acceptation : la légende est générée depuis les catégories réellement présentes et la rose des vents depuis l'orientation, section E9.4. Seule leur position est composée.

### T-2.20 Import et assainissement d'actifs
Objectif : import des actifs clients par un outil serveur isolé, avec assainissement obligatoire avant stockage, section E14.
Acceptation : un actif non assaini n'est jamais rendu. Scripts, références externes et métadonnées sont supprimés. Un actif non assainissable lève `ASSET.SANITIZATION_FAILED`, une image en mode point dans un logo lève `ASSET.RASTER_IN_LOGO`.

---

## B4. Incrément 3. Bornes et exploitation

Grain lot. À détailler en tâches avant démarrage.

**Critère de sortie :** un abonnement signé, paquet déployé sur deux modèles de bornes distincts, coupure réseau de 72 heures sans dégradation, retour arrière déclenché et vérifié.

**L3.1 Animation de parcours.** Tracé progressif, mise en évidence des points de décision, transition explicite au changement de niveau, équivalent statique pour l'impression et le mode à animation réduite.

**L3.2 Fabrication du paquet de borne.** Artefact statique autonome, chemins relatifs, aucune dépendance réseau à l'affichage. Vérification automatisée de l'absence de toute requête sortante.

**L3.3 Mise à jour et bascule.** Démarrage sur copie locale, fichier de version léger, téléchargement complet, bascule atomique après validation intégrale, conservation de la version précédente, retour arrière automatique en cas d'échec au démarrage. Le test décisif est une interruption de téléchargement en cours.

**L3.4 Configuration par borne.** Un seul paquet par site, différenciation par fichier local, identifiant, nœud, azimut, langue par défaut, bâtiment. La borne calcule son propre repère et oriente le plan.

**L3.5 Ergonomie de borne.** Plein écran verrouillé, aucun lien sortant, retour à l'accueil après inactivité, aucun état conservé entre usagers, cibles tactiles dimensionnées, redémarrage programmé. Exigences d'accessibilité de A11.3 traitées comme fonctionnelles.

**L3.6 Télémétrie.** Journalisation locale, remontée différée, aucune donnée à caractère personnel, contrôle automatisé.

**L3.7 Couche de divergence.** Support posé, divergence, ordre de travaux. Détection automatique des écarts entre conçu et posé. C'est ce lot qui fonde la valeur d'abonnement, il n'est pas optionnel.

**L3.8 Profil de conformité matérielle.** Document publiable décrivant ce que toute borne doit satisfaire. Pièce contractuelle, pas une note interne.

---

## B5. Incrément 4. Industrialisation

Grain lot. À détailler en tâches avant démarrage.

**Critère de sortie :** un client mis en service sans intervention lourde d'Atlas Studio.

**L4.1 Multi-organisations complet.** Administration, invitations, gestion fine des droits, cas du rôle `vendor` limité par rattachement.

**L4.2 Facturation.** Abonnement par site, tranches, options bornes et télémétrie, multi-devises, cycles annuels, mode projet ponctuel.

**L4.3 Second paquet de règles.** Une juridiction supplémentaire, opérationnelle et testée. C'est ce lot qui prouve que l'architecture ne s'est pas repliée sur un cas unique.

**L4.4 Hors ligne côté conception.** Copie locale du site, travail sans réseau, synchronisation différée. Concurrence optimiste au niveau de l'objet, pas du site. Les conflits réels sont arbitrés par l'utilisateur avec les deux versions présentées. Deux cas demandent un traitement dédié : suppression d'un nœud modifié ailleurs, et modification concurrente de la topologie produisant un graphe incohérent alors que chaque modification est valide isolément. La validation de complétude est rejouée après chaque synchronisation et bloque la publication si elle échoue. C'est le lot le plus susceptible de dépasser sa charge.

**L4.5 Interface avec l'état locatif.** Import périodique, détection des mutations, liste des supports impactés, quantitatif de reprise, coût estimé.

**L4.6 Thème sombre.** Second jeu complet de couleurs sémantiques. La zone de prévisualisation et l'écran de validation des bons à tirer restent en fond clair.

**L4.7 Audit d'accessibilité externe.** Par tierce partie, avant commercialisation large.

---

## B6. Incréments 5 et 6

Grain exigence. Ces éléments ne sont pas planifiés, ils sont garantis non bloqués par l'architecture.

### Incrément 5

- Application web visiteur installable, atteinte par code à scanner, sans passage par un magasin d'applications.
- Intégration à un système de diffusion de contenus tiers. Azimut devient une zone dans leur système, jamais l'inverse.
- Dossier de fixation transmissible à un ingénieur : données, plans de détail, charges d'exploitation. Le calcul structurel signé reste exclu définitivement.
- Export IndoorGML. Reporté ici parce que son support réel par les outils des clients n'est pas vérifié. Voir C4.
- Autonomie de mise en service du client.

### Incrément 6

- Positionnement temps réel par balises, en option activable.
- Vue 3D navigable en rotation libre, en option activable. Les volumes extrudés la rendent possible sans reprise du modèle. Le choix reste contraire à la finalité d'orientation, il n'est ouvert que sur demande client explicite.
- Import IFC.
- Écriture de droite à gauche et ouverture de l'Afrique du Nord. Impose une reprise du moteur de composition et de tous les gabarits.

---

# PARTIE C. ANNEXES

## C1. Sites de référence

Un produit validé sur un seul site apprend les particularités de ce site. Le banc d'essai est donc délibérément varié. Ces sites sont des données de test, construites, jamais des données client réelles.

| Clé | Nature | Ce qu'il éprouve |
| --- | --- | --- |
| `ref-minimal` | Un niveau, 4 destinations | Cas de base, non-régression rapide |
| `ref-retail` | Commerce multibâtiment, 5 niveaux | Accès indépendants, lobby commun, horaires distincts par bâtiment, une liaison inter-bâtiments couverte et une non couverte |
| `ref-health` | Établissement de santé | Flux séparés, service ouvert en continu, profil brancard |
| `ref-transit` | Site de transport | Pointes de charge, flux avec bagage, nombreuses issues |
| `ref-campus` | Campus | Cheminements extérieurs, liaisons entre bâtiments distants |
| `ref-broken` | Graphe volontairement incohérent | Chaque cas de détection de `validateGraph` |
| `ref-adversarial` | Cas limites | Polygones dégénérés, arêtes nulles, coûts égaux, boucles, noms très longs dans les deux langues |

Chaque cas de détection de `validateGraph` dispose d'un site qui le déclenche et d'un site voisin qui ne le déclenche pas. Un test de détection sans son contre-exemple est incomplet.

## C2. Contenu attendu du fichier CLAUDE.md

Le fichier `CLAUDE.md` à la racine du dépôt est court et pointe vers ce document. Il contient, et rien de plus :

1. Les cinq invariants de A1.2, écrits en toutes lettres.
2. Les interdictions permanentes de A2.4.
3. Les quatre commandes de vérification de A2.3.
4. La liste des cas d'arrêt obligatoire de A2.2.
5. Le format de rapport de fin de tâche de A2.6.
6. Un renvoi vers ce cahier des charges pour tout le reste.

Il ne duplique pas le modèle de données ni les tâches. Un fichier de conduite qui se met à contenir de la spécification cesse d'être lu.

## C3. Checklist de revue

À passer sur chaque proposition de fusion, avant toute lecture détaillée du code. Un point faux arrête la revue.

**Périmètre**
- [ ] Aucun fichier modifié hors du périmètre déclaré
- [ ] Aucun renommage, reformatage ou refactorisation non demandés
- [ ] Aucune dépendance ajoutée sans passage par A2.2

**Invariants**
- [ ] Aucune valeur d'origine normative écrite dans le code
- [ ] Aucune couleur écrite hors de `design-tokens`
- [ ] Aucun `engine-*` n'importe le DOM, la base, le réseau ou l'horloge
- [ ] Aucune source d'indéterminisme introduite
- [ ] Le registre de sécurité reste inaccessible aux chartes

**Données**
- [ ] Toute table nouvelle portant `org_id` arrive avec sa politique de cloisonnement
- [ ] Migration séparée du code applicatif
- [ ] Migration réversible, ou non-réversibilité déclarée et justifiée

**Qualité**
- [ ] Les quatre commandes ont été exécutées, sortie réelle fournie
- [ ] Aucun test ignoré ni mis en attente
- [ ] Empreintes visuelles mises à jour dans le même commit si écart attendu, avec justification
- [ ] Unités présentes dans les noms de variables dimensionnelles
- [ ] Aucun `any`

**Rapport**
- [ ] Rapport au format A2.6 fourni
- [ ] Rubrique « constaté, non traité » renseignée
- [ ] Rubrique « non vérifié » renseignée

## C4. Points non tranchés, à ne pas inventer

Ces points ne sont pas des oublis. Ils sont ouverts, et l'agent n'a pas le droit de les combler par une valeur plausible. Chacun relève de A2.2.

**C4.1 Corpus réglementaire par pays.** L'état du corpus applicable aux ERP dans les pays visés n'est pas établi. Aucun paquet de règles ne doit être rédigé sur la base d'une supposition. Un paquet de règles vide, refusant toute résolution, est un comportement correct. Un paquet de règles inventé est une faute.

**C4.2 Millésimes des normes.** Les références normatives du plan de conception sont fiables, leurs éditions en vigueur ne sont pas confirmées. Toute règle porte `source_ref`, et `source_ref` ne s'invente pas.

**C4.3 Standard de transcription braille.** Le standard applicable par langue n'est pas confirmé. La chaîne tactile se construit avec un transcripteur enfichable, jamais avec une table de correspondance écrite de mémoire.

**C4.4 Bibliothèque PDF.** Tranchée en T-0.9, pas avant.

**C4.5 Support réel d'IndoorGML.** Non vérifié auprès des outils des clients cibles. Raison de son report en incrément 5.

**C4.6 Matériel de borne.** Aucun modèle arrêté. Le produit publie un profil de conformité au lieu de cibler un matériel. Aucune adhérence à un lecteur particulier.

**C4.7 Seuils de viabilité commerciale.** Prix d'abonnement, volume de sites accessibles, cycle de vente. Sans objet pour le code, mais conditionne la poursuite après l'incrément 1.

**C4.8 Contrastes du thème.** Les couples de jetons de A11.1 sont estimés, pas mesurés. Le test de contraste de T-0.7 fait foi. Si un couple échoue, la valeur du jeton est corrigée, jamais le seuil.

## C5. Ce qui n'a pas pu être vérifié dans ce document

Historique. Cette liste ne fait plus foi. Les points encore ouverts sont repris dans le registre de la partie K, section K3, seule liste à tenir.

Écrit ici pour que personne ne le découvre plus tard.

1. Les versions de bibliothèques de A3.1 sont celles connues à la rédaction. Elles doivent être confirmées au démarrage.
2. Les seuils de performance repris du plan de conception ne reposent sur aucune mesure. Ce sont des cibles, à réviser après le premier site réel modélisé.
3. La charge des tâches n'est pas estimée. Ce document décrit ce qu'il faut faire et comment le vérifier, pas combien de temps cela prend.
4. Le comportement exact des politiques de cloisonnement sur les requêtes agrégées et les jointures profondes demande une validation empirique, pas une lecture de documentation.
5. La faisabilité du déterminisme strict à l'octet sur la sortie PDF dépend de la bibliothèque retenue et n'est pas acquise. C'est un critère de la décision T-0.9.

---

# PARTIE D. Conventions, formats et algorithmes

Cette partie fixe les conventions, formats et algorithmes que toutes les autres parties supposent.

Il existe parce que le cahier des charges principal disait quoi construire et comment vérifier, mais laissait dix-huit points à l'appréciation de celui qui code. Chacun de ces points est une source d'incohérence silencieuse.

---

## D0. Pourquoi ces points sont bloquants

Les sections qui suivent ne sont pas des précisions de confort. Trois d'entre elles conditionnent des invariants déjà posés :

- Sans D1, l'invariant 4 sur le déterminisme n'a pas de mécanisme. Deux développeurs arrondiront différemment et les empreintes de non-régression diffèreront sans raison apparente.
- Sans D3, l'invariant 5 sur l'absence de valeur normative en dur n'a pas de contenant. Les valeurs finiront dans le code faute de savoir où les mettre.
- Sans D2, les codes d'anomalie seront inventés au fil de l'eau, deviendront incohérents entre moteurs, et la couche d'interface ne pourra pas les traduire.

---

## D1. Système de coordonnées, unités et arrondis

### D1.1 Repère métier

Repère unique pour tout le produit, appelé repère site.

- Origine : point de référence du site, stocké sur la ligne `site`. Fixé au premier calage et jamais modifié ensuite.
- Axe X : vers l'est, en mètres.
- Axe Y : vers le nord, en mètres.
- Axe Z : vers le haut, en mètres. Z = 0 au niveau de référence du site, pas du bâtiment.
- Toutes les géométries de la base sont dans ce repère. Aucune coordonnée de géométrie du site n'est jamais stockée en pixels. Seul le calage d'une source de plan, qui décrit l'image et non le site, conserve des coordonnées en pixels de l'image : sans elles, un calage ne pourrait pas être rejoué à l'identique. Voir la règle M01.S2.

Conséquence : le repère métier est direct et orienté nord, alors que le repère d'affichage SVG a son axe vertical dirigé vers le bas. **L'inversion de l'axe vertical se fait au tout dernier moment, dans la fonction de sérialisation SVG, et nulle part ailleurs.** Un moteur qui manipule des coordonnées déjà inversées est un bug.

### D1.2 Unités

| Grandeur | Unité de stockage | Suffixe de nom |
| --- | --- | --- |
| Distance sur plan | mètre | `_m` |
| Dimension de support | millimètre entier | `_mm` |
| Hauteur de caractère | millimètre | `_mm` |
| Angle | degré | `_deg` |
| Pente | pourcentage | `_pct` |
| Surface | mètre carré | `_m2` |
| Coût | unité monétaire mineure, entier | `_minor` |

Aucune conversion implicite. Une fonction qui reçoit des mètres et retourne des millimètres le dit dans son nom.

### D1.3 Convention d'angle

Convention unique, dite convention compas :

- 0 degré = nord.
- Sens croissant = horaire. 90 = est, 180 = sud, 270 = ouest.
- Domaine de stockage : [0, 360[. La normalisation est faite à l'écriture, jamais à la lecture.

Cette convention est contraire à la convention mathématique usuelle. Elle est retenue parce qu'elle correspond à ce que lit un géomètre et à ce que porte une rose des vents. Toute fonction trigonométrique interne qui a besoin de la convention mathématique fait la conversion localement et ne la propage pas.

### D1.4 Arrondis

Source principale d'indéterminisme. Règles strictes :

- Fonction d'arrondi unique, exportée par `core-model`, jamais réimplémentée : arrondi au plus proche, cas d'égalité résolu en s'éloignant de zéro.
- Toute coordonnée écrite dans un SVG est arrondie à 3 décimales. Sur des mètres, cela vaut le millimètre.
- Toute dimension de support est arrondie à l'entier millimétrique, vers le haut si le calcul est une contrainte minimale, vers le plus proche sinon. La distinction est portée par le nom de la fonction.
- Le zéro négatif est interdit en sortie. La sérialisation le convertit en zéro.
- Aucun calcul intermédiaire n'est arrondi. L'arrondi n'a lieu qu'à la sérialisation ou au franchissement d'un seuil normatif.

Test obligatoire : sérialiser une géométrie dont les coordonnées valent exactement 0,0005, -0,0005, -0 et vérifier la sortie attendue.

### D1.5 Tolérances géométriques

| Objet | Tolérance | Emploi |
| --- | --- | --- |
| Deux points confondus | 0,001 m | Fermeture de polygone, accrochage |
| Deux angles égaux | 0,01 degré | Colinéarité |
| Arête de longueur nulle | < 0,01 m | Refus à la saisie |
| Surface de polygone dégénéré | < 0,0001 m2 | Refus à la saisie |

Ces tolérances sont des constantes techniques, pas des valeurs normatives. Elles vivent dans `core-model` et non dans un paquet de règles.

---

## D2. Catalogue des codes d'anomalie

### D2.1 Convention de nommage

Format : `DOMAINE.SUJET_CONDITION`, en majuscules, un point de séparation, souligné dans les segments.

Domaines autorisés, et eux seuls : `ACCOUNT`, `AD`, `ASSET`, `ASSIST`, `CALIB`, `CHARTER`, `CLOSURE`, `COLOR`, `COST`, `DATA`, `DOC`, `EDIT`, `EXPORT`, `FLOW`, `FONT`, `GEOM`, `GRAPH`, `IMPORT`, `INK`, `INSTALL`, `KIOSK`, `LAYOUT`, `LIBRARY`, `MODULE`, `PACKAGE`, `PARK`, `PICTO`, `RENDER`, `REVIEW`, `RULES`, `SECURITY`, `SITE_STATE`, `SKETCH`, `SURVEY`, `TENANT`, `TERMINATION`, `TYPO`, `VENDOR`, `VISITOR`, `WAYFIND`. Un domaine nouveau s'ajoute ici, dans le même commit que son premier code.

Un code est stable à vie. Il n'est jamais renommé, jamais traduit, jamais réutilisé pour un autre sens. Un code retiré est marqué obsolète et sa valeur reste réservée.

### D2.2 Catalogue initial

Toute anomalie produite par un moteur figure dans ce catalogue. Ajouter un code demande une entrée ici dans le même commit.

**Graphe**

| Code | Gravité | Sens |
| --- | --- | --- |
| `GRAPH.NODE_ORPHAN` | bloquant | Nœud relié à aucune arête |
| `GRAPH.ZONE_UNREACHABLE` | bloquant | Zone non atteignable depuis une entrée |
| `GRAPH.DESTINATION_UNLINKED` | bloquant | Destination sans nœud d'accès |
| `GRAPH.LEVEL_NO_VERTICAL_LINK` | bloquant | Niveau sans liaison verticale |
| `GRAPH.LEVEL_NO_ACCESSIBLE_LINK` | bloquant | Niveau sans liaison verticale accessible |
| `GRAPH.EDGE_ZERO_LENGTH` | bloquant | Arête de longueur inférieure à la tolérance |
| `GRAPH.EDGE_SELF_LOOP` | bloquant | Arête reliant un nœud à lui-même |
| `GRAPH.DISCONNECTED` | bloquant | Graphe non connexe |
| `GRAPH.DEAD_END_UNJUSTIFIED` | avertissement | Impasse sans destination ni justification |
| `GRAPH.VERTICAL_LINK_MISSING` | bloquant | Arête entre niveaux sans liaison verticale |
| `GRAPH.BUILDING_ISOLATED` | avertissement | Bâtiment sans liaison ni accès indépendant |
| `GRAPH.BUILDING_LINK_MISSING` | bloquant | Arête entre deux bâtiments sans ligne `building_link` |
| `GRAPH.VERTICAL_LINK_SAME_LEVEL` | bloquant | Liaison verticale entre deux nœuds d'un même niveau |
| `GRAPH.BUILDING_ACCESS_INDEPENDENT_ONLY` | avertissement | Bâtiment relié au reste du site par son seul accès indépendant. Ne se lève que sur un site à plusieurs bâtiments |
| `GRAPH.NOT_VALIDATED` | bloquant | Audit demandé avant validation de complétude |

**Géométrie**

| Code | Gravité | Sens |
| --- | --- | --- |
| `GEOM.POLYGON_SELF_INTERSECTING` | bloquant | Polygone auto-intersectant |
| `GEOM.POLYGON_NOT_CLOSED` | bloquant | Polygone non fermé |
| `GEOM.POLYGON_TOO_FEW_VERTICES` | bloquant | Moins de 3 sommets |
| `GEOM.POLYGON_DEGENERATE` | bloquant | Surface sous tolérance |
| `GEOM.VOLUME_NO_HEIGHT` | bloquant | Volume sans hauteur |
| `GEOM.FOOTPRINTS_OVERLAP` | avertissement | Empreintes superposées sur un même niveau |

**Composition**

| Code | Gravité | Sens |
| --- | --- | --- |
| `LAYOUT.CHAR_HEIGHT_BELOW_MIN` | bloquant | Hauteur de caractère sous le minimum normatif |
| `LAYOUT.CONTRAST_BELOW_MIN` | bloquant | Contraste de luminance insuffisant |
| `LAYOUT.CONTENT_OVERFLOW` | bloquant | Contenu ne tenant pas dans le format |
| `LAYOUT.DIMENSIONS_OVERRIDDEN_NONCONFORM` | bloquant | Format saisi manuellement et non conforme |
| `LAYOUT.DESTINATION_NOT_FOUND` | bloquant | Destination affichée inexistante |
| `LAYOUT.DESTINATION_UNREACHABLE` | bloquant | Destination affichée non atteignable |
| `LAYOUT.LANG_VARIANT_MISSING` | avertissement | Dénomination absente dans une langue active |
| `LAYOUT.LANG_VARIANT_LONGER` | information | La variante non primaire est plus longue |
| `LAYOUT.LEXICON_FORBIDDEN_TERM` | bloquant | Terme interdit par la charte |
| `LAYOUT.LEXICON_DISCOURAGED_TERM` | avertissement | Terme déconseillé par la charte |
| `LAYOUT.CHROMATIC_ADJACENCY` | bloquant | Adjacence chromatique interdite |
| `LAYOUT.LOGO_BELOW_MIN_WIDTH` | bloquant | Logo sous la largeur minimale |

**Règles et sécurité**

| Code | Gravité | Sens |
| --- | --- | --- |
| `RULES.PACK_NOT_BOUND` | bloquant | Opération exigeant des règles sur un site sans paquet de règles rattaché |
| `RULES.RULE_NOT_FOUND` | bloquant | Règle attendue absente du paquet |
| `RULES.SOURCE_REF_MISSING` | bloquant | Règle sans référence documentaire |
| `RULES.PACK_CHECKSUM_MISMATCH` | bloquant | Paquet altéré |
| `SECURITY.REGISTRY_WRITE_DENIED` | bloquant | Tentative de modification du registre de sécurité |
| `SECURITY.CHARTER_OVERRIDE_DENIED` | bloquant | Tentative d'application d'une charte au registre de sécurité |

**Import et paquet**

| Code | Gravité | Sens |
| --- | --- | --- |
| `IMPORT.COLUMN_MISSING` | bloquant | Colonne obligatoire absente |
| `IMPORT.ROW_INVALID` | avertissement | Ligne rejetée, import poursuivi |
| `IMPORT.NODE_NOT_FOUND` | avertissement | Nœud référencé inexistant |
| `IMPORT.DUPLICATE_KEY` | avertissement | Clé en double |
| `IMPORT.UNIT_AMBIGUOUS` | bloquant | Unité du fichier source indéterminable |
| `IMPORT.ENCODING_UNSUPPORTED` | bloquant | Encodage non reconnu |
| `PACKAGE.NETWORK_DEPENDENCY` | bloquant | Le paquet de borne émet une requête sortante |
| `PACKAGE.CHECKSUM_MISMATCH` | bloquant | Intégrité du paquet non vérifiée |
| `PACKAGE.NON_DETERMINISTIC` | bloquant | Deux compilations divergent |

**Calage et saisie du socle**

| Code | Gravité | Sens |
| --- | --- | --- |
| `CALIB.POINT_REQUIRED` | bloquant | Point de calage manquant |
| `CALIB.POINTS_TOO_CLOSE` | bloquant | Points de calage trop rapprochés |
| `CALIB.DISTANCE_INVALID` | bloquant | Distance réelle absente ou non positive |
| `CALIB.AZIMUTH_INVALID` | bloquant | Azimut du nord hors plage |
| `CALIB.SCALE_IMPLAUSIBLE` | avertissement | Échelle hors de la plage vraisemblable |
| `CALIB.LEVEL_NOT_CALIBRATED` | bloquant | Niveau sans plan calé |
| `DATA.NAME_REQUIRED` | bloquant | Nom requis |
| `DATA.NAME_DUPLICATE` | bloquant | Nom déjà utilisé dans l'organisation |
| `DATA.COUNTRY_REQUIRED` | bloquant | Pays requis |
| `DATA.LANG_REQUIRED` | bloquant | Au moins une langue active requise |
| `DATA.CODE_DUPLICATE` | bloquant | Code de cellule déjà utilisé sur le niveau |
| `DATA.CAPACITY_INVALID` | bloquant | Capacité d'une liaison verticale absente ou non positive |
| `DATA.LEVEL_ORDINAL_DUPLICATE` | bloquant | Deux niveaux de même rang dans un bâtiment |
| `DATA.LEVEL_NOT_EMPTY` | bloquant | Suppression d'un niveau portant des empreintes ou des nœuds |
| `DATA.UNIT_CODE_REQUIRED` | bloquant | Cellule sans code |
| `IMPORT.FILE_TOO_LARGE` | bloquant | Fichier au-delà de la taille maximale |
| `IMPORT.FORMAT_UNSUPPORTED` | bloquant | Format de fichier non pris en charge |
| `IMPORT.PAGE_REQUIRED` | bloquant | Page à choisir dans un document multipage |

**Wayfinding, parcours et règles**

| Code | Gravité | Sens |
| --- | --- | --- |
| `WAYFIND.LINE_UNJUSTIFIED` | bloquant | Ligne du tableau des messages sans point de décision |
| `GRAPH.DECISION_POINT_UNCOVERED` | bloquant | Point de décision non couvert par un support |
| `GRAPH.SUPPORT_UNUSED` | avertissement | Support ne servant aucun parcours |
| `FLOW.WEIGHTS_NOT_NORMALIZED` | bloquant | Somme des parts différente de 100 % |
| `FLOW.CORRELATION_TOO_LOW` | bloquant | Corrélation insuffisante pour produire un montant |
| `RULES.SCOPE_AMBIGUOUS` | bloquant | Deux règles de même code et de même spécificité |
| `RULES.TEST_PACK_OUTSIDE_TEST_ENV` | bloquant | Paquet de juridiction TEST chargé hors environnement de test |


**Codes des moteurs et des contrôles construits**

Inscrits au catalogue à partir de l'inventaire du dépôt. Trois codes de cet inventaire n'y figurent pas et sont retirés du dépôt : ils signalent un état d'écran de la section F7, non une anomalie produite par un moteur.

CALIB

| Code | Gravité | Sens |
| --- | --- | --- |
| `CALIB.CONTROL_POINTS_COLLINEAR` | bloquant | Points de calage colinéaires, l'ajustement est impossible |
| `CALIB.CONTROL_POINTS_INSUFFICIENT` | bloquant | Points de calage en nombre insuffisant |
| `CALIB.ORIGIN_LOCKED` | bloquant | Tentative de modification de l'origine du repère site, règle M01.S1 |
| `CALIB.ORIGIN_MISMATCH` | bloquant | Origine du repère incohérente entre deux niveaux d'un même site |
| `CALIB.RESIDUAL_MEAN_EXCEEDED` | bloquant | Résidu moyen de calage au-dessus du seuil |
| `CALIB.RESIDUAL_NOT_MEASURED` | avertissement | Résidu non mesurable, trop peu de points homologues |
| `CALIB.RESIDUAL_POINT_EXCEEDED` | bloquant | Résidu d'un point de calage au-dessus du seuil |

CHARTER

| Code | Gravité | Sens |
| --- | --- | --- |
| `CHARTER.RULE_MALFORMED` | bloquant | Règle de charte déclarée dont les paramètres sont illisibles ou ne correspondent pas à sa nature. À distinguer d'une règle absente, qui ne s'exécute pas et le signale, section A5.8 : une règle déclarée et cassée bloque, parce qu'elle a été voulue |

DATA

| Code | Gravité | Sens |
| --- | --- | --- |
| `DATA.APPROVED_VERSION_NOT_IMMUTABLE` | bloquant | Tentative de modification d'une version approuvée, règle M04.G7 |
| `DATA.CATEGORY_CYCLE` | bloquant | Cycle dans la hiérarchie des catégories |
| `DATA.CATEGORY_PARENT_NOT_FOUND` | bloquant | Catégorie parente inexistante |
| `DATA.DEST_CATEGORY_NOT_FOUND` | avertissement | Catégorie d'une destination inexistante |
| `DATA.EMPTY_SVG_PATH` | bloquant | Pictogramme sans tracé |
| `DATA.FACE_CONTENT_UNSERIALIZABLE` | bloquant | Contenu de face non sérialisable en forme canonique, section D7.2 |
| `DATA.FACE_DIMENSIONS_INVALID` | bloquant | Dimensions de face nulles ou négatives |
| `DATA.KIOSK_CONFIG_INVALID` | bloquant | Configuration locale de borne invalide, section D10.3 |
| `DATA.PICTOGRAM_CATEGORY_NOT_FOUND` | bloquant | Catégorie d'un pictogramme inexistante |
| `DATA.PROOF_DUPLICATE_VERSION` | bloquant | Deux épreuves pour un même numéro de version |
| `DATA.PROOF_PENDING_WITH_APPROVAL` | avertissement | Version restée en revue alors qu'une approbation existe |
| `DATA.PROOF_STATUS_WITHOUT_APPROVAL` | bloquant | Version approuvée sans ligne d'approbation |
| `DATA.SUPPORT_BLOCK_REGION_INVALID` | bloquant | Bloc débordant de la grille du gabarit, section D8.2 |
| `DATA.SUPPORT_DUPLICATE_TYPE_KEY` | bloquant | Clé de typologie de support en double |
| `DATA.SUPPORT_FACE_COUNT_MISMATCH` | bloquant | Nombre de faces différent de celui de la typologie |
| `DATA.SUPPORT_TEMPLATE_SIDE_NOT_FOUND` | avertissement | Face de gabarit sans face correspondante dans la typologie |
| `DATA.SUPPORT_TEMPLATE_TYPE_NOT_FOUND` | bloquant | Gabarit d'une typologie inexistant |
| `DATA.SUPPORT_VERSION_REJECT_MOTIF_REQUIRED` | bloquant | Rejet d'une version sans motif, section D9.1 |
| `DATA.SUPPORT_VERSION_TRANSITION_FORBIDDEN` | bloquant | Transition d'état non prévue par la section D9.1 |

DOC

| Code | Gravité | Sens |
| --- | --- | --- |
| `DOC.BINDING_UNKNOWN` | bloquant | Champ lié inconnu dans un texte de livrable |
| `DOC.BINDING_UNRESOLVED` | bloquant | Champ lié non résolu au rendu |
| `DOC.LITERAL_NUMBER` | avertissement | Nombre écrit en littéral dans un livrable, au lieu d'un champ lié |

EDIT

| Code | Gravité | Sens |
| --- | --- | --- |
| `EDIT.COMMAND_SHAPE_INVALID` | bloquant | Commande d'édition mal formée, section E5.1 |
| `EDIT.TABLE_NOT_OWNED` | bloquant | Écriture directe dans une table dont l'atelier n'est pas propriétaire, règle M12.A2 |
| `EDIT.TIMESTAMP_REQUIRED` | bloquant | Commande sans horodatage fourni par l'appelant |
| `EDIT.WRITE_REFUSED` | bloquant | Écriture refusée par le cloisonnement, section A6.1 |

FLOW

| Code | Gravité | Sens |
| --- | --- | --- |
| `FLOW.WEIGHT_INVALID` | bloquant | Pondération de profil négative ou non numérique |

GRAPH

| Code | Gravité | Sens |
| --- | --- | --- |
| `GRAPH.CATEGORY_ALL_VACANT` | avertissement | Catégorie dont toutes les destinations sont vacantes |
| `GRAPH.DESTINATION_DUPLICATE_ON_NODE` | avertissement | Plusieurs destinations sur un même nœud d'accès |
| `GRAPH.DESTINATION_ENTRANCE_COVERAGE` | avertissement | Destination non atteinte depuis toutes les entrées empruntées par un profil |
| `GRAPH.DESTINATION_FOOTPRINT_NOT_FOUND` | bloquant | Empreinte d'une destination inexistante |
| `GRAPH.DESTINATION_LANG_INCOMPLETE` | avertissement | Destination non dénommée dans toutes les langues actives |
| `GRAPH.DESTINATION_NAME_DUPLICATE` | avertissement | Deux destinations de même dénomination |
| `GRAPH.DESTINATION_NAME_MISSING` | avertissement | Destination sans dénomination |
| `GRAPH.DESTINATION_NODE_WRONG_KIND` | avertissement | Nœud d'accès d'un type inattendu, règle M01.S4 |
| `GRAPH.DESTINATION_UNREACHABLE` | bloquant | Destination inatteignable depuis une entrée |
| `GRAPH.DIRECTORY_NAME_EMPTY` | bloquant | Dénomination vide dans l'annuaire |
| `GRAPH.DIRECTORY_NAME_MISSING` | avertissement | Dénomination absente dans une langue active |
| `GRAPH.DIRECTORY_NAME_ORPHAN` | avertissement | Dénomination rattachée à une destination inexistante |
| `GRAPH.NO_ENTRANCE` | bloquant | Site sans aucune entrée |
| `GRAPH.PROFILE_NOT_ACCESSIBLE` | bloquant | Audit d'accessibilité lancé sur un profil non accessible |
| `GRAPH.QUANTITY_CROSS_CHECK_FAILED` | bloquant | Quantitatif ne recoupant pas la nomenclature, écart non nul |
| `GRAPH.QUANTITY_NODE_NOT_FOUND` | avertissement | Support rattaché à un nœud inexistant |
| `GRAPH.RESOLVE_NODE_NOT_FOUND` | bloquant | Nœud inexistant passé à la résolution de contenu |
| `GRAPH.ROUTE_NODE_NOT_FOUND` | bloquant | Nœud inexistant passé au calcul de parcours |
| `GRAPH.ROUTE_UNREACHABLE` | bloquant | Aucun chemin entre les deux nœuds demandés |
| `GRAPH.VERTICAL_LINK_MISALIGNED` | bloquant | Liaison verticale non alignée entre deux niveaux, ascenseurs et escaliers droits seulement, tolérance de la section D1.5 |

IMPORT

| Code | Gravité | Sens |
| --- | --- | --- |
| `IMPORT.EMPTY_FILE` | bloquant | Fichier d'import sans aucune ligne |

LAYOUT

| Code | Gravité | Sens |
| --- | --- | --- |
| `LAYOUT.EVAC_EMPTY_LEVEL` | avertissement | Plan d'évacuation d'un niveau sans contenu |
| `LAYOUT.EVAC_LEVEL_NOT_FOUND` | bloquant | Niveau inexistant passé au plan d'évacuation |
| `LAYOUT.EVAC_NO_EXITS` | avertissement | Plan d'évacuation sans aucune sortie |
| `LAYOUT.EVAC_NO_ROUTES` | avertissement | Plan d'évacuation sans aucun cheminement |
| `LAYOUT.FACT_CONTRADICTED` | bloquant | Texte de livrable contredisant un fait déclaré du site, règle M01.S11 |
| `LAYOUT.FLOOR_PLAN_EMPTY_LEVEL` | avertissement | Plan de niveau sans contenu |
| `LAYOUT.FLOOR_PLAN_LEVEL_NOT_FOUND` | bloquant | Niveau inexistant passé au plan de niveau |
| `LAYOUT.FORBIDDEN_CHARACTER` | bloquant | Caractère interdit par la charte dans un texte de livrable |
| `LAYOUT.ISO_EMPTY_LEVELS` | avertissement | Vue isométrique sans aucun niveau |
| `LAYOUT.ISO_LEVEL_NOT_FOUND` | bloquant | Niveau inexistant passé à la vue isométrique |
| `LAYOUT.MOUNTING_OUT_OF_RANGE` | bloquant | Hauteur d'implantation hors de la plage du paquet de règles |
| `LAYOUT.ORIENTED_PLAN_EMPTY_LEVEL` | avertissement | Plan orienté d'un niveau sans contenu |
| `LAYOUT.ORIENTED_PLAN_LEVEL_NOT_FOUND` | bloquant | Niveau inexistant passé au plan orienté |
| `LAYOUT.SENTENCE_TOO_LONG` | avertissement | Phrase plus longue que la limite portée par la charte |
| `LAYOUT.SOURCE_DISCREPANCY_OPEN` | avertissement | Écart entre deux sources resté ouvert, règle M01.S11 |
| `LAYOUT.STROKE_RATIO_OUT_OF_BOUNDS` | bloquant | Rapport épaisseur de trait sur hauteur hors des bornes du paquet de règles |
| `LAYOUT.TEMPLATE_BINDING_UNSUPPORTED` | bloquant | Liaison de bloc non prévue par le schéma de gabarit, section D8.2 |
| `LAYOUT.TEMPLATE_INVALID` | bloquant | Gabarit non conforme à son schéma, section D8.1 |

PACKAGE

| Code | Gravité | Sens |
| --- | --- | --- |
| `PACKAGE.ABSOLUTE_PATH` | bloquant | Chemin absolu dans un paquet, section D10.1 |
| `PACKAGE.DUPLICATE_ID` | bloquant | Deux artefacts de même identifiant dans un paquet |
| `PACKAGE.DUPLICATE_PATH` | bloquant | Deux fichiers de même chemin dans un paquet |
| `PACKAGE.EMPTY_ARTIFACT` | bloquant | Artefact vide dans un paquet |
| `PACKAGE.FILE_MISSING` | bloquant | Fichier requis absent du paquet de borne, section D10.1 |
| `PACKAGE.INTEGRITY_MISMATCH` | bloquant | Fichier non conforme au manifeste, section D10.4 |

PARK

| Code | Gravité | Sens |
| --- | --- | --- |
| `PARK.CAPACITY_EXCEEDED` | bloquant | Places numérisées au-delà de la capacité déclarée |
| `PARK.CAPACITY_UNEXPLAINED` | bloquant | Écart entre places numérisées et capacité déclarée, sans explication |
| `PARK.PROPOSAL_AS_EXISTING` | bloquant | Objet de statut proposition affiché comme existant, règle M01.S11 |
| `PARK.SOURCE_MISSING` | bloquant | Fait du site sans source déclarée, règle M01.S11 |
| `PARK.UNDIGITIZED_REASON_MISSING` | avertissement | Surface non numérisée dont le motif manque ou est vide. Déclarer des places sans dire pourquoi elles ne sont pas numérisées contredit la règle M01.S11 |

RULES

| Code | Gravité | Sens |
| --- | --- | --- |
| `RULES.FILE_MISSING` | bloquant | Fichier de règles annoncé par le manifeste et introuvable |
| `RULES.FILE_NOT_LISTED` | bloquant | Fichier de règles présent et non listé au manifeste |
| `RULES.INVALID_JSON` | bloquant | Fichier de règles illisible |
| `RULES.OVERLAY_LESS_RESTRICTIVE` | bloquant | Règle pays moins contraignante que le socle, section D3.6 |
| `RULES.OVERLAY_NOT_COMPARABLE` | bloquant | Règle pays non comparable au socle : le durcissement ne peut pas être établi |
| `RULES.VALIDATION_ERROR` | bloquant | Paquet de règles non conforme à son schéma, sections D3.3 et D3.4 |

WAYFIND

| Code | Gravité | Sens |
| --- | --- | --- |
| `WAYFIND.FACE_TEMPLATE_MISSING` | bloquant | Face de typologie sans gabarit |
| `WAYFIND.LINE_MALFORMED` | bloquant | Ligne du tableau des messages incomplète, section H2.5 |
| `WAYFIND.LINE_MISSING` | bloquant | Aucune ligne du tableau des messages pour ce bloc, section H2.5 |
| `WAYFIND.SUPPORT_TYPE_UNKNOWN` | bloquant | Typologie de support inexistante |

Les codes propres aux parties E à Q figurent dans le tableau de chaque partie. L'ensemble de ces tableaux forme le catalogue.

### D2.3 Règle de traduction

Un moteur ne produit jamais de texte destiné à l'affichage. La couche d'interface possède un dictionnaire par code et par langue. Un code sans entrée de dictionnaire fait échouer un test dédié.

---

## D3. Format des paquets de règles

### D3.1 Structure de fichier

Un paquet est un répertoire sous `rules-packs/`, nommé `<juridiction>-<version>`. Il contient un manifeste et un ou plusieurs fichiers de règles au format JSON.

```
rules-packs/
  international-2026.1/
    manifest.json
    legibility.json
    contrast.json
    safety-registry.json
    accessibility.json
    tactile.json
```

### D3.2 Manifeste

```json
{
  "key": "international",
  "version": "2026.1",
  "jurisdiction": "INTL",
  "effectiveFrom": "2026-01-01",
  "supersedes": "international-2025.2",
  "files": ["legibility.json", "contrast.json", "safety-registry.json"],
  "checksum": "sha256:..."
}
```

### D3.3 Règle

```json
{
  "code": "LEGIBILITY.MIN_CHAR_HEIGHT",
  "scope": { "supportRegistry": "wayfinding", "context": "interior" },
  "kind": "formula",
  "params": {
    "expression": "readingDistance_m * factor",
    "factor": 5,
    "unit": "mm",
    "minimum_mm": 20
  },
  "sourceRef": "à renseigner par l'expert normatif",
  "notes": ""
}
```

### D3.4 Règles de chargement

1. Une règle sans `sourceRef` non vide est rejetée. Le paquet entier est refusé, pas seulement la règle.
2. Le contrôle d'intégrité du manifeste est vérifié au chargement.
3. Aucune valeur de repli. Une règle absente lève `RULES.RULE_NOT_FOUND`, elle ne retourne pas une valeur raisonnable.
4. Un paquet vide est valide. Il produit un système qui refuse de composer, ce qui est le comportement correct en l'absence de corpus établi. Voir C4.1 du cahier des charges principal.
5. Les paquets sont en lecture seule pour l'application. Ils sont modifiés par dépôt de fichier et migration, jamais par l'interface.

### D3.5 Résolution de portée

Quand plusieurs règles portent le même code, la plus spécifique gagne. Ordre de spécificité, du plus fort au plus faible : `supportRegistry`, puis `context`, puis `sectorKey`, puis règle sans portée. En cas d'égalité stricte de spécificité, le chargement échoue avec le code `RULES.SCOPE_AMBIGUOUS`.

### D3.6 Surcouche pays

Un site peut être rattaché à un paquet international et à un paquet pays. La règle pays prime, mais **uniquement si elle est plus contraignante**. Une règle pays dont on ne peut pas établir qu'elle durcit le socle est refusée elle aussi : à défaut de preuve, on ne présume pas. Une règle pays moins contraignante que le socle est rejetée au chargement avec un code dédié. C'est l'application du principe : la surcouche durcit, jamais l'inverse.

---

## D4. Formats d'import

### D4.1 Carnet de supports existant

Fichier tableur ou CSV. Encodage UTF-8, séparateur détecté parmi virgule, point-virgule, tabulation. Séparateur décimal accepté en point ou en virgule, choix déclaré en entête d'import.

| Colonne | Obligatoire | Type | Notes |
| --- | --- | --- | --- |
| `reference` | oui | texte | Identifiant du support dans le carnet source |
| `typology` | oui | texte | Doit correspondre à une clé de typologie |
| `building` | oui | texte | Nom de bâtiment |
| `level` | oui | texte | Nom de niveau |
| `node_ref` | non | texte | Nœud de rattachement si connu |
| `x_m`, `y_m` | non | nombre | Position si le nœud n'est pas connu |
| `azimuth_deg` | non | nombre | Convention D1.3 |
| `width_mm`, `height_mm` | non | entier | Bascule `dimensions_source` en `overridden` |
| `reading_distance_m` | non | nombre | |
| `substrate` | non | texte | |
| `condition` | non | énuméré | `good`, `worn`, `damaged`, `missing` |
| `installed_at` | non | date | ISO 8601 |
| `content_fr`, `content_en` | non | texte | Contenu constaté, à titre de comparaison |

Comportement : les lignes valides sont importées, les autres rejetées, un rapport ligne à ligne est produit. Jamais d'import silencieusement tronqué. Une ligne sans `node_ref` ni couple de coordonnées est rejetée avec `IMPORT.ROW_INVALID`.

### D4.2 État locatif

| Colonne | Obligatoire | Type |
| --- | --- | --- |
| `unit_code` | oui | texte |
| `building`, `level` | oui | texte |
| `occupant_name` | non | texte |
| `category_key` | non | texte |
| `occupancy_status` | oui | énuméré |
| `name_fr`, `name_en` | non | texte |
| `effective_from` | non | date |

Un `unit_code` inconnu ne crée pas d'empreinte. Il produit `IMPORT.NODE_NOT_FOUND` et la ligne est mise en attente de rattachement manuel.

### D4.3 Qualification d'un fichier de CAO

Ajout par rapport au cahier des charges principal, qui annonçait un import sans étape de qualification.

Avant toute tentative d'import, le fichier est qualifié et un rapport est produit :

- Proportion de polylignes fermées sur l'ensemble des entités.
- Présence et nommage des calques, taux de calques exploitables.
- Cohérence et déclaration des unités.
- Présence de références externes manquantes.
- Détection d'entités superposées en double.
- Nombre de niveaux présents dans le même fichier.

Le rapport annonce un taux d'extraction attendu. En dessous d'un seuil paramétrable, l'outil recommande explicitement le calage manuel plutôt que l'import, et le dit à l'utilisateur.

Motif : un import qui réussit à moitié sans le dire coûte plus cher qu'un redessin, et dégrade l'indicateur économique central du produit, qui est le temps de mise en service d'un site.

---

## D5. Projection isométrique

### D5.1 Transformation

Projection isométrique classique, angle fixe de 30 degrés.

```
u = (x - y) * cos(30°)
v = (x + y) * sin(30°) - z
```

avec `cos(30°) = 0.8660254037844386` et `sin(30°) = 0.5`, écrits comme constantes nommées et non recalculées.

`u` et `v` sont en unités métier. La mise à l'échelle vers le repère d'affichage et l'inversion de l'axe vertical ont lieu à la sérialisation, conformément à D1.1.

### D5.2 Ordre de tracé

Algorithme du peintre, du plus lointain au plus proche.

Clé de tri, dans cet ordre, croissant :

1. `base_elevation_m` du volume.
2. `min(x) + min(y)` de l'empreinte, calculé sur les sommets.
3. Identifiant du volume, comparaison lexicographique par octets.

Le troisième critère existe uniquement pour garantir le déterminisme. Sans lui, deux volumes de même profondeur pourraient être tracés dans un ordre variable selon l'implémentation du tri.

**Limite documentée :** cet algorithme est correct pour des volumes dont les empreintes ne se recoupent pas. Des empreintes qui se recoupent produisent `GEOM.FOOTPRINTS_OVERLAP` en avertissement, et le rendu peut présenter une occultation incorrecte. Ce cas n'est pas traité dans le noyau. Le résoudre demanderait un découpage des volumes, hors périmètre.

### D5.3 Faces d'un volume

Trois faces sont tracées par volume : dessus, gauche, droite. Les faces arrière ne le sont jamais. Les teintes des trois faces dérivent d'une couleur de base par un facteur d'assombrissement fixe, déclaré dans `design-tokens` et non calculé dans le moteur.

### D5.4 Zones cliquables

Dérivées de la face supérieure projetée de chaque volume, jamais stockées. Une zone cliquable qui existerait en base est un bug.

Ordre de test des zones : inverse de l'ordre de tracé, du plus proche au plus lointain.

### D5.5 Multiniveau

Deux modes :

- `active_level` : niveau actif en pleine opacité, niveaux adjacents estompés par un facteur déclaré en jetons. Mode par défaut sur borne.
- `exploded` : niveaux décalés en escalier, décalage vertical déclaré en jetons. Mode des plans d'ensemble imprimés.

---

## D6. Orientation des plans muraux

### D6.1 Principe

Un plan mural n'est pas un fichier mais une famille de fichiers, un par implantation. Ce qui est devant l'usager est en haut du panneau.

### D6.2 Transformation

Le plan est tourné de `-azimuth_deg` autour du point de position du support, avec la convention d'angle de D1.3 et une rotation d'affichage positive dans le sens horaire.

Effet : un support d'azimut 90, donc regardant vers l'est, produit un plan où l'est est en haut.

### D6.3 Éléments non tournés

Trois éléments restent lisibles horizontalement quelle que soit la rotation, donc ne subissent pas la transformation :

- Les libellés de destinations et la légende.
- La rose des vents, qui tourne sur elle-même pour indiquer le nord réel.
- Le repère de position de l'usager.

### D6.4 Test décisif

Pour chaque support de type plan d'un site de référence, vérifier que la destination située physiquement devant le support apparaît dans la moitié supérieure du rendu. Ce test attrape l'inversion de signe, qui est l'erreur la plus probable et la plus difficile à voir à l'œil.

---

## D7. Empreintes de contenu et invalidation

### D7.1 Ce qui entre dans une empreinte

Deux empreintes distinctes, aux rôles différents.

`inputs_hash`, pour l'invalidation du cache de parcours : identifiants et attributs de tous les nœuds, arêtes et liaisons verticales du site, plus la définition du profil. Ni les destinations, ni les supports, ni les chartes.

Les liaisons entre bâtiments n'y entrent pas, parce qu'aucun calcul de parcours ne lit aujourd'hui leur attribut de passage couvert. **Le jour où un profil en tiendrait compte, elles devraient y entrer**, faute de quoi un changement de passage laisserait des parcours faux en cache.

`content_hash`, pour la détection de péremption d'une exécution : contenu résolu de la face, gabarit, charte et sa version, **les paquets de règles rattachés au site, socle et surcouche, chacun avec sa clé et sa version**, langues actives, dimensions calculées.

Les deux rattachements entrent dans l'empreinte, et non le seul résultat de leur fusion. Sans cela, deux sites partageant un même socle avec des surcouches différentes produiraient la même empreinte, et un changement de surcouche ne marquerait rien comme périmé. Ni l'identifiant du support, ni les horodatages, ni l'auteur.

### D7.2 Règles de calcul

**Ces règles valent pour toutes les empreintes du produit**, sans exception : empreinte de contenu d'une face, empreinte des entrées d'un tableau des messages, empreinte du graphe enregistrée par une validation, empreinte d'un paquet de règles, empreinte d'un manifeste. Une seconde forme canonique, même implicite, en serait une de trop.

Les empreintes déjà enregistrées sous une autre forme ne se convertissent pas : ce sont des valeurs dérivées. Un cache de parcours se recalcule, et un enregistrement de validation dont l'empreinte ne correspond plus au graphe actuel ne vaut plus, ce que la règle M02.W11 prévoit déjà.


- Sérialisation canonique avant hachage : clés triées, aucun espace superflu, nombres au format fixe défini en D1.4.
- **Chaînes normalisées en forme NFC** avant hachage. Deux textes identiques à l'écran mais composés différemment donneraient sinon deux empreintes.
- **Un champ absent est omis, il n'est jamais écrit avec une valeur nulle.** Omission et valeur nulle ne doivent pas se confondre.
- **Un site sans paquet de règles rattaché n'a pas d'empreinte de contenu** : le calcul est refusé, il ne produit pas une empreinte partielle.
- **Une seule implantation.** L'empreinte est calculée par une seule fonction, employée par tous les appelants. Deux implantations équivalentes aujourd'hui divergeront demain, et l'invariant 4 repose sur elles.
- Algorithme SHA-256, en hexadécimal minuscule.
- Aucun horodatage, aucun identifiant de session, aucune donnée d'utilisateur dans une empreinte.

### D7.3 Effet

Un changement de destination modifie le `content_hash` des seules faces qui la mentionnent. Le système sait alors exactement quels supports sont périmés. C'est le mécanisme qui rend possible la promesse d'exploitation, et il ne fonctionne que si la composition des empreintes est stricte.

Test obligatoire : modifier une destination et vérifier que le nombre de faces marquées périmées est exactement celui attendu, ni plus, ni moins.

---

## D8. Langage de gabarit

### D8.1 Principe

Un gabarit est une donnée, pas un composant. Ajouter un gabarit ne demande aucune modification de code.

### D8.2 Schéma

```json
{
  "key": "directional-suspended-2lines",
  "faceCount": 2,
  "grid": { "columns": 12, "margin_mm": 40, "gutter_mm": 20 },
  "blocks": [
    {
      "index": 0,
      "kind": "resolved",
      "binding": { "source": "route", "field": "nextDestinations", "limit": 4 },
      "area": { "col": 1, "colSpan": 9, "row": 1 },
      "style": { "role": "primary", "align": "left" }
    },
    {
      "index": 1,
      "kind": "pictogram",
      "binding": { "source": "destination", "field": "pictogram" },
      "area": { "col": 10, "colSpan": 3, "row": 1 }
    }
  ],
  "sizing": { "mode": "computed", "growAxis": "width" }
}
```

### D8.3 Contraintes

- `kind` est l'un de : `resolved`, `free`, `pictogram`, `map`, `legend`.
- Un bloc `free` est le seul dont le texte est saisi. Tous les autres sont résolus, conformément à l'invariant 2.
- `style.role` référence un rôle de la charte, jamais une couleur directe.
- `sizing.mode` vaut `computed` par défaut. Le format est déduit du contenu.
- Un gabarit dont un bloc déborde de la grille est refusé au chargement.

### D8.4 Preuve

Test obligatoire : ajouter un gabarit uniquement par fichier, sans toucher au code, et vérifier qu'il produit un rendu valide. Si ce test demande une modification de code, le gabarit n'est pas une donnée et l'exigence n'est pas tenue.

---

## D9. Machines à états

Les transitions non listées sont interdites et lèvent une erreur.

### D9.1 Version de support

| De | Vers | Déclencheur | Effet |
| --- | --- | --- | --- |
| `draft` | `in_review` | Émission d'une épreuve | Fige le contenu et l'empreinte |
| `in_review` | `draft` | Rejet | Motif obligatoire |
| `in_review` | `approved` | Approbation | Écrit une ligne d'approbation, insertion seule |
| `approved` | `superseded` | Nouvelle version approuvée | Automatique |
| `draft` | `draft` | Modification | Recalcule l'empreinte |

Une version `approved` n'est jamais modifiable. Une correction crée une nouvelle version.

### D9.2 Travail

| De | Vers | Condition |
| --- | --- | --- |
| `queued` | `running` | Prise en charge |
| `running` | `succeeded` | Fin normale |
| `running` | `failed` | Erreur, tentatives épuisées |
| `running` | `queued` | Erreur, tentatives restantes |
| `queued` | `cancelled` | Annulation utilisateur |

Politique de reprise : 3 tentatives, temporisation exponentielle de 5, 30 puis 120 secondes. Tout travail est idempotent : rejouer un travail réussi ne produit ni doublon, ni artefact supplémentaire. Un travail sans progression pendant 30 minutes est considéré échoué.

### D9.3 Divergence

`detected` vers `resolved` par constatation de pose conforme, ou vers `accepted` par décision explicite tracée. Une divergence ne disparaît jamais sans trace.

### D9.4 Ordre de travaux

`draft` vers `issued` vers `in_progress` vers `done`, ou `cancelled` depuis tout état sauf `done`.

---

## D10. Paquet de borne

### D10.0 Anomalies du rendu

L'assemblage d'un paquet agrège les anomalies de chaque rendu qu'il embarque, et ne lit jamais le seul succès. Une marque de sécurité omise, faute de fonction désignée, **bloque la construction du paquet** au lieu de la traverser en silence, section S-39 : la borne est le dernier endroit où une information de sécurité peut manquer sans que personne le voie.

### D10.1 Arborescence

```
package/
  manifest.json
  index.html
  assets/
    app.js
    app.css
  data/
    graph.json
    directory.json
    scene.json
  maps/
    level-<ordinal>.svg
```

Aucun chemin absolu. Aucune référence à un domaine externe. Aucune police chargée depuis le réseau, les polices sont incorporées.

### D10.2 Manifeste

```json
{
  "siteId": "...",
  "version": 42,
  "builtAt": "2026-09-01T00:00:00Z",
  "contentHash": "sha256:...",
  "files": [{ "path": "assets/app.js", "sha256": "..." }],
  "langs": ["fr", "en"],
  "minRuntime": "1.0.0"
}
```

`builtAt` est le seul champ non déterministe du paquet. Il est exclu du calcul de `contentHash`. C'est la seule exception à l'invariant 4, et elle est explicite.

### D10.3 Configuration locale de borne

Fichier séparé du paquet, jamais recompilé avec lui.

```json
{
  "kioskId": "...",
  "nodeId": "...",
  "azimuthDeg": 142,
  "defaultLang": "fr",
  "buildingId": "..."
}
```

Un seul paquet dessert toutes les bornes d'un site. La borne calcule son propre repère de position et oriente le plan selon D6.

### D10.4 Protocole de mise à jour

1. Au démarrage, la borne charge sa copie locale. Toujours. Le réseau n'intervient jamais dans l'affichage.
2. Si le réseau est disponible, elle demande un fichier de version léger, de quelques octets.
3. Si la version distante diffère, elle télécharge le paquet complet dans un emplacement temporaire.
4. Elle vérifie l'intégrité de chaque fichier contre le manifeste. Un seul écart annule la mise à jour.
5. Bascule atomique. La version précédente est conservée.
6. Si le premier démarrage sur la nouvelle version échoue, retour automatique à la précédente et signalement.

Test décisif : interrompre le téléchargement à mi-parcours, redémarrer la borne, vérifier qu'elle affiche l'ancienne version complète et non un état mixte.

### D10.5 Vérification d'autonomie

Test automatisé obligatoire : servir le paquet, couper tout accès réseau, exécuter le parcours utilisateur complet, et vérifier qu'aucune requête sortante n'a été tentée. Toute tentative lève `PACKAGE.NETWORK_DEPENDENCY`.

---

## D11. Nommage des fichiers produits

Le nommage est déterministe et lisible par un fabricant qui n'a pas accès au logiciel.

```
<code_site>_<batiment>_<niveau>_<typologie>_<code_support>_v<version>_<face>.<ext>
```

Exemple : `CPL_A_R1_DIR_D-042_v3_F1.pdf`

Règles : segments en majuscules, sans accent, sans espace, translittération déterministe des caractères accentués, longueur totale limitée à 120 caractères, troncature par le milieu avec marqueur si dépassement.

Une archive de livraison porte le même schéma sans les segments de support, plus un fichier d'index reprenant le quantitatif.

---

## D12. Internationalisation

### D12.1 Mécanisme

- Deux langues actives : `fr`, `en`. La liste est une donnée de site, pas une constante.
- Aucun texte d'interface écrit dans un composant. Clés uniquement.
- Convention de clé : `domaine.écran.élément`, minuscules, points.
- Un code d'anomalie de D2 possède une entrée par langue. Une entrée manquante fait échouer un test.

### D12.2 Expansion des textes

Le français et l'anglais ne produisent pas des longueurs égales. Règles :

- Le calcul de dimension d'un support se fait sur la variante la plus longue parmi les langues actives, jamais sur la langue primaire.
- Les jeux de test contiennent des dénominations volontairement longues dans chaque langue.
- Un test de non-régression visuelle par langue active, pas un seul dans la langue par défaut.

### D12.3 Ce qui n'est pas préparé

L'écriture de droite à gauche est hors périmètre. Aucun contournement partiel n'est toléré : mieux vaut une absence nette qu'un support à moitié géré. Sa mise en œuvre demandera une reprise du moteur de composition et de tous les gabarits.

---

## D13. Protocole de mesure des performances

Les seuils du cahier des charges principal existent sans méthode de mesure, ce qui les rend invérifiables.

- Machine de référence déclarée, mêmes caractéristiques en local et en intégration continue.
- Chaque mesure porte sur un site de référence nommé, jamais sur un site improvisé.
- 5 exécutions, mesure retenue = médiane. La première exécution est écartée.
- Base amorcée, caches vidés entre chaque exécution, condition déclarée dans le résultat.
- Un dépassement de seuil fait échouer la chaîne d'intégration, il ne produit pas un simple avertissement.
- Les seuils actuels ne reposent sur aucune mesure. Ce sont des cibles, à réviser après le premier site réel modélisé, et la révision doit être tracée.

---

## D14. Tests d'accessibilité concrets

La référence à WCAG ne suffit pas à produire un test. Liste minimale automatisée :

- Contraste calculé sur chaque couple de jetons de texte et de fond, seuil AA, y compris les états de survol et de focus.
- Navigation complète au clavier sur `studio`, ordre de tabulation cohérent, aucun piège de focus.
- Indicateur de focus visible sur tout élément interactif.
- Aucune information portée par la seule couleur, vérifié sur les rendus en niveaux de gris.
- Respect du mode à animation réduite, avec équivalent statique de toute animation.
- Textes alternatifs présents sur tout rendu, décrivant le contenu et non le format.
- Vue en plan simplifié disponible partout où l'isométrie est proposée.

Exigences propres aux bornes, à traiter comme fonctionnelles et non comme du confort, chacune donnant lieu à un critère d'acceptation dans son lot : sortie audio avec prise casque, commandes tactiles physiques repérables au toucher, hauteur de zone d'interaction compatible avec un usage assis, cible tactile minimale, mode contraste renforcé accessible en un geste, temporisation d'inactivité allongée en mode accessible, alternative sonore à toute information portée par la seule couleur.

---

## D15. Sauvegarde, rétention et données personnelles

Absent du cahier des charges principal.

- Sauvegarde quotidienne de la base, conservation 30 jours, restauration testée mensuellement. Une sauvegarde non testée n'existe pas.
- Artefacts produits versionnés en stockage objet, conservation illimitée pour toute version approuvée, purge possible des brouillons après 90 jours.
- Données personnelles présentes dans le produit : comptes utilisateurs et journaux d'approbation. Rien d'autre. La télémétrie de borne n'en contient aucune, contrôle automatisé obligatoire.
- Suppression d'un compte : anonymisation dans le journal d'audit, jamais suppression de la ligne d'audit, qui est en insertion seule.
- Export complet des données d'une organisation en formats ouverts, exigence contractuelle de réversibilité. Testé, pas seulement déclaré.

---

## D16. Politique de dépendances

- Toute dépendance nouvelle passe par la procédure d'arrêt et de demande.
- Versions figées, fichier de verrouillage committé, installation en mode strict.
- Analyse de vulnérabilités à chaque intégration. Une vulnérabilité critique bloque la fusion.
- Aucune dépendance non maintenue depuis plus de 18 mois sans justification écrite.
- Toute dépendance touchant au rendu ou au calcul géométrique est examinée sous l'angle du déterminisme avant adoption.

---

## D17. Mise en route développeur

Le dépôt doit permettre à quelqu'un d'arriver et de travailler sans transmission orale.

Commandes attendues, dont l'existence est vérifiée par la chaîne d'intégration :

```
pnpm install
pnpm db:reset
pnpm seed:ref            charge les sites de référence
pnpm dev                 studio en développement
pnpm dev:kiosk           runtime de borne
pnpm worker              service de compilation
pnpm typecheck
pnpm lint
pnpm test
pnpm test:visual
pnpm test:rls
pnpm test:determinism
pnpm test:e2e
```

Un fichier d'exemple de variables d'environnement, sans aucune valeur réelle, accompagne le dépôt.

---

## D18. Ce que ce complément ne couvre toujours pas

Historique. Cette liste ne fait plus foi. Les points encore ouverts sont repris dans le registre de la partie K, section K3, seule liste à tenir.

Écrit pour que personne ne le découvre plus tard.

1. **Le contenu réel des paquets de règles.** D3 en donne le contenant, pas le contenu. Aucune valeur normative n'est écrite ici, et aucune ne doit l'être avant l'étude d'expert. Le champ `sourceRef` de l'exemple D3.3 porte volontairement une mention d'attente.
2. **Le facteur de lisibilité de l'exemple D3.3.** La valeur 5 est un exemple de forme, pas une valeur normative validée. Elle ne doit pas être reprise.
3. **Le comportement du tri des occultations sur empreintes recoupées.** Documenté comme limite en D5.2, non résolu.
4. **Le déterminisme strict de la sortie PDF.** Dépend de la bibliothèque, tranché en T-0.9, non acquis.
5. **La transcription braille.** Le transcripteur est enfichable, aucune table n'est écrite.
6. **Les seuils de performance.** Cibles sans mesure, voir D13.
7. **La tolérance d'accrochage à la saisie.** D1.5 donne des tolérances géométriques, pas l'ergonomie d'accrochage, qui demande un essai sur usagers réels.
8. **Le format d'échange des bornes.** Aucun matériel arrêté, le produit publie un profil de conformité au lieu de cibler un lecteur.

---

# PARTIE E. Édition, capacités vectorielles et habillage

Cette partie complète le cahier des charges principal et la partie D.

Elle répond à une demande simple à énoncer et dangereuse à mettre en œuvre : disposer des capacités d'un éditeur vectoriel professionnel, en mieux et en plus simple.

---

## E0. Le cadrage, avant les fonctionnalités

### E0.1 La contradiction à lever

« Les mêmes fonctionnalités qu'un éditeur vectoriel » contredit frontalement l'invariant 2 : un panneau est une vue, pas un dessin.

Un éditeur vectoriel permet de placer n'importe quoi n'importe où. C'est exactement ce qu'Azimut doit refuser sur les faces de supports, et ce refus est toute sa valeur. Si un concepteur peut déplacer librement un texte sur une face, le contenu n'est plus dérivé du tableau des messages, la régénération après changement d'enseigne cesse de fonctionner, la couche de divergence perd son objet, et la promesse d'abonnement s'effondre. Le produit serait alors un éditeur vectoriel de plus, en moins complet, avec deux ans de retard.

### E0.2 La réponse

L'édition libre n'est pas interdite. Elle est **cantonnée**, et la ligne de partage est le sujet principal de cette partie.

Trois contextes d'édition coexistent, avec des règles opposées. Les confondre est la faute la plus coûteuse que ce document cherche à prévenir.

### E0.3 En quoi le produit est meilleur, concrètement

Un éditeur vectoriel généraliste ignore ce qu'est un mur, une cellule, une circulation, une distance de lecture et une norme. Les avantages d'Azimut sont donc réels et vérifiables, mais ils ne portent pas sur la richesse de l'outillage de dessin :

1. **Le contenu ne peut pas mentir.** Une destination fermée disparaît de tous les plans. Un éditeur vectoriel laisse un plan afficher une boutique partie depuis six mois.
2. **Les dimensions sont calculées, pas dessinées.** La hauteur de caractère découle de la distance de lecture et d'une règle référencée. Un éditeur vectoriel laisse composer un panneau illisible sans rien signaler.
3. **La régénération est massive.** Vingt plans muraux se refont en une compilation, chacun orienté selon son implantation. Un éditeur vectoriel impose vingt fichiers et vingt retouches.
4. **Le registre de sécurité est verrouillé.** Aucune charte ne peut altérer un pictogramme normalisé. Un éditeur vectoriel n'a aucune notion de ce cloisonnement.
5. **Les zones cliquables sont dérivées.** Un changement d'occupant ne demande aucun redécoupage.
6. **Les contrôles sont permanents.** Contraste, lexique, adjacence chromatique, atteignabilité, vérifiés à chaque modification et non à la relecture finale.

Ces six points sont opposables commercialement. « Nous faisons tout ce que fait un éditeur vectoriel » ne l'est pas, et serait faux.

---

## E1. Les trois contextes d'édition

### E1.1 Contexte 1, géométrie et habillage du site

Édition libre et complète. C'est ici que l'outillage vectoriel doit être meilleur que celui d'un généraliste, parce qu'il connaît le métier.

Objets concernés : empreintes, volumes, ouvertures, nœuds, arêtes, liaisons, formes d'habillage, annotations, actifs importés, composition de page.

### E1.2 Contexte 2, gabarits

Édition visuelle autorisée, mais elle produit une donnée de gabarit conforme à la section D8, jamais un dessin.

Règle : **on dessine le modèle, jamais l'instance**. Modifier un gabarit se répercute sur toutes les faces qui l'utilisent. L'écran d'édition de gabarit affiche donc en permanence le nombre de faces impactées.

### E1.3 Contexte 3, faces de supports

Aucune édition libre. Le contenu est résolu depuis le tableau des messages, lui-même généré depuis le graphe et l'annuaire. Le concepteur voit, contrôle et valide. Il ne déplace pas.

Trois libertés seulement : choisir le gabarit, saisir le contenu des blocs explicitement typés `free`, et déclarer une dérogation de format, laquelle bascule `dimensions_source` en `overridden` et déclenche un contrôle bloquant si le format devient non conforme.

### E1.4 Tableau de partage

| Opération | Contexte 1 | Contexte 2 | Contexte 3 |
| --- | --- | --- | --- |
| Dessiner une forme | oui | non | non |
| Déplacer un objet | oui | blocs du gabarit | non |
| Redimensionner | oui | zones du gabarit | non |
| Saisir du texte libre | oui | non | blocs `free` seulement |
| Choisir une couleur | rôles de charte | rôles de charte | non |
| Ajouter une image | oui | non | non |
| Modifier le contenu résolu | sans objet | non | non |

Toute demande d'assouplissement de la colonne « contexte 3 » relève de la procédure d'arrêt et de demande. Elle n'est jamais tranchée dans une tâche.

---

## E2. Corrections d'affirmations erronées

Consignées ici parce qu'elles ont déjà été formulées et qu'elles se reformuleront.

**E2.1.** Il a été affirmé que le cahier des charges interdit les dépendances à une plateforme d'hébergement mais pas les bibliothèques ouvertes, et qu'une bibliothèque de dessin, de diagramme ou de gestion d'état globale serait donc recevable.

C'est faux. La section A3.3 interdit explicitement toute bibliothèque de dessin ou de diagramme, toute bibliothèque de gestion d'état globale, toute bibliothèque de composants d'interface prête à l'emploi, et toute bibliothèque de calcul géométrique tant que le besoin n'est pas démontré par un test. La section A3.4 traite d'un sujet différent, la réversibilité d'hébergement.

**E2.2.** Le motif de cette interdiction n'est pas idéologique. Une bibliothèque de dessin tierce apporte son propre modèle de scène, son propre ordonnancement et ses propres arrondis. Elle rend l'invariant 4 sur le déterminisme invérifiable, parce que son comportement change entre deux versions mineures.

**E2.3.** La gestion d'état de l'application d'édition est écrite dans le dépôt, avec le motif de commande de la section E5. Elle n'est pas déléguée à une bibliothèque.

**E2.4.** Une bibliothèque de gestes de pointage peut être proposée, mais elle passe par la procédure d'arrêt et de demande, et ne touche jamais au calcul de coordonnées métier.

**E2.5.** Ce type de reformulation d'une règle gênante dans un sens permissif est précisément ce que la procédure d'arrêt et de demande sert à empêcher. Une règle qui gêne se signale, elle ne se réinterprète pas.

---

## E3. Modèle de vue

### E3.1 Deux repères, une seule transformation

Le repère métier est défini en D1.1 : mètres, X vers l'est, Y vers le nord, axe vertical d'affichage inversé à la sérialisation seulement.

Le repère de vue est en pixels, origine en haut à gauche, axe vertical vers le bas.

Une transformation unique, exportée par un module dédié, convertit dans les deux sens. **Aucun composant d'interface ne calcule sa propre conversion.** C'est la règle la plus facile à enfreindre et la plus coûteuse à corriger plus tard.

### E3.2 État de vue

```
{ centerX_m, centerY_m, scale_px_per_m, rotationDeg }
```

`rotationDeg` sert exclusivement à l'aperçu d'un plan orienté selon la section D6. Il ne modifie jamais les données.

### E3.3 Contraintes

- Échelle bornée, de 0,05 à 500 pixels par mètre. Hors bornes, l'outil refuse au lieu de dégénérer.
- Le facteur de zoom par cran est une constante nommée, pas une valeur dispersée.
- Le déplacement de vue ne modifie aucune donnée et n'entre jamais dans l'historique d'annulation.
- La position de vue est mémorisée par niveau et par utilisateur, hors du modèle métier.

### E3.4 Technologie de rendu

Rendu en SVG dans le document, chaque objet étant un élément du document, ce qui donne la détection de clic et l'accessibilité sans code spécifique.

Bascule vers un rendu en mode point selon le budget de rendu mesuré à l'exécution, section G2, avec conservation de la détection de clic par calcul géométrique. Aucun seuil fixe en nombre d'objets.

---

## E4. Déterminisme des opérations d'édition

Un glisser-déposer produit des coordonnées à décimales illimitées. Sans règle, l'invariant 4 tombe dès le premier déplacement à la souris.

### E4.1 Quantification

- Toute opération d'édition quantifie ses coordonnées **à la validation de l'opération**, jamais pendant le geste.
- Pas de quantification pendant le geste : elle rend le déplacement saccadé et fausse le retour visuel.
- Pas au moment du rendu : la donnée serait alors différente de ce qui est affiché.
- Pas de quantification implicite lors d'une lecture ultérieure.

### E4.2 Pas de quantification

Le pas est de 0,001 m, soit le millimètre, cohérent avec la précision de sérialisation de D1.4. Il est constant et n'est pas fonction du niveau de zoom, sans quoi une même opération donnerait deux résultats selon l'échelle d'affichage au moment du geste.

### E4.3 Angles

Toute rotation quantifie à 0,01 degré, dans la convention compas de D1.3, avec normalisation dans [0, 360[.

### E4.4 Test obligatoire

Rejouer une séquence enregistrée d'opérations d'édition sur un site de référence, deux fois, et vérifier l'égalité stricte de l'état final et des empreintes de rendu.

---

## E5. Modèle de commande, annulation et hors ligne

### E5.1 Commande

Toute modification de donnée passe par une commande, objet sérialisable comportant : un type, une cible, les valeurs avant et après, et un horodatage fourni par l'appelant, jamais lu par la commande elle-même, conformément à l'interdiction de lire l'horloge dans un moteur.

Une commande est réversible. Une commande non réversible est refusée en revue.

### E5.2 Pile d'annulation

- Portée : le site en cours d'édition, par utilisateur.
- Regroupement des commandes d'un même geste continu en une seule entrée annulable.
- Profondeur : 200 entrées, constante nommée.
- Le déplacement de vue, le changement de sélection et le changement de niveau actif n'y entrent pas.

### E5.3 Articulation avec le travail hors ligne

C'est le point le plus délicat de cette partie, et celui qui dépassera sa charge s'il est traité tard.

Le lot 4.4 pose une concurrence optimiste au niveau de l'objet. Combiner un historique local et une fusion par objet crée un cas ingérable si l'on n'y prend garde : annuler localement une opération déjà fusionnée avec la version distante.

Règles retenues :

1. La pile d'annulation est **vidée à la synchronisation**. Ce qui est synchronisé n'est plus annulable localement.
2. Revenir sur une modification déjà synchronisée se fait par une nouvelle commande inverse, tracée, et non par une annulation.
3. La journalisation des commandes hors ligne est conservée pour l'arbitrage des conflits, avec présentation des deux versions à l'utilisateur.
4. La validation de complétude du graphe est rejouée après chaque synchronisation et bloque la publication en cas d'échec.

### E5.4 Sauvegarde automatique

Sauvegarde locale à chaque commande validée, en stockage local du navigateur, distincte de la synchronisation serveur. Reprise proposée à la réouverture après incident, avec choix explicite de l'utilisateur entre l'état local et l'état serveur. Aucune fusion silencieuse.

---

## E6. Sélection et accessibilité

L'accessibilité d'un éditeur graphique se décide dans le modèle de sélection. Ajoutée après, elle n'existe jamais.

### E6.1 Modèle

- Sélection simple, multiple, additive, par rectangle de capture, par catégorie d'objets.
- La sélection est un état d'interface, jamais une donnée persistée.
- L'ordre de la sélection est stable et déterministe : ordre de tracé, départagé par identifiant.

### E6.2 Pilotage au clavier, obligatoire

Toute opération réalisable au pointeur l'est au clavier. Sans exception, y compris le dessin.

- Parcours des objets d'un calque par tabulation, dans l'ordre stable ci-dessus.
- Déplacement de l'objet sélectionné par touches directionnelles, pas de 0,01 m, pas augmenté avec la touche de modification.
- Saisie numérique directe des coordonnées, des dimensions et de l'angle de l'objet sélectionné. C'est aussi le moyen le plus précis pour tout le monde, pas seulement une mesure d'accessibilité.
- Création d'une forme par saisie de ses dimensions, sans geste de pointage.

### E6.3 Restitution

- Chaque objet expose un nom accessible construit depuis ses données métier, jamais depuis sa forme.
- Les changements de sélection et le résultat des opérations sont annoncés.
- L'indicateur de focus est visible et distinct de l'indicateur de sélection.
- Aucune information portée par la seule couleur, vérifié sur un rendu en niveaux de gris.

---

## E7. Outillage de géométrie, contexte 1

### E7.1 Outils de base

Sélection, sélection directe de sommet, main, zoom, rectangle, ellipse, polygone régulier, polyligne, courbe de Bézier, texte, cotation, mesure.

### E7.2 Outils métier, l'apport réel

Ces outils n'existent pas dans un éditeur généraliste et justifient l'effort :

- **Tracé de cellule** : polygone contraint aux angles droits par défaut, avec libération explicite.
- **Décalage parallèle** : générer une cloison d'épaisseur donnée à partir d'un axe.
- **Division de cellule** : scinder une empreinte en deux, en conservant les attributs et en attribuant un nouveau code.
- **Fusion de cellules** : opération inverse, avec arbitrage explicite des attributs conservés.
- **Tracé d'axe de circulation** : produit directement des nœuds et des arêtes, pas une simple ligne.
- **Placement de nœud typé** : le type est choisi avant le geste, pas après.
- **Duplication en série** : répartir n cellules identiques le long d'un axe, cas des galeries à trame régulière.
- **Report de niveau** : copier les circulations et les noyaux verticaux d'un niveau à l'autre, ce qui est le geste le plus fréquent sur un bâtiment à plusieurs étages.

### E7.3 Opérations d'ensemble

Alignement, répartition, groupement, verrouillage, calques, ordre de superposition, copier-coller y compris entre niveaux et entre sites de la même organisation.

Le copier-coller entre organisations est interdit et fait échouer l'opération avec un code dédié.

### E7.4 Opérations booléennes

Union, soustraction, intersection sur les empreintes. Le résultat est validé par les mêmes contrôles que la saisie : polygone simple, fermé, non auto-intersectant, surface au-dessus de la tolérance. Un résultat invalide annule l'opération au lieu de produire une géométrie dégénérée.

---

## E8. Magnétisme et contraintes

### E8.1 Cibles

Sommets, milieux de segments, intersections, centres, grille, guides, alignements sur objets voisins.

### E8.2 Règles

- Le magnétisme s'exprime en pixels écran, la tolérance est donc constante à l'affichage et non en unité métier.
- Tolérance par défaut de 8 pixels, constante nommée, réglable par l'utilisateur.
- Priorité déterministe entre cibles concurrentes : sommet, puis intersection, puis milieu, puis guide, puis grille. Départage final par identifiant de l'objet cible.
- Désactivation temporaire par touche de modification.
- Contraintes de tracé : orthogonal, angles multiples d'une valeur réglable, conservation des proportions.

Le magnétisme n'introduit aucun indéterminisme : à état de vue identique et geste identique, la cible retenue est identique.

---

## E9. Couche d'habillage

### E9.1 Le besoin

Les directories réels contiennent des éléments qui n'appartiennent à aucun modèle métier et sans lesquels le plan ne ressemble à rien : alignements d'arbres, jardins nommés, massifs, voies et voies ferrées hors périmètre, passerelles, bâtiments voisins, logos d'enseignes majeures, annotations reliées par un filet de rappel, bloc de titre, légende, rose des vents.

Le cahier des charges principal ne les prévoyait pas. Sans eux, le produit ne peut pas remplacer l'outil actuel.

### E9.2 Principe de séparation

La couche d'habillage est **strictement séparée** de la couche métier. Elle ne participe à aucun calcul : ni parcours, ni couverture, ni quantitatif, ni zone cliquable. Elle est purement graphique.

Un objet d'habillage ne peut jamais porter d'attribut métier. S'il en a besoin, c'est qu'il relève de la couche métier.

### E9.3 Ajouts au modèle de données

```sql
decoration_layer   (id, org_id, site_id, level_id, name, z_order int, visible boolean,
                    print_visible boolean, locked boolean)

decoration_shape   (id, org_id, layer_id, kind, geometry jsonb,
                    style_role, label, rotation_deg numeric)
                   kind in ('area','path','symbol','group')

annotation         (id, org_id, level_id, anchor jsonb, leader jsonb,
                    text jsonb, style_role)
                   text = { fr, en }

imported_asset     (id, org_id, site_id, kind, storage_path, sanitized boolean,
                    original_name, checksum, imported_at)
                   kind in ('logo','symbol','background')

layout_composition (id, org_id, site_id, level_id, target,
                    page_format, elements jsonb, updated_at)
                   target in ('print','kiosk','web')
```

`layout_composition` porte la mise en page : position du bloc de titre, de la légende, de la rose des vites, des marges. C'est ce qui reste composé à la main une fois, puis rarement retouché.

### E9.4 Légende

La légende n'est pas un objet dessiné. Elle est **générée** depuis les catégories réellement présentes sur le niveau, et sa position seule est composée. C'est ce qui garantit qu'elle ne peut pas devenir fausse, à la différence d'un fichier graphique classique.

Même règle pour la rose des vents, qui est orientée depuis les données et non dessinée.

### E9.5 Bibliothèque de symboles

Symboles d'habillage fournis et éditables : arbres, massifs, mobilier, véhicules, silhouettes. Ils sont des données, pas du code, et suivent les règles de la section D8 sur les gabarits.

Ils ne se confondent jamais avec les pictogrammes du registre de sécurité, qui restent en lecture seule.

---

## E10. Édition de gabarit, contexte 2

- L'écran d'édition manipule la grille, les zones, les liaisons de blocs et les rôles de style. Il ne manipule pas de contenu réel.
- Aperçu permanent avec des données d'exemple, dont un jeu volontairement long dans les deux langues actives, pour éprouver le débordement.
- Le nombre de faces impactées par la modification est affiché en permanence, avec accès à la liste.
- Sauvegarde d'un gabarit dont un bloc déborde de la grille refusée, avec le code prévu.
- Un rôle de style ne référence jamais une couleur directe, uniquement un rôle de charte.

Preuve exigée par D8.4 : ajouter un gabarit sans toucher au code. Si l'éditeur de gabarit demande une modification de code pour un gabarit nouveau, l'exigence n'est pas tenue.

---

## E11. Face de support, contexte 3

Écran de contrôle, pas d'édition.

**Autorisé :** choisir le gabarit, saisir le contenu des blocs `free`, choisir les langues affichées, déclarer une dérogation de format, demander une régénération, émettre une épreuve.

**Interdit, et refusé par l'interface autant que par le moteur :** déplacer un bloc, redimensionner un bloc, modifier une couleur, ajouter un objet graphique, modifier un contenu résolu, contourner un contrôle bloquant.

Un contrôle bloquant empêche l'émission d'une épreuve. Il ne peut être ni ignoré, ni marqué comme accepté. La seule issue est de corriger la donnée source ou le gabarit.

---

## E12. Typographie

Absent du cahier des charges principal, alors que c'est ce qui fait la lisibilité d'un panneau.

- Polices incorporées, jamais chargées depuis le réseau, y compris dans le paquet de borne.
- Mesure de texte déterministe, à partir des métriques de la police et non d'une mesure faite par le navigateur, qui varie selon le moteur de rendu et le système. C'est une condition de l'invariant 4.
- Attributs gérés : corps, graisse, interlettrage, approche de paire, interligne, casse, alignement.
- Césure désactivée par défaut sur les supports. Une destination coupée en fin de ligne est illisible de loin.
- Détection de débordement calculée, jamais visuelle, avec le code prévu.
- Le calcul de dimension se fait sur la variante linguistique la plus longue parmi les langues actives, conformément à D12.2.
- Les polices de la charte sont validées à l'import : présence des jeux de caractères latins nécessaires au français et à l'anglais, accents compris, et licence d'incorporation déclarée par l'organisation.

---

## E13. Couleur et gestion colorimétrique

- Les chartes s'expriment en références Pantone ou RAL, l'écran affiche en rouge vert bleu, la fabrication travaille en quadrichromie ou en teinte directe.
- Une couleur de charte porte sa référence d'origine, sa valeur d'affichage et son profil de sortie. La référence d'origine fait foi pour le fabricant.
- Aucune conversion automatique n'est présentée comme exacte. L'écran est un aperçu, et l'interface le dit.
- Profils de sortie par substrat, conformément au cahier des charges principal.
- Le calcul de contraste se fait sur les valeurs d'affichage, avec la formule de luminance relative, et le résultat est mesuré, jamais estimé.
- Les couleurs du registre de sécurité ne sont jamais converties ni approchées. Elles proviennent du paquet de règles et sont utilisées telles quelles.

---

## E14. Import d'actifs clients

Les chartes arrivent en fichiers d'éditeur vectoriel propriétaire, en encapsulé PostScript ou en SVG. C'est un besoin quotidien et un vecteur d'attaque.

### E14.1 Formats

SVG accepté. Les formats propriétaires et encapsulés sont convertis par un outil serveur isolé, jamais interprétés côté navigateur.

### E14.2 Assainissement obligatoire

Avant tout stockage :

- Suppression de tout script, de tout événement, de toute référence externe, de toute entité externe.
- Suppression des métadonnées, y compris les mentions d'outil et les informations d'auteur.
- Refus des fichiers dépassant une taille ou une complexité déclarées.
- Vectorisation conservée, aucune image en mode point acceptée dans un logo.
- Un actif non assaini n'est jamais rendu. Le champ `sanitized` fait foi.

### E14.3 Traitement

Recadrage sur le contenu, normalisation de l'échelle, contrôle de la largeur minimale imposée par la charte, contrôle du contraste sur les fonds autorisés.

---

## E15. Performance

Le plan initial supposait quelques centaines d'objets. Un site réel à plusieurs bâtiments et plusieurs niveaux en compte plusieurs milliers, habillage compris.

Budget, mesuré selon le protocole de D13 :

| Grandeur | Cible |
| --- | --- |
| Bascule entre rendu par éléments du document et rendu en mode point | selon le budget de rendu mesuré, section G2 |
| Rafraîchissement pendant un geste | 60 images par seconde |
| Latence de détection de clic | inférieure à 16 millisecondes |
| Ouverture d'un niveau de 2 000 objets | inférieure à 2 secondes |
| Application d'une commande et de son annulation | inférieure à 50 millisecondes |

Un dépassement fait échouer la chaîne d'intégration. Ces valeurs sont des cibles, à réviser après le premier site réel, avec traçabilité de la révision.

---

## E16. Raccourcis clavier

- Table de raccourcis unique, déclarée en donnée, jamais dispersée dans les composants.
- Détection automatisée des conflits, y compris avec les raccourcis réservés du navigateur et du système.
- Aucun raccourci à touche unique destructeur sans confirmation.
- Table exportable et affichable, personnalisable en incrément ultérieur.
- Compatibilité vérifiée avec les dispositions de clavier français et anglais, qui ne placent pas les mêmes caractères aux mêmes touches. C'est une source classique de raccourcis inatteignables.

---

## E17. Ajouts au catalogue des codes d'anomalie

À ajouter au catalogue de la section D2.2, dans le même commit que leur première utilisation.

| Code | Gravité | Sens |
| --- | --- | --- |
| `EDIT.CONTEXT_VIOLATION` | bloquant | Opération interdite dans ce contexte d'édition |
| `EDIT.BOOLEAN_RESULT_INVALID` | bloquant | Opération booléenne produisant une géométrie invalide |
| `EDIT.CROSS_ORG_PASTE_DENIED` | bloquant | Collage entre organisations refusé |
| `EDIT.UNDO_AFTER_SYNC` | avertissement | Annulation demandée sur une modification déjà synchronisée |
| `EDIT.TEMPLATE_BLOCK_OVERFLOW` | bloquant | Bloc débordant de la grille du gabarit |
| `ASSET.SANITIZATION_FAILED` | bloquant | Actif importé non assainissable |
| `ASSET.RASTER_IN_LOGO` | bloquant | Image en mode point dans un logo |
| `ASSET.FONT_MISSING_GLYPHS` | bloquant | Police sans les caractères requis |
| `TYPO.TEXT_OVERFLOW` | bloquant | Débordement de texte calculé |
| `COLOR.PROFILE_MISSING` | avertissement | Profil de sortie absent pour ce substrat |

---

## E18. Rattachement aux tâches existantes

Cette partie ne crée pas de feuille de route parallèle. Elle s'insère dans le découpage existant.

| Élément | Rattachement |
| --- | --- |
| Modèle de vue, transformation, sélection, accessibilité | T-1.2, étendue |
| Quantification et déterminisme des opérations | T-1.2, critère d'acceptation ajouté |
| Motif de commande et annulation | nouvelle tâche T-1.2b, préalable à T-1.4 |
| Outillage de géométrie de base | T-1.2, étendue |
| Outils métier de E7.2 | nouvelle tâche T-1.2c |
| Magnétisme et contraintes | nouvelle tâche T-1.2d |
| Tracé d'axe produisant nœuds et arêtes | T-1.4, étendue |
| Report de niveau | T-1.5, étendue |
| Couche d'habillage et composition | nouvelles tâches T-2.17 à T-2.19 |
| Import et assainissement d'actifs | nouvelle tâche T-2.20 |
| Éditeur de gabarit | T-2.2, étendue |
| Écran de contrôle de face | T-2.15, étendue |
| Typographie et mesure déterministe | T-2.4 et T-2.15, critères ajoutés |
| Gestion colorimétrique | T-2.12, étendue |
| Articulation annulation et hors ligne | L4.4, contrainte ajoutée |
| Budget de performance | D13, mesuré dès T-1.2 |

Conséquence de charge à assumer : l'incrément 1 s'allonge, parce que l'éditeur devient un vrai éditeur et non un formulaire de saisie. L'incrément 2 s'allonge également du fait de la couche d'habillage, qui n'était pas prévue. Ces allongements ne sont pas chiffrés ici, faute de décomposition en lots de travail.

---

## E19. Ce que cette partie ne couvre pas

Historique. Cette liste ne fait plus foi. Les points encore ouverts sont repris dans le registre de la partie K, section K3, seule liste à tenir.

1. **Le chiffrage.** L'allongement des incréments 1 et 2 est certain, son ampleur n'est pas estimée.
2. **Le seuil de bascule de rendu.** La valeur de 3 000 objets est une hypothèse à mesurer, pas un résultat.
3. **La saisie tactile et au stylet.** Non traitée. Elle change le modèle de sélection et de magnétisme, et devra faire l'objet d'une décision avant l'incrément 5.
4. **L'édition simultanée à plusieurs sur un même niveau.** Hors périmètre. Le hors ligne du lot 4.4 traite la synchronisation différée, pas la présence simultanée.
5. **Les métriques de police et la licence d'incorporation.** Les règles sont posées, la vérification effective de licence reste une responsabilité de l'organisation cliente.
6. **La conversion colorimétrique exacte.** Aucun rendu écran ne peut garantir une teinte directe. Le produit affiche un aperçu et l'annonce.
7. **La reprise des fichiers existants des clients.** Un client arrivant avec vingt ans de fichiers d'éditeur vectoriel ne les convertira pas en modèle Azimut. Aucune voie de reprise n'est prévue et il ne faut pas en promettre.

---

# PARTIE F. Interface, design système et front

Cette partie complète le cahier des charges principal et les parties D et E.

---

## F0. Objet et ce qui est déjà décidé

Ce document définit l'interface : jetons, mise en page, composants, états, écriture, mouvement, structure du code front.

Décisions antérieures, non rediscutées ici et rappelées pour mémoire : palette Papier en thème par défaut, thème sombre Instrument en incrément 4, quatre couleurs réservées à usage sémantique exclusif, accent réservé aux valeurs produites par un moteur, zone de travail toujours en fond clair quel que soit le thème.

---

## F1. Le brief

### F1.1 En une phrase

Un outil professionnel de conception, utilisé plusieurs heures par jour par un opérateur expert, qui produit des documents destinés à être fabriqués, et qui affiche en permanence des couleurs, des typographies et des pictogrammes appartenant à ses clients.

### F1.2 Les cinq principes

**1. Silence chromatique.** L'interface ne doit rien ajouter à ce qu'elle montre. Toute couleur qu'elle emploie pour elle-même entre en concurrence avec le contenu qu'elle sert à juger. C'est la contrainte fondatrice et elle est propre à ce produit.

**2. Une seule audace, la zone de travail.** Le plan est le sujet. Tout le reste est discipliné, plat, calme. Aucun ornement autour du canevas.

**3. La structure porte de l'information.** Un filet, un cadre, une pastille colorée signifient quelque chose. Rien n'est décoratif. Une couleur réservée qui apparaîtrait par agrément détruit la valeur d'alerte des trois autres.

**4. Densité assumée.** Le public est expert et travaille sur de grandes surfaces d'affichage. L'espacement généreux d'un site vitrine est ici un défaut : il oblige à faire défiler, donc à perdre le contexte.

**5. L'accent ne dit qu'une chose.** Ce que le logiciel a calculé. Ce que l'utilisateur a saisi reste neutre. Le concepteur distingue ainsi d'un coup d'œil ce qu'il a décidé de ce qui lui est proposé.

### F1.3 Ce que l'interface ne fait pas

- Elle n'emploie jamais la charte d'un client, même du client à qui l'on montre l'écran. Le brand book d'un site est du contenu, jamais de l'habillage d'interface.
- Elle n'utilise pas d'aplats colorés larges, qui fausseraient la perception des couleurs voisines.
- Elle n'emploie ni ombre portée, ni dégradé, ni carte arrondie répétée. Ces dispositifs ajoutent du bruit visuel autour d'un contenu dont les valeurs comptent.
- Elle n'anime rien qui ne réponde pas à une action.

---

## F2. Jetons de couleur

### F2.1 Thème Papier, par défaut

```
surface-page        #FBFAF8
surface-panel       #FFFFFF
surface-canvas      #F7F5F1
surface-sunken      #F2EEE8
border-hairline     #E3DFD8
border-strong       #CFC8BC
border-interactive  #8E867C
text-primary        #1C1F24
text-secondary      #5A606B
text-muted          #656B75
accent              #17457A
accent-soft         #EDF2F8
accent-secondary    #26695C
```

`surface-canvas` est plus sombre que `surface-panel`. C'est la correction issue de la maquette : la hiérarchie se rétablit en descendant la zone de travail d'un demi-ton, jamais en blanchissant les panneaux, sous peine d'éclaircir le fond sur lequel les supports sont jugés.

### F2.2 Couleurs réservées

```
state-blocking      #B32F26
state-warning       #96560A
state-valid         #2A7047
state-info          #2B6CB0
```

Usage sémantique exclusif. Interdiction d'emploi décoratif, sans exception. Un test d'analyse statique cherche ces valeurs hors des composants d'état.

### F2.3 Contrastes mesurés

Les valeurs ci-dessus ne sont plus estimées. Elles sont calculées, sur les cinq fonds susceptibles de porter du texte, le plus sombre étant `surface-sunken`.

| Jeton | Ratio minimal sur fond | Blanc posé dessus |
| --- | --- | --- |
| `text-primary` | 14,30 | 16,52 |
| `text-secondary` | 5,47 | 6,32 |
| `text-muted` | 4,64 | 5,37 |
| `accent` | 8,38 | 9,68 |
| `accent-secondary` | 5,58 | 6,45 |
| `state-blocking` | 5,42 | 6,27 |
| `state-warning` | 5,00 | 5,78 |
| `state-valid` | 5,18 | 5,99 |
| `state-info` | 4,69 | 5,42 |

Tous les couples passent le seuil AA de 4,5.

Cinq valeurs proposées initialement échouaient et ont été corrigées : le gris estompé descendait à 2,25, l'ambre à 2,85, et le blanc posé sur l'ambre à 3,30. Conformément à la règle posée, ce sont les jetons qui ont changé, jamais le seuil.

### F2.4 Filets et seuil de 3,0

Le seuil de 3,0 applicable aux limites de composants ne concerne que les bordures nécessaires à identifier un élément interactif, non les séparateurs décoratifs.

- `border-hairline` et `border-strong` sont des séparateurs de structure. Ils sont exemptés, et leur ratio mesuré est compris entre 1,2 et 1,7.
- `border-interactive`, jeton ajouté à cette révision, est la bordure des champs, des boutons et de l'indicateur de focus. Son ratio mesuré est de 3,11 sur le fond le plus clair, donc conforme.

Employer un filet décoratif comme bordure de champ est une non-conformité. Le test d'analyse statique le vérifie.

### F2.5 Règles

- Aucune couleur écrite hors du paquet de jetons. Règle déjà posée, rappelée parce que c'est celle qui se contourne le plus facilement.
- Chaque jeton porte un rôle, jamais un nom de couleur. `accent`, pas `bleu`.
- Le thème sombre exigera un second jeu complet de couleurs réservées, les valeurs claires étant illisibles sur fond sombre. Ce n'est pas un échange de neutres.
- Les couleurs de contenu, celles des chartes clients et du registre de sécurité, ne passent jamais par les jetons. Elles viennent des données et ne sont ni converties, ni approchées.

---

## F3. Typographie de l'interface

### F3.1 Choix

Famille unique et sa variante à chasse fixe : IBM Plex Sans pour tout le texte, IBM Plex Mono pour les seules données numériques tabulaires.

### F3.2 Motifs du choix

Ce ne sont pas des motifs esthétiques.

1. **Chiffres tabulaires.** L'interface affiche en permanence des cotes, des azimuts, des coordonnées, des hauteurs de caractère. Sans chiffres à chasse constante, les colonnes de valeurs dansent à chaque saisie.
2. **Licence permettant l'incorporation.** Les polices sont incorporées dans le paquet de borne, qui fonctionne sans réseau. Une police sous licence restrictive rendrait le paquet non conforme.
3. **Superfamille cohérente.** La variante à chasse fixe partage les proportions et la hauteur d'x de la variante proportionnelle, ce qui évite la rupture visuelle habituelle des associations improvisées.
4. **Couverture latine complète** pour le français et l'anglais, accents et signes compris.
5. **Registre technique** proche des documents d'architecte que l'outil manipule.

Les licences ne sont plus un point ouvert de cette partie. Le mécanisme de mesure déterministe depuis les métriques extraites, le registre des polices et les règles d'incorporation sont spécifiés en partie G. Rappel de la règle qui gouverne l'interface : une police dont la licence n'est pas déclarée reste utilisable en aperçu écran et ne peut jamais être incorporée dans un livrable distribué.

### F3.3 Emploi de la chasse fixe

Restreint aux champs de valeurs numériques alignées en colonne. Interdit pour les libellés, les intitulés et le texte courant : une police à chasse fixe employée comme signal de sérieux est un maniérisme, pas une décision.

### F3.4 Échelle

Base à 13 pixels, adaptée à un outil dense. Progression suivant un intervalle constant.

| Rôle | Taille | Graisse | Interligne |
| --- | --- | --- | --- |
| Micro-libellé | 11 | 400 | 1,4 |
| Libellé de champ | 12 | 400 | 1,4 |
| Texte courant | 13 | 400 | 1,5 |
| Valeur mise en avant | 13 | 500 | 1,4 |
| Titre de panneau | 15 | 500 | 1,3 |
| Titre d'écran | 18 | 500 | 1,25 |
| Titre de document | 22 | 500 | 1,2 |

Deux graisses seulement, 400 et 500. Au-delà, la hiérarchie se fait par la position et l'espace, pas par la graisse.

### F3.5 Interdits

- Aucune capitale intégrale pour les libellés. Elle réduit la lisibilité et allonge le texte, ce qui pénalise le français, plus long que l'anglais.
- Aucun intitulé de rappel placé au-dessus d'un titre.
- Aucune mise en valeur d'un mot isolé dans un titre par la couleur ou l'italique.
- Longueur de ligne inférieure à 80 caractères pour tout texte courant.

---

## F4. Espacement, filets, rayons

### F4.1 Échelle d'espacement

Base 4 pixels. Valeurs autorisées : 2, 4, 6, 8, 12, 16, 20, 24, 32, 48. Aucune valeur hors échelle.

### F4.2 Filets

Épaisseur unique de 1 pixel, couleur `border-hairline`. `border-strong` réservé à la séparation entre la zone de travail et les panneaux.

Aucune ombre portée dans l'application de conception. Une élévation minimale est admise pour les seuls éléments flottants : menu contextuel, infobulle, boîte de dialogue.

### F4.3 Rayons

- 0 pixel : panneaux, barres, séparateurs, lignes de tableau.
- 4 pixels : champs, boutons, pastilles.
- 6 pixels : éléments flottants.

Le rayon encode la nature de l'élément. Un rayon unique appliqué partout dissout cette information.

---

## F5. Mise en page

### F5.1 Écran de conception

```
+------------------------------------------------------------------+
| barre de site : marque, site, niveau, actions, publier            |
+--------+-----+-------------------------------------+-------------+
| arbo   | out |                                     | propriétés  |
| site   | ils |          zone de travail             |             |
| 200px  | 44  |          (occupe le reste)          | 280px       |
|        |     |                                     |             |
|        |     |                                     +-------------+
|        |     |                                     | contrôles   |
+--------+-----+-------------------------------------+-------------+
| barre d'état : échelle, coordonnées, profil actif, synchro        |
+------------------------------------------------------------------+
```

Règles : les panneaux latéraux sont redimensionnables et repliables, leur largeur est mémorisée par utilisateur. La zone de travail ne descend jamais sous 60 % de la largeur disponible. La barre d'outils verticale reste toujours visible, y compris panneaux repliés.

### F5.2 Barre d'état

Elle porte ce qu'un opérateur doit voir en permanence sans le chercher : échelle courante, coordonnées du pointeur en repère métier, profil de parcours actif, état de synchronisation, nombre d'anomalies bloquantes.

Les coordonnées sont en chasse fixe, avec unité affichée, conformément à la convention de la partie D.

### F5.3 Écran de contrôle de face

```
+------------------------------------------------------------------+
| barre : support, typologie, version, état                         |
+--------------------------------+---------------------------------+
|                                | gabarit                         |
|      aperçu de la face         | contenu résolu (lecture)        |
|      sur fond clair            | blocs libres (saisie)           |
|      toujours                  | dimensions calculées            |
|                                | contrôles                       |
|                                | actions de version              |
+--------------------------------+---------------------------------+
```

L'aperçu occupe la moitié gauche et reste sur fond clair quel que soit le thème. Aucune poignée de manipulation n'est affichée : cet écran ne permet pas l'édition, conformément à la partie E.

### F5.4 Rapport d'audit

Mise en page en document, non en tableau de bord. Colonne de lecture, largeur limitée, sections ordonnées par gravité décroissante. Chaque anomalie porte un lien vers l'entité concernée dans la zone de travail.

---

## F5bis. Inventaire des écrans par module

La première version de cette partie ne détaillait que l'écran de conception, ce qui laissait croire à une application à écran unique. L'inventaire ci-dessous couvre les treize modules du produit.

| Module | Écrans |
| --- | --- |
| Socle du site | Liste des sites, fiche de site, import et calage de plan, tracé des empreintes, saisie du graphe, annuaire, habillage et composition |
| Wayfinding | Zonage et nomenclature, hiérarchie de l'information, plan de jalonnement, tableau des messages, principes déclarés |
| Parcours clients | Profils, comparaison de scénarios, carte d'exposition, rapport de flux |
| Signalétique | Implantation, composition de face, contrôle de face, plans muraux, plans d'évacuation, bons à tirer |
| Régie publicitaire | Inventaire des emplacements, planning d'occupation, contrats, réception des visuels, rendu en situation, espace annonceur |
| Enseignes locataires | Règlement, dossiers déposés, instruction, constat de conformité |
| Chantier et pose | Allotissement, ordres de fabrication, planning de pose, procès-verbaux, réserves |
| Exploitation | Tournées, incidents, ordres de travaux, état du parc |
| Budget | Coûts de référence, estimation, suivi budgétaire |
| Portefeuille | Vue multi-sites, comparaison, bibliothèques partagées |
| Transverse | Recherche globale, documents, notifications, journal d'activité, tableau de bord par rôle |
| Atelier de dessin | Surfaces d'édition communes, voir parties E, I et J |
| Application visiteur | Écrans du totem et du téléphone, voir partie P |
| Plateforme | Organisation, membres, abonnement, assistance, voir partie Q |

### F5bis.1 Trois familles de mise en page

Treize modules ne demandent pas treize mises en page. Trois familles suffisent pour l'application de conception, et toute nouvelle vue de conception s'y rattache.

**Famille atelier.** Zone de travail dominante, panneaux latéraux, barre d'outils, barre d'état. Structure décrite en F5.1. Concerne le tracé, le graphe, l'implantation, l'habillage, la carte d'exposition, l'inventaire publicitaire.

**Famille registre.** Tableau dense en pleine largeur, filtres persistants, panneau de détail latéral, actions groupées. Concerne le tableau des messages, l'annuaire, les contrats, les dossiers d'enseignes, les ordres de travaux, les coûts.

**Famille document.** Colonne de lecture de largeur limitée, sections ordonnées, exportable. Concerne les rapports d'audit, les rapports de flux, les fiches techniques, les procès-verbaux.

Règle : aucune quatrième famille dans l'application de conception sans passage par la procédure d'arrêt et de demande. L'application visiteur a sa propre famille d'écrans, spécifiée en partie P, section P5.

### F5bis.2 Navigation

Sélecteur de site permanent, puis navigation par module. Le module actif est toujours visible. Le passage d'un module à l'autre conserve le site et le niveau courants, sans quoi l'utilisateur perd son contexte à chaque changement.

Les modules non souscrits par l'organisation ne sont pas affichés en grisé mais absents. Un module grisé est une publicité, pas une interface.

### F5bis.3 Écran du tableau des messages

Écran de famille registre, et livrable central du wayfinding. Il mérite une spécification propre.

Colonnes : support, face, bloc, contenu en français, contenu en anglais, pictogramme, direction, niveau d'information, point de décision justifiant la ligne, état de péremption.

Exigences : actions de revue en série sur sélection multiple, sans aucune édition de contenu (règle M02.W6), comparaison entre deux versions, marquage visible des lignes périmées, export en tableur et en document, circuit de validation identique à celui des bons à tirer.

C'est l'écran que la maîtrise d'ouvrage regardera le plus longtemps. Sa densité et sa lisibilité priment sur son élégance.

Spécification au champ près : partie R.

---

## F6. Bibliothèque de composants

Liste fermée. Tout composant nouveau relève de la procédure d'arrêt et de demande.

**Saisie** : champ texte, champ numérique avec unité, champ d'angle, sélecteur, sélecteur de rôle de charte, interrupteur, case à cocher, groupe de choix exclusif, champ de recherche.

**Structure** : panneau, section repliable, arborescence, tableau de données, onglets, séparateur, barre d'outils, barre d'état.

**Retour** : pastille d'état, ligne d'anomalie, bandeau, infobulle, indicateur de progression, indicateur de synchronisation.

**Action** : bouton principal, bouton secondaire, bouton discret, bouton d'icône, menu, menu contextuel.

**Superposition** : boîte de dialogue, panneau latéral temporaire, sélecteur de fichier.

**Zone de travail** : vue, cadre de sélection, poignées de transformation, guides, règles, minicarte.

### F6.1 Règles communes

- Chaque composant expose ses états : repos, survol, focus, actif, désactivé, en erreur, en chargement.
- L'indicateur de focus est visible et distinct de l'indicateur de sélection. Confondre les deux rend l'application inutilisable au clavier.
- Un champ numérique affiche toujours son unité. Un champ dimensionnel sans unité affichée est refusé en revue.
- Aucun composant n'est construit à partir d'une bibliothèque tierce, conformément à la règle du cahier des charges principal.

---

## F7. États obligatoires d'un écran

Tout écran affichant des données traite les six états suivants. Un écran qui n'en traite que le cas nominal est incomplet et refusé en revue.

| État | Traitement |
| --- | --- |
| Vide | Invitation à agir, avec l'action en évidence. Jamais un simple constat d'absence. |
| Chargement | Structure d'attente calquée sur la forme du contenu. Jamais un tourniquet centré. |
| Partiel | Ce qui est disponible s'affiche, ce qui manque est nommé. |
| Erreur | Ce qui s'est passé et comment le corriger. |
| Hors ligne | Bandeau permanent, indication de ce qui reste possible. |
| Droit refusé | Ce que le rôle courant ne permet pas, et à qui s'adresser. |

---

## F8. Restitution des anomalies

L'interface possède un dictionnaire par code d'anomalie et par langue. Un code sans entrée fait échouer un test.

**Bloquante.** Pastille `state-blocking`, entité liée, action de correction proposée. Empêche l'émission d'une épreuve. Ne peut être ni masquée, ni acceptée, ni reportée.

**Avertissement.** Pastille `state-warning`, masquable pour la session, jamais définitivement.

**Information.** Pastille `state-info`, présente dans le rapport, absente de la vue courante.

Toute anomalie d'origine normative affiche sa référence documentaire. Une anomalie normative sans référence visible est un défaut, pas un détail de présentation.

Les anomalies sont groupées par entité, jamais par ordre d'apparition dans le code. Le comptage des bloquantes est visible en permanence dans la barre d'état.

---

## F9. Iconographie

### F9.1 La règle qui compte

L'interface affiche, dans la zone de travail, des pictogrammes normalisés du registre de sécurité et des pictogrammes d'orientation. Une icône d'interface ne doit jamais pouvoir être confondue avec l'un d'eux.

Conséquences, à respecter sans exception :

- Icônes d'interface en tracé seul, épaisseur constante, jamais en aplat plein.
- Jamais inscrites dans un cercle ou un carré plein, ces formes étant celles des pictogrammes normalisés.
- Jamais coloriées avec les couleurs de sécurité.
- Jamais représentant un sujet du domaine de la signalétique de sécurité : silhouette en fuite, flamme, personne, flèche directionnelle de sortie.

Une flèche d'interface, quand elle est indispensable, se distingue par sa forme et n'est jamais employée seule à côté d'un rendu de plan.

### F9.2 Fabrication

Jeu unique, taille de base 16 pixels, alignement sur la grille du pixel, épaisseur de tracé constante. Livré en fichiers, incorporé, jamais chargé depuis le réseau.

Toute icône porte un texte de remplacement décrivant l'action, pas la forme.

---

## F10. Écriture

### F10.1 Vocabulaire

Le vocabulaire imposé par le cahier des charges principal fait foi dans l'interface comme dans le code. Aucun synonyme. Un support est un support, jamais un panneau, un élément ou un item.

### F10.2 Ton

- Casse de phrase partout, y compris sur les boutons.
- Verbes actifs. Un bouton dit ce qui se produit : « Publier », pas « Valider ».
- Une action garde son nom sur tout le parcours. Le bouton « Publier » produit le message « Publié ».
- Aucune formule de politesse dans les erreurs, aucune excuse. Une erreur dit ce qui s'est passé et ce qu'il faut faire.
- Un écran vide invite à agir.
- Aucun texte destiné à rassurer sans informer.

### F10.3 Bilinguisme

- Toute chaîne passe par une clé. Aucun texte écrit dans un composant.
- Les maquettes sont contrôlées dans les deux langues, le français étant en général plus long de 15 à 25 %.
- Les libellés de champs sont dimensionnés sur la variante la plus longue, pas sur celle de la langue de développement.
- Aucune construction de phrase par concaténation de fragments : les langues n'ont pas le même ordre.

---

## F11. Mouvement

- Aucune animation qui ne réponde pas à une action de l'utilisateur.
- Durées : 120 millisecondes pour un changement d'état, 200 pour l'ouverture d'un élément flottant, 240 pour un panneau. Trois valeurs, pas davantage.
- Aucune animation d'entrée en cascade, aucune apparition progressive de sections.
- L'animation de parcours de la zone de travail est un contenu, pas un effet d'interface. Elle est réglable et possède un équivalent statique.
- Le mode à animation réduite est respecté. Il ne supprime pas l'information, il supprime le mouvement.

---

## F12. Densité et matériel cible

- Poste de référence : ordinateur portable, affichage de 1440 pixels de large, résolution standard.
- Largeur minimale prise en charge pour l'application de conception : **1366 pixels**.

**Correction d'une contradiction interne.** La valeur de 1280 pixels annoncée dans la première version était incompatible avec la règle de F5.1, qui impose que la zone de travail ne descende jamais sous 60 % de la largeur disponible. Les panneaux fixes occupent 524 pixels, ce qui exige une largeur totale d'au moins 1310 pixels pour respecter la règle. À 1280, la zone de travail tombait à 59,1 %.

La valeur retenue est 1366, largeur d'affichage courante sur les postes portables d'entrée de gamme, qui laisse la zone de travail à 61,6 %. En dessous, un message indique la contrainte au lieu de proposer une version dégradée inutilisable.

Cette valeur reste à confronter aux postes réellement utilisés. C'est un calcul cohérent, pas une observation.
- L'application de conception n'a pas de version pour terminal mobile. Ce serait une promesse intenable pour un outil de dessin. Une consultation en lecture seule pourra être envisagée ultérieurement, elle n'est pas prévue.
- Les rendus produits, eux, sont indépendants du matériel.

---

## F13. Interface du runtime de borne

Contraintes distinctes de celles de l'application de conception. Ne pas réutiliser les composants sans révision.

- Base typographique à 20 pixels au minimum, distance de lecture d'un usager debout.
- Cible tactile minimale de 44 pixels, espacement minimal de 8 pixels entre cibles.
- Zone d'interaction principale dans le tiers inférieur de l'écran, compatible avec un usage assis.
- Aucun survol, aucun menu déroulant, aucun lien sortant.
- Retour à l'accueil après inactivité, sans conservation d'état entre usagers.
- Mode contraste renforcé accessible en un geste depuis n'importe quel écran.
- Alternative sonore à toute information portée par la seule couleur.
- Vue en plan simplifié accessible partout où l'isométrie est proposée.
- Polices et icônes incorporées, aucune requête sortante.

---

## F14. Accessibilité

Cible AA sur l'application de conception et sur la borne. Un contrôle automatique ne détecte qu'une partie des manquements : un résultat sans violation signifie l'absence de violation détectable, pas la conformité. La conformité AA est attestée par l'audit d'accessibilité externe. En complément des exigences déjà posées :

- Contraste calculé, jamais estimé, sur tous les couples de jetons, y compris les états de survol et de focus.
- Navigation complète au clavier, ordre de tabulation cohérent, aucun piège de focus.
- La zone de travail est intégralement pilotable au clavier, conformément à la partie E. C'est l'exigence la plus difficile et elle se conçoit dès le modèle de sélection.
- Aucune information portée par la seule couleur, vérifié sur un rendu en niveaux de gris.
- Textes de remplacement décrivant le contenu, jamais la forme.
- Les changements d'état et le résultat des actions sont annoncés.

---

## F15. Structure du code front

```
apps/studio/src/
  app/          composition des écrans, routage
  screens/      un dossier par écran
  components/   bibliothèque F6, aucun composant hors liste
  viewport/     zone de travail, vue, sélection, outils
  state/        magasin et commandes, écrit dans le dépôt
  i18n/         clés et dictionnaires
  a11y/         utilitaires d'annonce et de focus
```

Règles :

- Aucune valeur de couleur, d'espacement, de taille ou de durée écrite dans un composant. Jetons uniquement.
- Aucune règle de style spécifique à un écran. Un besoin de style non couvert par les jetons relève de la procédure d'arrêt et de demande.
- Attention aux spécificités de sélecteurs qui s'annulent, notamment entre sélecteurs de type et sélecteurs d'élément sur les marges internes.
- Aucun composant ne calcule sa propre conversion entre repère de vue et repère métier. Transformation unique, conformément à la partie E.

---

## F16. Tests front

- Non-régression visuelle sur chaque composant, dans chacun de ses états, dans les deux langues.
- Contraste calculé sur tous les couples de jetons.
- Parcours complet au clavier sur chaque écran.
- Analyse statique : aucune couleur en dur, aucune valeur d'espacement hors échelle, aucune chaîne de texte écrite dans un composant.
- Contrôle du dictionnaire : chaque code d'anomalie possède une entrée dans chaque langue active.
- Contrôle iconographique : aucune icône d'interface en aplat plein, aucune inscrite dans une forme fermée pleine.
- Rendu en niveaux de gris : aucune information perdue.

---

## F17. Rattachement aux tâches

| Élément | Rattachement |
| --- | --- |
| Jetons, typographie, espacement | T-0.7, étendue |
| Bibliothèque de composants et états | nouvelle tâche T-0.13 |
| Jeu d'icônes et règle de non-confusion | nouvelle tâche T-0.14 |
| Dictionnaires et mécanisme bilingue | nouvelle tâche T-0.15 |
| Mise en page de l'écran de conception | T-1.15, étendue |
| Barre d'état et coordonnées | T-1.15 |
| Restitution des anomalies | T-1.12 et T-2.5 |
| Écran de contrôle de face | T-2.15, étendue |
| Rapport d'audit en mise en page document | T-1.14, étendue |
| Interface de borne | lot 3.5 |
| Thème sombre | lot 4.6 |

---

## F18. La marque Azimut

Traitée ici parce qu'elle ne peut pas rester hors du document, mais avec une frontière stricte : le rôle de cette section est autant de définir la marque que d'empêcher qu'elle contamine l'interface.

### F18.1 Le nom

Azimut désigne l'attribut qui oriente chaque plan mural selon le regard de l'usager. Le nom décrit donc ce que le produit fait, et se justifie en une phrase devant un client. Il est prononcé de façon quasi identique en français et en anglais.

Deux orthographes existent, avec et sans h final. Déposer les deux, ne communiquer que sur une seule.

### F18.2 Le signe

Concept retenu : la notation d'un relèvement. Un point d'observation et une direction relevée, tels qu'ils figurent sur un plan de géomètre. Pas de rose des vents, pas d'épingle de localisation, pas de globe : ce sont les trois solutions attendues, donc les trois qui ne distinguent pas.

Contraintes de construction : tracé monolinéaire d'épaisseur constante, lisible à 16 pixels, fonctionnant en une seule couleur, sans dégradé, sans ombre.

Une réserve de protection égale à la hauteur du signe. Largeur minimale déclarée pour l'impression et pour l'écran.

Trois versions seulement : positive sur fond clair, négative sur fond sombre, monochrome pour la gravure et la sérigraphie.

### F18.3 Interdits

Ne jamais déformer, incliner, contourner, ombrer, remplir d'un dégradé, poser sur une photographie chargée, ni recolorer hors des trois versions.

Ne jamais employer une couleur du registre de sécurité. Ne jamais inscrire le signe dans un cercle ou un carré plein, pour la même raison que les icônes d'interface : la confusion possible avec un pictogramme normalisé.

### F18.4 La frontière avec l'interface

Règles fermes, qui sont l'objet principal de cette section.

- Le signe apparaît à un seul endroit de l'application de conception : la barre de site, en petit format. Nulle part ailleurs.
- Les couleurs de la marque ne sont pas des jetons d'interface. Si la marque devait un jour adopter une couleur propre, celle-ci n'entrerait pas dans le système de jetons.
- **La marque n'apparaît jamais sur un livrable client.** Ni sur une exécution destinée au fabricant, ni sur un plan mural, ni sur un rapport exporté, ni dans les métadonnées d'un fichier produit. Le fabricant reçoit un fichier propre.
- **La marque n'apparaît jamais sur une borne.** Une borne porte l'identité du site, pas celle de l'éditeur du logiciel. Une mention discrète est admissible dans un écran de service accessible au personnel, pas dans le parcours visiteur.
- L'espace annonceur et l'espace locataire portent l'identité du site, pas celle d'Azimut.

Motif : le produit se vend à des exploitants dont l'identité est l'actif. Un logiciel qui signe leurs livrables se rend impossible à recommander.

### F18.5 Ce qui reste à faire

Le dessin effectif du signe relève d'un designer. Cette section en fixe le concept et les contraintes, elle ne le remplace pas.

La disponibilité du nom n'est pas vérifiée : ni les noms de domaine, ni les antériorités de marque en classes 9 et 42 auprès des offices compétents. Un nom déjà déposé ne vaut rien, et cette vérification relève d'un conseil en propriété industrielle. C'est un préalable, pas une formalité.

---

## F19. Ce que cette partie ne couvre pas

Historique. Cette liste ne fait plus foi. Les points encore ouverts sont repris dans le registre de la partie K, section K3, seule liste à tenir.

Liste réduite depuis la première version. Les points relatifs aux licences de polices, à l'ergonomie tactile et au stylet sont désormais traités en partie G. Les contrastes sont mesurés en F2.3. La largeur minimale est corrigée en F12. La marque est traitée en F18.

Restent ouverts :

1. **Le dessin du signe.** Concept et contraintes posés, exécution à confier à un designer.
2. **La disponibilité du nom.** Non vérifiée, préalable bloquant.
3. **La largeur minimale de 1366 pixels.** Cohérente avec la règle de proportion de la zone de travail, mais non confrontée aux postes réellement utilisés.
4. **Les essais sur usagers.** Aucune décision de ce document n'a été éprouvée auprès d'un opérateur réel, et ils portent maintenant sur un produit à treize modules. La densité retenue est le point le plus susceptible d'être remis en cause.
5. **Les écrans des sept modules ajoutés.** Inventoriés en F5bis et rattachés à trois familles de mise en page, ils ne sont pas spécifiés écran par écran. Chacun le sera au moment d'entrer dans son incrément.

---

# PARTIE G. Résolution des points ouverts

Cette partie traite les points laissés ouverts en fin de partie E.

---

## G0. Méthode, et ce qu'un document peut faire

Les points ouverts ne sont pas de même nature, et les traiter uniformément produirait de fausses certitudes.

| Point | Nature | Ce que ce document apporte |
| --- | --- | --- |
| Chiffrage | Estimation | Une décomposition et une méthode de calibrage, pas des durées |
| Seuil de bascule de rendu | Mesure | Un mécanisme adaptatif qui rend le seuil fixe inutile |
| Saisie tactile et stylet | Spécification | Une spécification complète |
| Édition simultanée | Décision de périmètre | Une décision, une solution intermédiaire spécifiée |
| Polices et licences | Technique + juridique | La partie technique est spécifiée, la partie juridique reste ouverte |
| Colorimétrie | Technique + juridique | La chaîne est spécifiée, une contrainte de licence est révélée |
| Reprise des fichiers clients | Décision commerciale | Une position, et une non-promesse assumée |

Écrire davantage ne transforme pas une mesure manquante en résultat. Les sections qui suivent le disent à chaque fois que c'est le cas.

---

## G1. Décomposition et chiffrage

### G1.1 Pourquoi aucune durée n'est écrite ici

Les fourchettes données jusqu'ici sont des ordres de grandeur non décomposés. Les transformer en engagement demanderait une vélocité mesurée, qui n'existe pas puisque rien n'a été construit. Produire des jours-hommes maintenant reviendrait à inventer un chiffre auquel quelqu'un se fierait.

Ce que ce document apporte à la place : une décomposition en lots, une taille relative par lot, et un protocole de calibrage qui produit les durées après deux lots réels.

### G1.2 Échelle de taille relative

Quatre tailles seulement. Une échelle plus fine donnerait une fausse précision.

| Taille | Sens |
| --- | --- |
| S | Contenu et contours clairs, peu d'inconnues |
| M | Contours clairs, quelques inconnues techniques |
| L | Plusieurs inconnues, ou forte interaction avec l'existant |
| XL | Comporte une inconnue majeure. À découper avant d'être engagé |

Règle : aucun lot XL n'entre en développement. Il est d'abord découpé, ou précédé d'un travail exploratoire borné dans le temps dont le livrable est une note, pas du code.

### G1.3 Décomposition, incrément 0

| Lot | Taille | Inconnue principale |
| --- | --- | --- |
| Squelette, chaîne d'intégration, migrations | S | aucune |
| Schéma site et géométrie | M | contraintes géométriques en base |
| Authentification et rôles | S | aucune |
| Cloisonnement par ligne et tests d'étanchéité | L | canaux indirects de fuite |
| Jetons, composants, icônes, dictionnaires | L | ampleur de la bibliothèque |
| Chargeur de paquets de règles | M | aucune |
| Décision et preuve sur la génération PDF | L | déterminisme à l'octet non acquis |
| Trousse de test et sites de référence | M | volume de données à construire |
| Service de compilation | M | reprise sans effet de bord |
| Vérification d'auto-hébergement | M | dépendances non réimplantables |

### G1.4 Décomposition, incrément 1

| Lot | Taille | Inconnue principale |
| --- | --- | --- |
| Import et calage de plan | M | qualité réelle des plans reçus |
| Modèle de vue, transformation, sélection | L | pilotage clavier complet |
| Motif de commande et annulation | L | articulation future avec le hors ligne |
| Outillage de géométrie de base | L | ampleur de l'outillage attendu |
| Outils métier de tracé | L | division et fusion de cellules |
| Magnétisme et contraintes | M | déterminisme du choix de cible |
| Saisie du graphe et liaisons | M | aucune |
| Validation de complétude | M | exhaustivité des cas |
| Destinations et bibliothèques sectorielles | M | volume des bibliothèques |
| Profils et moteur de parcours | M | invalidation de cache |
| Points de décision et audits | L | justesse métier à confronter au terrain |
| Reprise de carnet existant | L | hétérogénéité des fichiers reçus |
| Rapport de rapprochement | M | aucune |
| Écran de conception assemblé | L | densité et utilisabilité réelles |

### G1.5 Décomposition, incrément 2

| Lot | Taille | Inconnue principale |
| --- | --- | --- |
| Typologies et gabarits déclaratifs | M | expressivité suffisante du format |
| Résolution de contenu | M | aucune |
| Calcul des dimensions | M | dépend du contenu des paquets de règles |
| Contrôles de composition | L | contraste et lisibilité à valider |
| Verrouillage du registre de sécurité | M | exhaustivité des voies de contournement |
| Projection isométrique et zones cliquables | L | cas des empreintes recoupées |
| Vue en plan simplifié | M | critère objectif de densité réduite |
| Plans muraux orientés | M | erreur de signe difficile à voir |
| Plans d'évacuation | M | dépend du corpus normatif |
| Chaîne tactile et braille | L | standard de transcription non tranché |
| Exécutions PDF et colorimétrie | L | déterminisme et profils |
| Quantitatif | S | aucune |
| Versions et bons à tirer | M | insertion seule au niveau base |
| Couche d'habillage et symboles | L | ampleur de la bibliothèque |
| Composition de page | M | aucune |
| Import et assainissement d'actifs | L | sécurité de l'assainissement |
| Éditeur de gabarit | L | preuve qu'un gabarit reste une donnée |
| Écran de contrôle de face | M | aucune |
| Compilation en lot | M | tenue du budget de temps |

### G1.6 Protocole de calibrage

1. Choisir deux lots de taille S et deux de taille M en début d'incrément 0.
2. Les réaliser en mesurant la durée réelle, sans estimation préalable communiquée, qui biaiserait la mesure.
3. Établir une durée moyenne par taille, avec sa dispersion.
4. Projeter le reste, en affichant une fourchette et non une valeur unique.
5. Réviser après chaque incrément. Une projection non révisée après six mois est périmée.

Règle de communication : toute durée sortie de ce protocole est présentée avec sa fourchette et la date de la mesure qui la fonde. Une durée citée seule est trompeuse.

### G1.7 Effet des parties E et F sur la charge

Constat qu'il faut assumer plutôt que dissoudre. Les parties E et F ajoutent aux incréments 1 et 2 : un éditeur vectoriel réel là où un formulaire de saisie était supposé, une couche d'habillage entièrement nouvelle, une bibliothèque de composants et un jeu d'icônes propres, un import d'actifs clients avec assainissement, une chaîne colorimétrique.

Sur les 33 lots des incréments 1 et 2, 8 n'existaient pas dans le cahier des charges principal et 6 y étaient sous-évalués. L'allongement est donc substantiel, et son ampleur sortira du calibrage, pas d'une estimation faite maintenant.

---

## G2. Budget de rendu et seuil adaptatif

### G2.1 Le problème du seuil fixe

La valeur de 3 000 objets était une hypothèse. Un seuil fixe est de toute façon faux : la performance dépend du matériel, du navigateur, de la complexité des polygones et du niveau de zoom, pas du seul nombre d'objets. Un seuil calibré sur le poste du développeur sera mauvais chez le client.

### G2.2 Mécanisme retenu

Le seuil est supprimé et remplacé par un budget mesuré à l'exécution.

1. Le rendu vise un budget de temps par image, constante nommée, valeur initiale 16 millisecondes.
2. Le temps de rendu est mesuré en continu, sur une moyenne glissante de 30 images.
3. Si la moyenne dépasse le budget pendant plus de 500 millisecondes, la vue bascule en mode de rendu allégé.
4. Si elle repasse durablement sous 60 % du budget, elle revient au mode complet, avec une hystérésis empêchant l'oscillation.
5. Le mode courant est indiqué dans la barre d'état, jamais silencieux.

### G2.3 Mode allégé

Rendu en mode point de la scène statique, éléments interactifs conservés en éléments du document. La détection de clic passe au calcul géométrique, avec index spatial.

Exigence : le mode allégé ne change ni la sélection possible, ni les opérations disponibles, ni les coordonnées produites. Il change la façon de dessiner, jamais le résultat. Un test compare l'état final après une même séquence d'opérations dans les deux modes et exige l'égalité stricte.

### G2.4 Ce qui reste à mesurer

La valeur initiale du budget et les paramètres d'hystérésis sont des points de départ, pas des résultats. Ils se mesurent selon le protocole de la partie D, sur le premier site réel modélisé, et la révision est tracée.

---

## G3. Saisie tactile et stylet

### G3.1 Principe

Trois types de pointeur, avec des capacités différentes assumées. Prétendre que tout est possible partout produit une interface mauvaise partout.

| Type | Capacités |
| --- | --- |
| Souris | Toutes |
| Stylet | Toutes |
| Doigt | Navigation, sélection, édition de propriétés. Pas de tracé libre |

Le tracé libre au doigt est exclu. La précision requise pour une empreinte de cellule ne s'obtient pas au doigt, et proposer une fonction imprécise vaut moins que ne pas la proposer.

### G3.2 Tolérances par type

La tolérance de sélection et de magnétisme dépend du pointeur, en pixels écran conformément à la partie E.

| Type | Tolérance de sélection | Tolérance de magnétisme |
| --- | --- | --- |
| Souris | 4 | 8 |
| Stylet | 3 | 6 |
| Doigt | 12 | 16 |

Ces valeurs sont des constantes nommées, réglables, et leur effet sur le déterminisme est nul : à état de vue et geste identiques, le résultat est identique pour un type de pointeur donné.

### G3.3 Gestes

- Un doigt sur le fond : déplacement de la vue.
- Un doigt sur un objet : sélection.
- Deux doigts : déplacement et zoom simultanés.
- Appui long : menu contextuel.
- Aucun geste à trois doigts ou plus, non découvrable et souvent capté par le système.

### G3.4 Stylet

- Traité comme un pointeur précis, avec les tolérances ci-dessus.
- La pression n'est pas utilisée. Elle n'a aucun sens dans un dessin technique et introduirait une variabilité contraire au déterminisme.
- L'inclinaison n'est pas utilisée.
- Rejet de la paume obligatoire dès qu'un stylet est détecté : tout contact tactile est ignoré tant que le stylet est actif.

### G3.5 Adaptation de l'interface

Quand un pointeur grossier est détecté, les cibles interactives passent à 44 pixels minimum et les outils de tracé libre sont désactivés avec indication du motif. L'adaptation suit le pointeur réellement employé, pas le type d'appareil déclaré : un ordinateur portable à écran tactile utilise les deux.

---

## G4. Présence simultanée

### G4.1 Décision de périmètre

L'édition simultanée en temps réel sur un même niveau était **exclue définitivement du produit**. **Cette exclusion est levée par la partie S, section S6**, au profit d'une propagation de commandes validées, avec verrou ferme sur l'objet en cours d'édition. Les motifs ci-dessous restent valables et expliquent pourquoi l'édition simultanée n'est pas une fusion continue.

Motifs : la fusion en temps réel d'un graphe dont la cohérence topologique est une exigence bloquante est un problème d'un autre ordre de difficulté que la synchronisation différée. Elle exposerait à des états intermédiaires incohérents, et elle est sans rapport avec le besoin réel, où une à deux personnes modélisent un site.

Ce qui reste : la synchronisation différée du lot 4.4, inchangée.

### G4.2 Ce qui est spécifié à la place

Deux personnes peuvent ouvrir le même niveau. Le produit empêche le dégât, sans empêcher le travail.

**Présence.** Les utilisateurs ayant le niveau ouvert sont affichés en permanence dans la barre d'état, avec leur nom et l'heure de leur dernière modification.

**Verrouillage consultatif au niveau de l'objet.** Modifier un objet pose un verrou consultatif portant l'auteur et une expiration de 15 minutes, renouvelée tant que l'édition se poursuit. Un autre utilisateur voit l'objet marqué, peut le consulter, ne peut pas le modifier sans passer outre.

**Passage en force explicite.** Possible, avec confirmation nommant le détenteur du verrou, et journalisation. Un verrou expiré tombe de lui-même.

**Aucun verrou dur.** Un verrou qui bloquerait sans recours produirait des sites inaccessibles après une déconnexion. C'est le défaut classique de ce mécanisme, et il est évité par l'expiration.

### G4.3 Limite déclarée

Ce dispositif réduit le risque, il ne l'annule pas. Deux personnes travaillant simultanément sur des parties disjointes du même graphe peuvent produire une incohérence topologique. La validation de complétude rejouée à la synchronisation la détecte et bloque la publication. Elle la détecte, elle ne l'empêche pas.

---

## G5. Métriques de police et licences

### G5.1 Mesure déterministe du texte

C'est la partie technique, et elle se résout entièrement.

Interdiction de mesurer un texte par les fonctions de mesure du navigateur : le résultat varie selon le moteur de rendu, la version et le système, ce qui rend l'invariant 4 invérifiable et fait diverger les empreintes visuelles entre deux postes.

Mécanisme retenu :

1. À la construction, les métriques de chaque police sont extraites en table : unités par cadratin, hauteur de cadratin, hauteur d'x, jambages, chasse de chaque glyphe, paires d'approche.
2. La table est versionnée avec la police et porte une empreinte.
3. Le moteur de composition mesure exclusivement depuis cette table.
4. Un changement de version de police change l'empreinte et invalide les rendus concernés, qui sont recompilés.
5. Un test compare la mesure calculée à un rendu de référence et détecte toute dérive.

### G5.2 Registre des polices

```sql
font_asset      (id, org_id, family, style, weight, storage_path,
                 metrics_path, metrics_hash, embeddable boolean,
                 licence_kind, licence_ref, declared_by, declared_at,
                 latin_coverage_ok boolean)
                licence_kind in ('open','purchased','client_supplied','unknown')
```

Règles :

- Une police de `licence_kind = 'unknown'` ne peut pas être incorporée dans un livrable distribué. Elle reste utilisable en aperçu écran.
- L'incorporation dans un paquet de borne exige `embeddable = true` et une référence de licence renseignée.
- La couverture latine requise pour le français et l'anglais, accents compris, est vérifiée automatiquement à l'import.
- Un livrable produit avec une police non incorporable lève une anomalie bloquante.

### G5.3 Ce qui reste ouvert

La vérification juridique des termes de licence n'est pas automatisable. Le produit enregistre une déclaration et son auteur, il ne l'atteste pas. La responsabilité reste à l'organisation qui déclare, et la clause contractuelle standard le dit.

---

## G6. Chaîne colorimétrique

### G6.1 Modèle

Une couleur de charte n'est pas une valeur, c'est un faisceau de représentations.

```sql
-- charter_color : définition unique en section A5.8.

color_output_profile (id, org_id, substrate_key, profile_path, profile_name)
```

**La référence fait foi.** C'est elle qui part chez le fabricant. Les valeurs d'affichage et de sortie en sont des approximations, et l'interface les présente comme telles.

### G6.2 Règles

- Aucune conversion n'est jamais présentée comme exacte. Tout aperçu écran porte une mention d'approximation, y compris dans les exports d'aperçu.
- Le calcul de contraste utilise les valeurs d'affichage, avec la formule de luminance relative. C'est une mesure d'accessibilité, pas une mesure colorimétrique.
- L'écart colorimétrique entre deux couleurs n'est calculé que si les deux disposent de valeurs mesurées. Sinon, l'interface indique que l'écart n'est pas calculable, au lieu d'afficher un chiffre faux.
- Un profil de sortie est requis par substrat avant production. Son absence lève une anomalie.
- Les couleurs du registre de sécurité ne sont ni converties, ni approchées, ni contrôlées en contraste par rapport à la charte. Elles proviennent du paquet de règles et sont employées telles quelles.
- Une épreuve physique reste nécessaire avant fabrication. Le produit ne remplace pas l'épreuve contractuelle et l'écrit dans ses livrables.

### G6.3 Contrainte de licence révélée

Point non identifié jusqu'ici, et qui a des conséquences directes sur le développement.

Les données colorimétriques des principaux systèmes de teintes directes du commerce sont propriétaires. Les tables de correspondance entre un code de nuancier et ses valeurs mesurées ne peuvent pas être incorporées dans un logiciel sans licence de l'éditeur du nuancier.

Conséquence : le produit **stocke une référence saisie par le client**, sous forme de texte, et ne fournit aucune table de conversion. Si le client fournit lui-même les valeurs mesurées de sa charte, elles sont enregistrées et utilisées. Sinon, la référence reste une chaîne transmise au fabricant, et l'aperçu écran repose sur la valeur d'affichage déclarée par le client.

C'est une limite assumée, et c'est aussi la position juridiquement sûre. Elle doit figurer dans la documentation commerciale, faute de quoi un client s'attendra à une conversion que le produit ne fera jamais.

---

## G7. Reprise des fichiers existants des clients

Septième point ouvert de la partie E, traité ici pour ne pas le laisser en suspens.

### G7.1 Position

Un client arrivant avec des années de fichiers d'éditeur vectoriel ne les convertira pas en modèle Azimut. La conversion automatique d'un dessin en modèle structuré n'est pas un problème d'import, c'est un problème d'interprétation : un dessin ne contient ni graphe, ni catégories, ni statuts d'occupation.

### G7.2 Ce qui est proposé

Une seule voie, honnête et utile : **l'import comme référence de fond**. Le fichier est converti en image calée, sur laquelle le concepteur redessine. Il est archivé et consultable, il n'alimente aucun calcul.

En complément, la reprise de carnet existant par tableur, déjà spécifiée, couvre la partie qui compte réellement, à savoir l'inventaire des supports.

### G7.3 Non-promesse

Ne jamais annoncer une reprise automatique de fichiers graphiques. C'est la promesse la plus facile à faire en avant-vente et la plus certaine de décevoir. La documentation commerciale dit ce que fait le produit : il reprend un inventaire, pas un dessin.

---

## G8. Ajouts au catalogue des codes d'anomalie

| Code | Gravité | Sens |
| --- | --- | --- |
| `EDIT.OBJECT_LOCKED` | avertissement | Objet verrouillé par un autre utilisateur |
| `EDIT.LOCK_OVERRIDDEN` | information | Verrou forcé, journalisé |
| `EDIT.TOUCH_TOOL_UNAVAILABLE` | information | Outil de tracé indisponible au doigt |
| `RENDER.BUDGET_EXCEEDED` | information | Bascule en mode de rendu allégé |
| `FONT.NOT_EMBEDDABLE` | bloquant | Police non incorporable dans un livrable distribué |
| `FONT.METRICS_MISSING` | bloquant | Table de métriques absente ou altérée |
| `FONT.LICENCE_UNKNOWN` | avertissement | Licence non déclarée |
| `COLOR.DELTA_NOT_COMPUTABLE` | information | Écart non calculable, valeurs mesurées absentes |
| `COLOR.REFERENCE_UNVERIFIABLE` | information | Référence de nuancier sans valeurs fournies |
| `IMPORT.VECTOR_AS_REFERENCE_ONLY` | information | Fichier importé en référence de fond, sans exploitation |

---

## G9. Rattachement aux tâches

| Élément | Rattachement |
| --- | --- |
| Décomposition et calibrage | démarrage de l'incrément 0, avant tout engagement |
| Budget de rendu adaptatif | T-1.2, remplace le seuil fixe |
| Saisie tactile et stylet | T-1.2, tolérances par type de pointeur |
| Présence et verrouillage consultatif | nouvelle tâche T-1.16 |
| Extraction des métriques de police | nouvelle tâche T-0.16, préalable à T-2.4 |
| Registre des polices et licences | T-0.16 |
| Modèle de couleur de charte | T-2.12, étendue |
| Profils de sortie par substrat | T-2.12 |
| Import en référence de fond | T-1.1, étendue |

---

## G10. Ce qui reste non résolu

Historique. Cette liste ne fait plus foi. Les points encore ouverts sont repris dans le registre de la partie K, section K3, seule liste à tenir.

Court, et c'est voulu.

1. **Les durées.** Ce document donne une décomposition et une méthode. Les durées sortiront du calibrage, après deux lots réels. Aucune valeur n'est écrite ici et aucune ne doit être citée avant cette mesure.
2. **La vérification juridique des licences de polices.** Automatisable pour la déclaration, pas pour la vérification. Reste à l'organisation cliente, avec clause contractuelle.
3. **La licence des données de nuanciers.** La position retenue est de ne fournir aucune table de conversion. Si une licence était acquise un jour, le modèle de données la supporte déjà, mais rien ne doit être promis d'ici là.
4. **Les valeurs initiales du budget de rendu et des tolérances de pointeur.** Points de départ, à mesurer sur le premier site réel.
5. **L'ergonomie tactile réelle.** Spécifiée, non éprouvée. Les essais d'utilisabilité peuvent remettre en cause l'exclusion du tracé libre au doigt, dans un sens comme dans l'autre.

---

# PARTIE H. Modules manquants et carte complète du produit

Cette partie corrige un défaut de découpage des documents précédents et ajoute les modules absents.

---

## H0. L'erreur corrigée

Les documents précédents traitaient le produit comme une chaîne unique allant du plan au support fabricable. Ce découpage confond trois métiers qui ont des acteurs, des livrables et des calendriers différents.

**Le wayfinding** est une stratégie d'orientation. Zonage, nomenclature, hiérarchie de l'information, plan de jalonnement. Il répond à la question : que dit-on, où, dans quel ordre. Il précède tout dessin.

**Les parcours clients** relèvent de l'analyse commerciale. Flux réels, exposition des cellules, zones chaudes et froides, incidence sur la commercialisation et sur la valeur locative. L'acteur est la direction commerciale, pas le concepteur.

**La signalétique** est la production. Elle traduit en supports fabricables ce que les deux premiers ont arrêté.

Conséquence de cette confusion : le **tableau des messages**, livrable central de la pratique du wayfinding, n'apparaît nulle part dans les cinq documents précédents. C'est l'omission la plus grave de l'ensemble, et elle est corrigée en H2.

---

## H1. Carte complète des modules

| Module | Acteur principal | Statut |
| --- | --- | --- |
| 1. Socle du site | Concepteur | Spécifié |
| 2. Wayfinding, stratégie d'orientation | Concepteur, maîtrise d'ouvrage | **Manquant** |
| 3. Parcours clients, analyse commerciale | Direction commerciale | **Manquant** |
| 4. Signalétique, production | Concepteur, fabricant | Spécifié |
| 5. Régie publicitaire | Régie, annonceurs | **Manquant** |
| 6. Enseignes locataires | Exploitant, locataires | **Manquant** |
| 7. Chantier et pose | Conducteur de travaux | **Manquant** |
| 8. Exploitation et maintenance | Exploitant | Partiel |
| 9. Budget et estimation | Maîtrise d'ouvrage | **Manquant** |
| 10. Portefeuille multi-sites | Direction | **Manquant** |
| 11. Fonctions transverses | Tous | Partiel |

Sept modules manquants sur onze. C'est l'ampleur réelle de l'écart, et il faut la voir avant de décider quoi construire.

Carte d'origine. La carte qui fait foi, avec l'atelier de dessin, l'application visiteur et la plateforme, figure en partie L, section L2.

---

## H2. Module 2, wayfinding

### H2.1 Objet

Établir la stratégie d'orientation avant toute conception de support. C'est le module qui manquait, et c'est celui qui fait la différence entre un logiciel de dessin et un outil de wayfinding.

### H2.2 Zonage et nomenclature

Un site s'orien­te d'abord par la façon dont on le nomme. Le module porte :

- Découpage en zones d'orientation, distinctes des zones techniques du socle.
- Nomenclature des niveaux, des zones, des accès, des noyaux verticaux, des portes.
- Règles de nommage déclarées et vérifiées : cohérence entre bâtiments, unicité, longueur maximale compatible avec les supports, prononçabilité dans les deux langues.
- Détection des collisions de nommage, cas fréquent sur les sites multibâtiments où deux portes A coexistent.

Le nommage est une donnée du wayfinding, jamais une saisie libre au moment de composer un panneau.

### H2.3 Hiérarchie de l'information

Quatre niveaux d'information, déclarés par site et appliqués par le moteur de composition :

1. Identification : où suis-je.
2. Orientation : que trouve-t-on, dans quelle direction.
3. Direction : par où aller.
4. Confirmation : je suis arrivé.

Chaque typologie de support est rattachée à un ou plusieurs niveaux d'information. Un support qui n'en porte aucun est une anomalie : il existe sans raison.

### H2.4 Plan de jalonnement

Le jalonnement est la traduction spatiale de la hiérarchie. Le module produit, pour chaque parcours et chaque profil :

- La séquence des points de décision, dans l'ordre de rencontre.
- Le niveau d'information attendu à chaque point.
- La continuité du message : une destination annoncée à un point doit être reprise ou confirmée au point suivant. La rupture de continuité est l'erreur de wayfinding la plus fréquente et la moins visible.

Contrôle automatisé : détecter toute destination annoncée puis abandonnée avant d'être atteinte.

### H2.5 Tableau des messages

**Le livrable central, absent jusqu'ici.**

Pour chaque face de chaque support : le contenu exact, dans chaque langue, avec le pictogramme associé, la direction indiquée, le niveau d'information et la référence au point de décision qui le justifie.

C'est ce document que valide la maîtrise d'ouvrage, avant tout dessin. C'est aussi lui qui permet de vérifier la cohérence d'ensemble, ce qu'aucune relecture de maquettes ne permet.

Propriétés exigées :

- Généré depuis le graphe et le plan de jalonnement, jamais saisi.
- Exportable en tableur et en document, avec un identifiant stable par ligne.
- Versionné et soumis au même circuit de validation que les bons à tirer.
- Toute modification du graphe ou de l'annuaire marque les lignes concernées comme périmées.
- Le moteur de composition consomme le tableau des messages. Il ne résout pas le contenu directement depuis le graphe.

Cette règle est reportée dans l'invariant 2 et la section A7.2 : le tableau des messages s'intercale entre le graphe et la composition. C'est plus juste, parce que la validation porte sur le message et non sur son rendu.

### H2.6 Principes déclarés

Règles de wayfinding paramétrables par site, contrôlées automatiquement : nombre maximal de destinations par face, ordre d'énumération, traitement des destinations à faible fréquentation, règle de rappel des sanitaires et des sorties, distance maximale entre deux supports d'une même séquence.

---

## H3. Module 3, parcours clients

### H3.1 Objet

Analyse commerciale des flux. Acteur : la direction commerciale, pas le concepteur. Ce module se vend séparément et à un autre interlocuteur.

### H3.2 Contenu

- **Flux modélisés** entre les entrées et les destinations, pondérés par des hypothèses de fréquentation déclarées, jamais inventées par l'outil.
- **Exposition d'une cellule** : nombre de parcours passant devant, calculé sur le graphe. C'est une mesure objective et reproductible, ce que les appréciations d'emplacement ne sont pas.
- **Zones chaudes et froides** en découlant, avec représentation sur le plan.
- **Incidence de scénarios** : ouvrir un accès, déplacer une locomotive, fermer une liaison verticale, et comparer l'exposition avant et après.
- **Confrontation aux données réelles** quand elles existent : comptage de personnes, télémétrie des bornes, données de caisse. Importées, jamais produites par Azimut.

### H3.3 Limite à déclarer

Un modèle de flux fondé sur le graphe est une simulation, pas une mesure. L'outil affiche systématiquement les hypothèses retenues avec le résultat, et ne présente jamais un chiffre simulé comme une observation. Cette règle est de niveau bloquant : un rapport de flux sans ses hypothèses ne peut pas être exporté.

---

## H4. Module 5, régie publicitaire

Périmètre retenu : régie complète. Écrans numériques inventoriés et planifiés, sans diffusion de contenu, qui reste confiée à un système tiers.

### H4.1 Inventaire des emplacements

Un emplacement publicitaire est un objet distinct d'un support de signalétique, même s'il partage la géométrie du site.

Attributs : implantation, typologie, format, substrat, éclairage, faces, visibilité mesurée depuis le module parcours, exposition estimée, contraintes de pose, référence photographique en situation.

### H4.2 Fiche technique

Document remis à l'annonceur : cotes utiles, zone de sécurité, résolution requise, profil colorimétrique, délai de livraison des fichiers, contraintes de format. Générée, jamais rédigée à la main.

### H4.3 Planning d'occupation

Calendrier par emplacement, avec états : libre, option, réservé, occupé, en maintenance, retiré. Détection des conflits de réservation. Vue portefeuille du taux d'occupation par période, par typologie et par zone.

### H4.4 Contrats et commercialisation

- Annonceur, agence, contact, conditions commerciales.
- Contrat rattachant un ou plusieurs emplacements à une période et à un prix.
- Grille tarifaire par typologie, par zone d'exposition et par saisonnalité.
- Options avec date d'expiration automatique.
- Renouvellements et avenants tracés.

### H4.5 Facturation, et sa limite

**Azimut émet les factures et les données de vente. Azimut n'est jamais le livre comptable.**

Le module produit les factures, les échéanciers et les états de vente, et les exporte vers la comptabilité du client. Il ne tient ni grand livre, ni déclaration fiscale, ni rapprochement bancaire.

Motif : franchir cette ligne obligerait à suivre les réglementations fiscales de chaque pays de vente, qui diffèrent et évoluent. C'est un métier entier, et il n'est pas le vôtre. La limite figure au contrat.

### H4.6 Réception et contrôle des visuels

- Dépôt du fichier par l'annonceur ou son agence.
- Assainissement obligatoire, selon les règles déjà posées pour les actifs importés.
- Contrôles automatiques : format, résolution, zone de sécurité, profil colorimétrique, poids.
- Contrôles déclaratifs à valider par un humain : conformité au règlement intérieur du site, absence de contenu interdit, mentions légales.
- Circuit d'approbation, avec refus motivé et demande de nouveau fichier.

### H4.7 Rendu en situation

Le visuel reçu est composé sur la photographie ou sur la vue du plan, à l'emplacement réel et à l'échelle. C'est l'argument commercial le plus efficace face à un annonceur, et il est presque gratuit puisque la géométrie existe déjà.

### H4.8 Espace annonceur

Accès restreint permettant de consulter ses emplacements, déposer ses visuels, suivre ses validations et ses échéances. Aucun accès aux données du site ni aux autres annonceurs.

---

## H5. Module 6, enseignes locataires

### H5.1 Objet

Instruire et valider les projets de devanture des locataires au regard du règlement d'enseigne du site. Besoin quotidien d'un exploitant de centre, entièrement absent des documents précédents.

### H5.2 Contenu

- Règlement d'enseigne du site, exprimé en règles contrôlables : hauteurs, débords, matériaux, éclairage, plages horaires, interdits.
- Dépôt du dossier par le locataire : élévation, coupe, matériaux, visuel.
- Contrôles automatiques sur ce qui est mesurable, avis humain sur le reste.
- Circuit d'instruction avec avis, réserves, accord, refus motivé.
- Constat de conformité après pose, avec photographie.
- Historique par cellule, conservé au-delà du changement de locataire.

### H5.3 Articulation

Une enseigne locataire n'est pas un support Azimut : elle appartient au locataire. Elle est instruite et suivie, jamais conçue par l'outil. La distinction doit être nette dans le modèle de données comme dans l'interface.

---

## H6. Module 7, chantier et pose

### H6.1 Le vide comblé

Entre le bon à tirer approuvé et le support posé, les documents précédents ne prévoyaient rien. Or c'est la phase où se produisent les écarts que la couche de divergence détecte ensuite sans savoir d'où ils viennent.

### H6.2 Contenu

- Allotissement : répartition des supports en lots, rattachement à un fabricant.
- Ordre de fabrication, avec le carnet, les exécutions et le quantitatif du lot.
- Suivi de fabrication : commandé, en production, livré.
- Réception en usine ou sur site, avec réserves.
- Planning de pose, par zone et par date, avec contraintes d'exploitation.
- Procès-verbal de pose, par support, avec photographie et constat.
- Levée des réserves, tracée.
- Bascule automatique en support posé une fois la pose constatée, ce qui alimente la couche de divergence avec une origine connue.

---

## H7. Module 8, exploitation et maintenance

Le socle existe par la couche de divergence. Ce qui manque est l'espace de travail.

- Tournées d'inspection planifiées, avec relevé mobile hors ligne.
- Signalement d'incident sur un support, avec photographie et géolocalisation dans le plan.
- Nettoyage, remplacement de source lumineuse, reprise de fixation.
- Pièces de rechange et stock de supports de remplacement.
- Ordres de travaux, déjà prévus, reliés ici à leur origine.
- Indicateurs : taux de conformité du parc, âge moyen, coût de maintien par support.

---

## H8. Module 9, budget et estimation

- Coût unitaire par typologie, par substrat et par fabricant, historisé.
- Estimation automatique d'un carnet, depuis le quantitatif.
- Comparaison entre l'estimation, le devis reçu et le réalisé.
- Budget par phase et par lot, avec suivi de consommation.
- Coût de reprise chiffré lors d'une mutation d'occupant. Cette fonction, déjà évoquée pour l'état locatif, n'avait pas de modèle de coût derrière elle.

Multi-devises, conformément aux contraintes de marché déjà posées.

---

## H9. Module 10, portefeuille multi-sites

Un groupe gérant plusieurs sites n'a aujourd'hui aucune vue d'ensemble dans le produit.

- Vue de tous les sites d'une organisation, avec leur état de conformité, leurs anomalies bloquantes, leur taux d'occupation publicitaire.
- Comparaison entre sites sur des indicateurs communs.
- Chartes et règlements partagés, avec héritage et dérogation par site.
- Bibliothèques de gabarits et de symboles partagées.
- Consolidation budgétaire.

---

## H10. Module 11, fonctions transverses

Absentes ou implicites jusqu'ici, toutes nécessaires.

- **Documents et pièces jointes** rattachés à toute entité : cahier des charges, contrat, procès-verbal, photographie, avec versionnage.
- **Recherche globale** sur les destinations, les supports, les emplacements, les documents, respectant le cloisonnement par organisation.
- **Notifications** : anomalie bloquante nouvelle, validation attendue, échéance de contrat, réserve non levée, paquet de borne non déployé. Par courriel et dans l'application, avec réglage par utilisateur.
- **Journal d'activité visible** par l'utilisateur, distinct du journal d'audit technique.
- **Tâches et affectations** entre membres, rattachées à une entité.
- **Tableau de bord** par rôle, montrant ce qui attend l'utilisateur, jamais une collection d'indicateurs décoratifs.

---

## H11. Ajouts au modèle de données

```sql
orientation_zone     (id, org_id, site_id, code, name_fr, name_en, kind, footprint_ids jsonb)
                     kind in ('mall','entrance','core','service','outdoor')
naming_rule          (id, org_id, site_id, target, pattern, max_length,
                      uniqueness_scope, params jsonb)
                     target in ('level','zone','door','core','parking')
                     uniqueness_scope in ('site','building','level')
information_level    (id, org_id, typology_id, level int)
                     level in (1,2,3,4)
wayfinding_sequence  (id, org_id, site_id, profile_id, ordinal int, node_id,
                      expected_level int)
message_schedule     (id, org_id, site_id, version int, state, generated_at, inputs_hash)
                     state in ('draft','in_review','approved','superseded')
message_line         (id, org_id, schedule_id, support_id, face_index, block_index,
                      content jsonb, pictogram_id, direction, information_level,
                      decision_point_id, stale boolean, excluded boolean,
                      exclusion_reason jsonb)
                     direction in ('left','right','ahead','up','down','back'), nulle si aucune direction
message_schedule_approval (id, org_id, schedule_id, user_id, decision, comment,
                      decided_at, inputs_hash)
                     decision in ('approved','rejected')
-- Insertion seule. comment requis si decision = 'rejected' : c'est le motif de rejet.

flow_hypothesis      (id, org_id, site_id, name, params jsonb, declared_by, declared_at)
flow_result          (id, org_id, site_id, hypothesis_id, computed_at, results jsonb)
cell_exposure        (id, org_id, destination_id, hypothesis_id, score numeric)

ad_placement         (id, org_id, site_id, node_id, typology, format jsonb,
                      substrate, lit boolean, faces int, photo_path)
ad_placement_state   (id, org_id, placement_id, state, from_date, to_date, contract_id)
                     state in ('free','option','reserved','occupied','maintenance','withdrawn')
advertiser           (id, org_id, name, agency, contact jsonb)
ad_contract          (id, org_id, advertiser_id, reference, currency,
                      amount_minor bigint, from_date, to_date, state)
                     state in ('draft','option','lapsed','signed','ended','terminated')
ad_rate_card         (id, org_id, site_id, typology, zone_tier, season, amount_minor bigint)
ad_creative          (id, org_id, contract_id, placement_id, storage_path,
                      sanitized boolean, checks jsonb, state, submitted_at)
                     state in ('submitted','sanitization_failed','checks_failed','in_review','approved','rejected')
ad_invoice           (id, org_id, contract_id, reference, issued_at, due_at,
                      amount_minor bigint, state, exported_at)
                     state in ('draft','issued','exported','cancelled')

tenant_signage_rule  (id, org_id, site_id, kind, params jsonb)
                     kind in ('height','projection','material','lighting','hours','prohibited')
tenant_signage_case  (id, org_id, destination_id, state, submitted_at, decided_at)
                     state in ('submitted','in_review','approved','approved_with_reservations','rejected','closed')
tenant_signage_doc   (id, org_id, case_id, kind, storage_path)
                     kind in ('elevation','section','materials','visual','compliance_photo')

fabrication_lot      (id, org_id, site_id, reference, vendor_id, state)
                     state in ('draft','ordered','in_production','delivered','received','closed')
fabrication_order    (id, org_id, lot_id, issued_at, expected_at, state)
                     state in ('issued','in_production','delivered','cancelled')
installation_record  (id, org_id, support_id, lot_id, installed_at, installer,
                      photo_path, reservations jsonb, cleared_at)

inspection_round     (id, org_id, site_id, scheduled_for, performed_at, performed_by)
inspection_finding   (id, org_id, round_id, support_id, kind, photo_path, severity)
                     severity in ('critical','major','minor')
                     kind in ('damaged','dirty','lighting_failure','loose_fixing','missing','obstructed')

cost_reference       (id, org_id, typology, substrate, vendor_id,
                      unit_cost_minor bigint, currency, valid_from)
budget_line          (id, org_id, site_id, phase, planned_minor bigint,
                      committed_minor bigint, actual_minor bigint, currency)

attachment           (id, org_id, entity_kind, entity_id, storage_path,
                      kind, version int, uploaded_by, uploaded_at)
                     kind in ('contract','specification','minutes','photo','drawing','correspondence','other')
notification         (id, org_id, user_id, kind, entity_kind, entity_id,
                      created_at, read_at)
                     kind in ('blocking_anomaly','approval_requested','contract_due','reservation_open','kiosk_package_pending','kiosk_offline','incident')
```

Toutes ces tables portent `org_id` et arrivent avec leur politique de cloisonnement dans la même migration, conformément à la règle déjà posée.

---

## H12. Ajouts au catalogue des codes d'anomalie

| Code | Gravité | Sens |
| --- | --- | --- |
| `WAYFIND.NAMING_COLLISION` | bloquant | Deux entités portent le même nom d'orientation |
| `WAYFIND.CONTINUITY_BROKEN` | bloquant | Destination annoncée puis abandonnée avant d'être atteinte |
| `WAYFIND.NO_INFORMATION_LEVEL` | bloquant | Support rattaché à aucun niveau d'information |
| `WAYFIND.SCHEDULE_STALE` | avertissement | Tableau des messages périmé |
| `WAYFIND.TOO_MANY_DESTINATIONS` | bloquant | Nombre de destinations par face dépassé |
| `FLOW.HYPOTHESIS_MISSING` | bloquant | Export d'un résultat de flux sans ses hypothèses |
| `AD.PLACEMENT_DOUBLE_BOOKED` | bloquant | Conflit de réservation |
| `AD.CREATIVE_SPEC_MISMATCH` | bloquant | Visuel non conforme à la fiche technique |
| `AD.OPTION_EXPIRED` | information | Option arrivée à échéance |
| `TENANT.RULE_VIOLATION` | bloquant | Projet d'enseigne non conforme au règlement |
| `INSTALL.RESERVATION_OPEN` | avertissement | Réserve de pose non levée |
| `COST.REFERENCE_MISSING` | avertissement | Aucun coût de référence pour cette typologie |

---

## H13. Effet sur le périmètre et le phasage

Il faut regarder ce que cette partie fait au projet, sans l'atténuer.

**Le produit double de taille.** Sept modules manquants sur onze. Tout construire avant de vendre est impossible et serait une erreur.

**Ce qui doit entrer tôt, parce que le reste en dépend :** le module wayfinding, et en particulier le tableau des messages, qui s'intercale entre le graphe et la composition. L'ajouter après obligerait à reprendre le moteur de composition.

Proposition de rattachement :

| Module | Rattachement |
| --- | --- |
| Wayfinding, zonage, nomenclature, jalonnement | Incrément 1, ajout |
| Tableau des messages | Incrément 1, ajout, préalable à l'incrément 2 |
| Chantier et pose | Incrément 3, ajout |
| Exploitation, tournées et incidents | Incrément 3, ajout |
| Budget et estimation | Incrément 4 |
| Parcours clients, analyse commerciale | Incrément 5, module vendu séparément |
| Régie publicitaire | Incrément 5, module vendu séparément |
| Enseignes locataires | Incrément 5, module vendu séparément |
| Portefeuille multi-sites | Incrément 5 |
| Fonctions transverses | Réparties, documents et notifications dès l'incrément 2 |

Les trois modules d'incrément 5 s'adressent à des acheteurs différents du concepteur. C'est une bonne nouvelle commerciale, et une complication de mise en marché : trois offres, trois discours, trois cycles de vente.

**Conséquence à assumer.** Le chiffrage précédent devient caduc. La décomposition en lots de la partie G doit être reprise avec ces modules avant tout calibrage, sans quoi la mesure porterait sur un périmètre qui n'est plus le bon.

---

## H14. Ce que cette partie ne couvre pas

Historique. Cette liste ne fait plus foi. Les points encore ouverts sont repris dans le registre de la partie K, section K3, seule liste à tenir.

1. **Le nouveau chiffrage.** La décomposition de la partie G est à reprendre. Aucune durée ne doit être citée d'ici là.
2. **La question de l'offre.** Un produit unique à treize modules ou plusieurs produits vendus séparément est une décision commerciale, pas technique. Elle a des conséquences sur la facturation et sur les droits d'accès, et elle n'est pas tranchée.
3. **Les règles de calcul d'exposition.** Le principe est posé, la pondération d'un parcours par une hypothèse de fréquentation demande une méthode qui reste à établir, de préférence avec un professionnel de la commercialisation.
4. **Les obligations légales de la régie.** Mentions obligatoires, affichage des tarifs, règles de publicité applicables par pays. Non étudiées, et à traiter avec le corpus réglementaire déjà en attente.
5. **La diffusion sur écrans numériques.** Volontairement exclue. Inventaire et planning seulement, la diffusion restant confiée à un système tiers.
6. **Le relevé mobile hors ligne des tournées.** Le besoin est posé, l'application mobile qui le porterait n'est pas spécifiée et relève d'une décision de périmètre.
7. **Les essais sur usagers.** Toujours pas menés, et ils portent maintenant sur un produit deux fois plus large.

---

# PARTIE I. Atelier de dessin, transformation des plans, et résolution des points ouverts

Cette partie ajoute le module absent de la carte, décrit la chaîne de transformation d'un plan d'architecte en document fini, et traite les sept points laissés ouverts en fin de partie H.

---

## I0. Deux corrections

**Première correction.** Les capacités d'édition sont spécifiées en partie E, mais comme capacité transverse. Elles n'apparaissent donc dans aucune carte de modules et dans aucun inventaire d'écrans. Un lecteur de la carte conclut légitimement que le produit ne dessine pas. Elles deviennent le module 12.

**Seconde correction.** Aucun document ne décrit la chaîne complète qui va d'un plan d'architecte à un document fini. Les étapes existent, dispersées entre l'import, le tracé, la couche d'habillage et la composition de page. Personne ne peut les reconstituer. La chaîne est décrite en I2.

---

## I1. Module 12, atelier de dessin

### I1.1 Position dans la carte

L'atelier n'est pas un module métier de plus. C'est **la surface de travail commune** des modules 1, 2, 4, 5 et de la couche d'habillage. Il ne se vend pas séparément, il conditionne tous les autres.

Il est régi par la partie E, qui reste la référence pour les trois contextes d'édition, la quantification, le modèle de commande et la sélection accessible. Cette section ajoute ce qui manquait : les écrans, la chaîne de transformation, et le degré d'assistance.

### I1.2 Écrans

| Écran | Famille de mise en page | Objet |
| --- | --- | --- |
| Import et calage | Atelier | Poser le plan source et l'échelle |
| Qualification de fichier | Document | Rapport sur un fichier de CAO avant import |
| Tracé des empreintes | Atelier | Cellules, circulations, noyaux |
| Saisie du graphe | Atelier | Nœuds, arêtes, liaisons |
| Habillage | Atelier | Végétation, voies, mobilier, annotations |
| Composition de page | Atelier | Titre, légende, rose des vents, marges |
| Éditeur de gabarit | Atelier | Grille, zones, liaisons de blocs |
| Bibliothèques | Registre | Symboles, pictogrammes, gabarits, actifs |

---

## I2. La chaîne de transformation

Ce que personne ne pouvait reconstituer jusqu'ici : comment un plan d'architecte devient un document d'orientation fini.

### I2.1 Les sept étapes

**Étape 1, qualification de la source.** Le fichier reçu est analysé avant tout import : proportion de polylignes fermées, calques exploitables, cohérence des unités, références manquantes, doublons superposés, nombre de niveaux dans le fichier. Le rapport annonce un taux d'extraction attendu et recommande, en dessous d'un seuil, le calage manuel plutôt que l'import. Automatique.

**Étape 2, calage.** Le plan devient une référence de fond, calée sur deux points de distance connue, avec son orientation. À partir de cet instant, tout est en mètres dans le repère site. Manuel, quelques minutes.

**Étape 3, extraction ou tracé.** Sur un fichier propre, les empreintes de cellules sont extraites et proposées, puis validées ou corrigées une à une. Sur un fichier ordinaire, elles sont tracées par-dessus la référence de fond. C'est l'étape la plus longue, et c'est elle que l'assistance de I3 vise à raccourcir.

Point à ne pas oublier : un plan d'architecte contient des murs, pas des cellules. Un mur mitoyen est un seul objet là où il faut deux empreintes. Même avec une extraction parfaite, les cellules se reconstruisent.

**Étape 4, graphe.** Tracé des axes de circulation, qui produisent directement nœuds et arêtes, placement des nœuds typés, liaisons verticales, liaisons entre bâtiments. Rien de tout cela n'existe dans un plan d'architecte, puisque personne ne dessine les cheminements.

**Étape 5, rattachement métier.** L'état locatif est importé et rattaché aux empreintes par code de cellule. Les catégories, les occupants et les dénominations dans les deux langues arrivent d'un coup. C'est la charnière : à partir d'ici, le document se régénère au lieu de se redessiner.

**Étape 6, habillage.** Végétation, jardins nommés, voies et voies ferrées hors périmètre, passerelles, bâtiments voisins, logos des enseignes majeures, annotations à filet de rappel. Manuel, une fois, rarement retouché ensuite.

**Étape 7, composition.** Bloc de titre, marges, format de page. La légende et la rose des vents ne sont pas dessinées : elles sont générées depuis les catégories réellement présentes et depuis l'orientation. Seule leur position est composée.

### I2.2 Ce que produit la chaîne

À l'issue, le même modèle sort en plan de niveau coloré par catégorie, en vue isométrique cliquable, en plan mural orienté par implantation, en plan d'évacuation, en fond de borne, en carte d'exposition commerciale, en support de vente publicitaire.

Le gain n'est pas sur la première production, où le temps est comparable à un travail classique. Il est sur les suivantes, et sur l'impossibilité d'afficher une enseigne partie depuis six mois.

### I2.3 Ce qui reste manuel, définitivement

Les étapes 4, 6 et 7 relèvent du jugement, pas du calcul. Aucune automatisation n'est promise dessus, et il ne faut pas en promettre en avant-vente.

---

## I3. Assistance et automatisation

Cinq assistances, classées par ce qu'elles font réellement gagner. Aucune ne décide à la place de l'utilisateur : chacune propose, l'utilisateur valide.

**M12.AS1. Détection de contours sur référence de fond.** Sur un plan calé, détection des contours fermés et proposition d'empreintes candidates. L'utilisateur accepte, corrige ou refuse, par lot. Gain principal sur l'étape 3.

**M12.AS2. Reconnaissance de trame.** Détection d'une répétition régulière de cellules et proposition d'une duplication en série. Fréquent sur les galeries à trame constante.

**M12.AS3. Report d'un niveau à l'autre.** Copie des circulations, noyaux verticaux et éléments récurrents d'un niveau vers un autre, avec ajustement. C'est le geste le plus fréquent sur un bâtiment à plusieurs étages, et le plus fastidieux sans assistance.

**M12.AS4. Proposition d'implantation des supports.** Depuis les points de décision calculés et la hiérarchie de l'information, le système propose une implantation et une typologie par point. L'utilisateur arbitre. C'est l'assistance qui a le plus de valeur métier, parce qu'elle transforme une intuition en proposition argumentée.

**M12.AS5. Déclinaison d'une face vers une autre typologie.** Reprendre le contenu d'une face et le recomposer dans le gabarit d'une autre typologie, avec recalcul du format et des contrôles. Un totem devient un directionnel sans ressaisie.

Règle commune : toute proposition est présentée comme telle, jamais appliquée silencieusement, et son refus n'est pas redemandé.

---

## I4. Les trois références, et ce qu'on en prend

La demande porte sur les capacités de trois familles d'outils, en plus facile. Elles ne servent pas le même besoin, et prendre tout de chacune produirait un outil inutilisable.

### I4.1 De l'éditeur vectoriel de précision

| Capacité | Décision |
| --- | --- |
| Tracé de courbes, sommets, poignées | Retenu |
| Opérations booléennes | Retenu |
| Décalage parallèle | Retenu, avec sens métier |
| Alignement, répartition, groupement | Retenu |
| Calques, ordre de superposition | Retenu |
| Magnétisme, guides, grille | Retenu |
| Cotation et mesure | Retenu |
| Effets, filtres, dégradés, transparences | Écarté |
| Modes de fusion | Écarté |
| Tracé libre à main levée | Écarté |

Motif des trois écarts : un support fabriqué en découpe, en impression ou en gravure ne reproduit ni un dégradé de fusion, ni un effet. Les proposer produirait des fichiers refusés par les fabricants.

### I4.2 De l'outil de conception d'interface

C'est la famille la plus utile, et la moins évidente.

| Capacité | Traduction dans Azimut |
| --- | --- |
| Composants et variantes | Typologies et gabarits |
| Bibliothèques partagées | Bibliothèques de site et de portefeuille |
| Styles nommés | Rôles de charte, jamais de couleur directe |
| Contraintes de redimensionnement | Grille de gabarit et comportement des blocs |
| Disposition automatique des blocs | Flux de blocs et calcul de format |
| Commentaires contextuels | Revue des bons à tirer, ancrée sur la face |
| Historique de versions | Versions de support et tableau des messages |

Le commentaire ancré mérite d'être souligné : aujourd'hui, une remarque de maîtrise d'ouvrage sur un bon à tirer circule par courriel, hors du fichier. L'ancrer sur la face concernée supprime une source d'erreur quotidienne.

### I4.3 De l'outil de composition grand public

C'est de cette famille que vient la facilité d'usage, et elle est trop souvent négligée par les outils professionnels.

| Capacité | Traduction dans Azimut |
| --- | --- |
| Jamais de page blanche | Un gabarit par défaut pour chaque typologie |
| Bibliothèque de symboles prête | Symboles d'habillage et pictogrammes sectoriels |
| Guidage pas à pas | Progression explicite dans la chaîne de I2 |
| Redimensionnement vers un autre format | Déclinaison d'une face, assistance M12.AS5 |
| Aperçu permanent du résultat | Prévisualisation en situation sur le plan |

### I4.4 En quoi c'est réellement plus facile

Six mécanismes concrets, tous vérifiables, plutôt qu'une intention.

1. **On ne part jamais d'une page blanche.** Chaque typologie a son gabarit par défaut.
2. **On ne saisit pas de dimensions.** Le format se calcule depuis le contenu et la distance de lecture.
3. **On ne retape jamais un nom d'enseigne.** Le nom vient de l'annuaire, par le tableau des messages.
4. **On ne relit pas à la fin.** Les contrôles sont permanents et bloquants, au lieu d'une relecture finale qui laisse toujours passer quelque chose.
5. **On agit en série.** Une commande sur une sélection de soixante cellules, pas soixante gestes.
6. **On ne redessine pas à chaque mutation.** Un changement d'occupant régénère les supports concernés et eux seuls.

Aucun de ces six points n'existe dans les trois familles de référence, parce qu'aucune ne connaît le métier. C'est là, et pas dans la richesse de l'outillage de dessin, que se situe l'avantage défendable.

---

## I5. Résolution des points ouverts de la partie H

### I5.1 Chiffrage

La méthode de la partie G reste valable, la décomposition est à compléter. Tailles relatives des modules ajoutés, sur la même échelle.

| Module | Taille | Inconnue principale |
| --- | --- | --- |
| Wayfinding, zonage et nomenclature | M | règles de nommage par site |
| Plan de jalonnement et continuité | L | justesse métier à confronter au terrain |
| Tableau des messages | L | s'intercale dans le moteur de composition |
| Assistances M12.AS1 à M12.AS5 | XL | à découper, M12.AS1 et M12.AS4 sont des sujets à part entière |
| Chantier et pose | M | aucune |
| Exploitation, tournées et incidents | L | relevé hors ligne |
| Budget et estimation | M | multi-devises |
| Parcours clients | L | méthode d'exposition à établir |
| Régie publicitaire | XL | à découper, la facturation est un lot à part |
| Enseignes locataires | M | aucune |
| Portefeuille multi-sites | M | héritage des bibliothèques |
| Fonctions transverses | L | notifications et recherche |

Deux lots XL, donc deux lots qui n'entrent pas en développement avant d'être découpés, conformément à la règle de la partie G. Aucune durée n'est citée, et aucune ne doit l'être avant le calibrage sur quatre lots réels.

### I5.2 Question de l'offre

La décision commerciale n'est pas tranchée, mais elle peut cesser d'être bloquante. Le produit implémente un **modèle de droits par module**, qui rend les deux options possibles sans reprise ultérieure.

```sql
module_entitlement (id, org_id, site_id, module_key, state,
                    from_date, to_date, granted_by)
                   state in ('active','trial','suspended','expired')
```

Règles : un module non souscrit est absent de la navigation, jamais grisé. Les données d'un module suspendu restent lisibles en export, jamais supprimées. Les moteurs ne consultent pas les droits, seule la couche applicative le fait, afin que le cloisonnement commercial ne contamine pas le calcul.

Les deux options restent ouvertes : produit unique avec modules activables, ou offres séparées. La décision peut être prise après les premiers clients, ce qui est le bon moment.

### I5.3 Règles de calcul d'exposition

Le principe était posé sans méthode. Méthode retenue pour la première version, à valider avec un professionnel de la commercialisation.

L'exposition d'une cellule est le nombre de parcours calculés qui passent devant elle, chaque parcours étant pondéré par trois facteurs déclarés :

1. **Poids d'entrée.** Part de fréquentation attribuée à chaque accès. Déclarée, jamais devinée.
2. **Poids d'attraction.** Part de fréquentation attribuée à chaque destination motrice.
3. **Cône de visibilité.** Une cellule n'est exposée que si elle est visible depuis le cheminement, angle et distance déclarés par typologie de circulation.

Le résultat est un indice relatif entre cellules d'un même site, jamais un nombre de visiteurs. L'interface l'affiche comme un rang et un indice, avec les trois pondérations retenues visibles à côté.

Règle bloquante déjà posée, rappelée ici : un rapport de flux ne peut pas être exporté sans ses hypothèses.

### I5.4 Obligations légales de la régie

Le corpus n'est pas établi, mais le mécanisme d'accueil l'est. Les règles applicables à la publicité, mentions obligatoires, contraintes d'affichage des tarifs, catégories de produits interdites, sont portées par une **extension du paquet de règles**, avec les mêmes propriétés : enfichable, versionnée, datée, refusée si la référence documentaire manque, sans valeur de repli.

Le module de régie interroge ce paquet pour ses contrôles déclaratifs. En l'absence de paquet, il produit une anomalie et n'invente aucune règle. C'est la même position que pour le corpus des ERP.

### I5.5 Écrans numériques

Position confirmée : inventaire et planning dans Azimut, diffusion confiée à un système tiers. Ce qui manquait est le contrat d'interface, spécifié ici.

Azimut exporte, pour un emplacement numérique et une période : la liste ordonnée des visuels validés, leurs durées, leurs dates de début et de fin, et leurs empreintes. L'export est un fichier structuré déposé ou récupéré par le système tiers.

Azimut ne diffuse pas, ne pilote pas d'écran, ne mesure pas de diffusion. Il peut importer en retour un compte rendu de diffusion s'il lui est fourni, et le rapprocher du contrat.

### I5.6 Relevé mobile des tournées

Décision : **aucune application mobile native.** Le relevé se fait par une application web installable, hors ligne, réutilisant le mécanisme déjà spécifié pour le paquet de borne.

Motif : une application native ajoute deux plateformes, deux cycles de publication et deux magasins d'applications, pour un usage interne à quelques opérateurs. La contrainte réelle est le fonctionnement hors ligne, déjà résolue ailleurs dans le produit.

Périmètre du relevé : parcourir une tournée planifiée, constater l'état d'un support, photographier, signaler un incident, sans réseau, avec synchronisation différée.

### I5.7 Essais sur usagers

Aucun essai n'a été mené, et cela ne se corrige pas par de l'écriture. Ce qui se corrige est l'absence de protocole.

- **Quand.** Une session à la fin de chaque incrément, jamais à la fin du projet.
- **Qui.** Au minimum cinq participants par session, dont au moins deux extérieurs à Atlas Studio, et au moins un utilisant une technologie d'assistance.
- **Quoi.** Des tâches réelles chronométrées, pas une démonstration : modéliser un niveau depuis un plan fourni, corriger une anomalie bloquante, valider un tableau des messages, retrouver une destination sur borne.
- **Mesure.** Taux de réussite, temps par tâche, points de blocage, verbalisation.
- **Effet.** Toute tâche échouée par plus de deux participants sur cinq ouvre une anomalie de conception, traitée avant l'incrément suivant.
- **Cible prioritaire.** Le temps de mise en service d'un site, indicateur économique central du produit.

---

## I6. Ajouts au catalogue des codes d'anomalie

| Code | Gravité | Sens |
| --- | --- | --- |
| `ASSIST.PROPOSAL_REJECTED` | information | Proposition d'assistance refusée, non redemandée |
| `ASSIST.EXTRACTION_BELOW_THRESHOLD` | avertissement | Taux d'extraction insuffisant, calage manuel recommandé |
| `MODULE.NOT_ENTITLED` | bloquant | Module non souscrit |
| `FLOW.WEIGHTS_UNDECLARED` | bloquant | Calcul d'exposition sans pondérations déclarées |
| `AD.RULES_PACK_MISSING` | bloquant | Aucun paquet de règles publicitaires rattaché |
| `SURVEY.SYNC_PENDING` | information | Relevé de tournée non synchronisé |

---

## I7. Ce qui reste ouvert

Historique. Cette liste ne fait plus foi. Les points encore ouverts sont repris dans le registre de la partie K, section K3, seule liste à tenir.

Court, et chaque point est désormais contenu plutôt que béant.

1. **Les durées.** Méthode établie, décomposition complétée, calibrage non fait. Aucune durée ne doit être citée.
2. **Le découpage des deux lots XL.** Assistances et régie publicitaire. À faire avant leur entrée en développement.
3. **La validation de la méthode d'exposition.** Défendable, non validée par un professionnel de la commercialisation.
4. **Le corpus réglementaire publicitaire.** Mécanisme prêt, contenu absent, comme pour les ERP.
5. **Les essais sur usagers.** Protocole établi, essais non menés. C'est le seul point de cette liste qui puisse invalider des décisions de conception déjà prises.

---

# PARTIE J. Saisie au stylet, esquisse, pictogrammes et bibliothèques

Cette partie ajoute la saisie à l'encre, l'esquisse, l'annotation en révision, l'éditeur de pictogrammes et l'organisation des bibliothèques.

---

## J0. Le principe qui rend tout cela possible

**L'encre est une méthode de saisie, pas une donnée.**

Ce qui est enregistré n'est jamais le trait tel qu'il a été tracé. C'est la forme reconnue, quantifiée au millimètre, identique à ce qu'aurait produit un glisser à la souris. Le tracé disparaît une fois la forme acceptée.

Cette règle unique préserve l'invariant 4 sur le déterminisme, tout en ouvrant l'ensemble des gestes demandés. Un polygone de cellule tracé au stylet et le même polygone tracé à la souris produisent des données strictement identiques, donc des rendus identiques.

Deux exceptions, où l'encre reste de l'encre parce que c'est justement son intérêt : la couche d'esquisse (J3) et l'annotation en révision (J4). Ces deux couches ne participent à aucun calcul et ne sortent jamais dans un livrable de fabrication.

### J0.1 Correction d'une décision antérieure

La partie G écartait la pression et l'inclinaison du stylet, au motif qu'elles introduiraient une variabilité contraire au déterminisme.

**Cette exclusion est levée pour la seule couche d'esquisse.** La pression y module l'épaisseur et l'opacité d'un trait qui n'est jamais converti en donnée métier, jamais mesuré et jamais fabriqué. Le déterminisme n'est donc pas en cause.

Elle est maintenue partout ailleurs : la pression n'a aucun effet sur un tracé destiné à devenir une empreinte, une arête ou un pictogramme.

L'exclusion du tracé libre au doigt, elle, est maintenue intégralement. La précision requise ne s'obtient pas au doigt, et proposer une fonction imprécise vaut moins que ne pas la proposer.

---

## J1. Saisie à l'encre et reconnaissance de forme

### J1.1 Cycle d'une saisie

Quatre temps, toujours les mêmes :

1. **Tracé.** Le trait apparaît tel quel, sans correction pendant le geste. Corriger en cours de tracé rend le geste imprévisible et donne le sentiment de lutter contre l'outil.
2. **Reconnaissance.** À la levée du stylet, la forme est analysée et une ou plusieurs candidates sont proposées.
3. **Arbitrage.** La candidate la plus probable est appliquée, les autres sont accessibles en un geste. Le tracé d'origine reste visible en filigrane tant que l'arbitrage n'est pas clos.
4. **Quantification.** La forme retenue est quantifiée au millimètre et devient une donnée ordinaire.

Le refus d'une candidate n'est jamais redemandé pour le même geste.

### J1.2 Formes reconnues

| Geste | Résultat |
| --- | --- |
| Trait presque droit | Segment droit |
| Trait presque horizontal ou vertical | Segment contraint sur l'axe |
| Trait proche d'un angle remarquable | Segment aligné sur l'angle |
| Suite de traits fermée | Polygone, sommets redressés |
| Rectangle approximatif | Rectangle, angles droits |
| Cercle ou ovale approximatif | Ellipse, cercle si proche |
| Trait rejoignant deux formes | Arête du graphe entre deux nœuds |
| Point appuyé | Nœud, du type actif dans la barre d'outils |
| Trait barrant une forme | Suppression de la forme |
| Boucle autour de plusieurs formes | Sélection de ces formes |

### J1.3 Redressement

Le redressement s'applique à la forme entière, pas segment par segment. Un contour de cellule tracé d'un geste continu produit un polygone dont tous les sommets sont redressés ensemble, et dont les angles proches de l'angle droit le deviennent.

Seuils de tolérance déclarés en constantes nommées, réglables : écart angulaire admis pour redresser sur un axe, écart admis pour fermer un contour, écart admis pour aligner deux sommets. Ces seuils sont des paramètres d'ergonomie, jamais des valeurs normatives.

L'intensité du redressement est réglable sur trois niveaux, du plus strict au plus permissif, et le niveau retenu est mémorisé par utilisateur. La donnée produite ne dépend jamais du niveau choisi une fois la forme acceptée : elle est toujours quantifiée au millimètre.

### J1.4 Calque et décalque

Le plan de référence calé sert de fond de décalque. Trois réglages : opacité du fond, affichage ou masquage des formes déjà tracées, verrouillage du fond pour éviter de le déplacer par mégarde.

Combiné à l'assistance de détection de contours déjà spécifiée, le décalque au stylet est le mode de travail le plus rapide sur un plan de qualité moyenne, qui est le cas courant.

### J1.5 Gestes de service

Deux doigts pour déplacer et zoomer pendant que le stylet dessine, sans changer d'outil. Appui long pour le menu contextuel. Rejet de la paume actif dès qu'un stylet est détecté, tout contact tactile étant alors ignoré.

Bouton latéral du stylet, s'il existe : gomme. Retournement du stylet, si le matériel le signale : gomme également.

---

## J2. Ce que la reconnaissance ne fait pas

À dire clairement, parce que c'est ce qui déçoit dans les outils de ce genre.

- Elle ne devine pas la nature métier d'une forme. Un contour tracé devient une empreinte parce que l'outil actif est celui des empreintes, jamais parce que le système a compris l'intention.
- Elle ne reconstruit pas un plan entier à partir d'un gribouillage.
- Elle ne reconnaît pas l'écriture manuscrite pour en faire du texte de support. La reconnaissance d'écriture est admise dans la seule couche d'annotation, où l'exactitude n'engage rien.
- Elle ne corrige pas rétroactivement une forme déjà acceptée. Une correction est une nouvelle commande, tracée dans l'historique.

---

## J3. Couche d'esquisse

### J3.1 Objet

Réfléchir sur le plan avant de modéliser. Repérer une zone, esquisser une implantation, annoter une intention, comparer deux idées.

C'est la seule couche où le trait est conservé tel quel.

### J3.2 Outils

Crayon, feutre, marqueur translucide, gomme. Palette de couleurs propre à l'esquisse, sans aucun rapport avec les jetons d'interface ni avec les chartes clients, précisément pour qu'une esquisse ne puisse jamais être confondue avec un contenu validé.

La pression module l'épaisseur et l'opacité. L'inclinaison, si le matériel la signale, module la largeur du marqueur.

### J3.3 Règles

- Une esquisse n'est jamais quantifiée, jamais convertie automatiquement, jamais mesurée.
- Elle ne participe à aucun calcul : ni parcours, ni couverture, ni quantitatif, ni zone cliquable.
- Elle n'apparaît dans aucun livrable de fabrication, dans aucun paquet de borne, dans aucun export destiné à un tiers. Contrôle automatisé sur les exports.
- Elle peut être promue : entourer une esquisse et demander sa conversion produit une forme reconnue, arbitrée et quantifiée comme n'importe quelle saisie. La promotion est explicite, jamais automatique.
- Une esquisse porte son auteur et sa date, et peut être masquée par calque.

### J3.4 Modèle de données

```sql
sketch_layer   (id, org_id, site_id, level_id, name, owner_id,
                visible boolean, locked boolean, created_at)
sketch_stroke  (id, org_id, layer_id, tool, color, width_base_m,
                points jsonb, created_at)
```

`points` conserve le tracé échantillonné avec sa pression. C'est la seule donnée non quantifiée du produit, et elle est cantonnée à cette table.

---

## J4. Annotation en révision

Distincte de l'esquisse, et distincte de l'annotation d'habillage qui, elle, est imprimée.

Objet : porter une remarque de relecture sur une face, un support ou une zone du plan, dans le circuit de validation des bons à tirer et du tableau des messages.

- Annotation ancrée sur l'entité concernée, jamais flottante.
- Rédigée au clavier ou tracée au stylet, avec reconnaissance d'écriture proposée et corrigeable.
- États : ouverte, traitée, refusée. Une annotation ouverte bloque la clôture d'une revue.
- Auteur, date, fil de réponses.
- N'apparaît jamais dans un livrable.

Ce mécanisme remplace la circulation des remarques par courriel, hors du fichier, qui est aujourd'hui une source d'erreur quotidienne.

---

## J5. Éditeur de pictogrammes

### J5.1 La frontière

Deux registres, déjà posés en partie A, appliqués ici sans exception.

**Registre de sécurité.** En lecture seule absolue. Les pictogrammes proviennent du paquet de règles, versionnés et référencés. Aucune création, aucune modification, aucune recoloration, aucune déformation, aucun recadrage. Le moteur refuse l'opération et lève une erreur.

Motif à porter en argument commercial plutôt qu'en contrainte : un pictogramme de sécurité redessiné, même mieux dessiné, n'est plus conforme. Un outil qui l'interdit protège son utilisateur.

**Registre d'orientation.** Création et modification libres. C'est ici que l'éditeur travaille.

### J5.2 Éditeur

Tracé au stylet ou à la souris, avec la reconnaissance de forme de J1. Outils : formes, courbes, opérations booléennes, alignement, miroir, grille de construction.

Contraintes appliquées automatiquement :

- Grille de construction et zone de sécurité déclarées, pour que les pictogrammes d'une même famille soient optiquement cohérents.
- Épaisseur de trait unique par famille, ou aplat plein, jamais les deux mélangés.
- Vectoriel exclusivement. Aucune image en mode point acceptée, le contrôle existe déjà.
- Une seule couleur par défaut, la couleur étant appliquée à l'usage par le rôle de charte, jamais figée dans le pictogramme.
- Prévisualisation à la taille réelle et à la distance de lecture déclarée, ce qu'aucun éditeur graphique généraliste ne propose et qui est le vrai apport ici.
- Contrôle de lisibilité en négatif et en niveaux de gris.

### J5.3 Compréhensibilité

Un pictogramme créé n'a aucune garantie d'être compris. La norme d'essai de compréhensibilité déjà citée au cahier des charges principal s'applique.

Le produit porte donc, pour chaque pictogramme du registre d'orientation, un état de validation : non testé, testé, taux de compréhension mesuré, date. Un pictogramme non testé peut être utilisé, mais l'état est visible et figure dans le rapport d'audit.

Le produit n'organise pas les essais. Il enregistre leur résultat et le rend opposable.

### J5.4 Modèle de données

```sql
pictogram_family (id, org_id, name, grid jsonb, stroke_width_pct numeric,
                  safe_area jsonb, style)
-- pictogram : définition unique en section A5.4.
```

Contrainte en base : toute ligne de `registry = 'safety'` a `source = 'rules_pack'` et est en lecture seule pour toute organisation.

---

## J6. Bibliothèques

### J6.1 Trois étages, jamais mélangés

**Étage 1, registre de sécurité.** Fourni par le paquet de règles, versionné, verrouillé, non duplicable en tant que tel. Un site en hérite par son rattachement à un paquet.

**Étage 2, bibliothèques fournies.** Pictogrammes d'orientation et symboles d'habillage livrés avec le produit, organisés par secteur : commerce, santé, transport, enseignement, tertiaire. Non modifiables directement. Une modification passe par duplication dans l'étage 3, ce qui préserve la référence d'origine et permet de mesurer l'écart.

**Étage 3, bibliothèques d'organisation.** Créations propres, duplications modifiées, actifs importés. Partageables sur le portefeuille multi-sites, avec héritage et dérogation par site.

La règle de non-mélange est structurante : à tout instant, l'origine d'un symbole est connue, et un audit peut dire lesquels sont normalisés, lesquels sont fournis, lesquels sont maison.

### J6.2 Contenu des bibliothèques

- Pictogrammes d'orientation, par famille.
- Symboles d'habillage : végétation, mobilier, véhicules, silhouettes, éléments de voirie.
- Gabarits de faces.
- Actifs importés : logos d'enseignes, images de marque, assainis selon les règles déjà posées.
- Palettes et rôles de charte.

### J6.3 Fonctions attendues

Recherche par nom, par catégorie et par mot-clé dans les deux langues. Étiquetage libre. Prévisualisation à taille réelle. Détection de doublons à l'import. Remplacement global d'un symbole par un autre sur un site, avec compte des occurrences avant application. Versionnage d'un symbole, avec régénération des supports qui l'emploient.

### J6.4 Ce qui n'est pas fourni

Aucune image photographique, aucune illustration décorative, aucun contenu sous licence tierce. Le produit fournit des symboles fonctionnels, pas une banque d'images. Fournir des visuels sous licence exposerait Atlas Studio à une responsabilité qu'il ne maîtrise pas, et ce n'est pas le métier.

---

## J7. Effet sur les parties antérieures

| Décision antérieure | Effet |
| --- | --- |
| Pression et inclinaison du stylet écartées | Levée pour la seule couche d'esquisse, maintenue ailleurs |
| Tracé libre au doigt exclu | Maintenu intégralement |
| Aucune donnée non quantifiée | Une exception, cantonnée à la table des tracés d'esquisse |
| Bibliothèque de symboles d'habillage | Étendue et réorganisée en trois étages |
| Registre de sécurité verrouillé | Inchangé, renforcé par l'éditeur |
| Annotation d'habillage | Distinguée de l'annotation de révision, qui est nouvelle |

---

## J8. Ajouts au catalogue des codes d'anomalie

| Code | Gravité | Sens |
| --- | --- | --- |
| `INK.SHAPE_NOT_RECOGNIZED` | information | Aucune forme candidate, tracé conservé en esquisse |
| `SKETCH.IN_DELIVERABLE` | bloquant | Couche d'esquisse présente dans un export destiné à un tiers |
| `REVIEW.ANNOTATION_OPEN` | bloquant | Annotation de révision non traitée à la clôture |
| `PICTO.SAFETY_EDIT_DENIED` | bloquant | Modification d'un pictogramme du registre de sécurité |
| `PICTO.UNTESTED` | information | Pictogramme d'orientation non soumis à essai de compréhension |
| `PICTO.FUNCTION_NOT_DESIGNATED` | avertissement | Aucun pictogramme ne porte la fonction demandée. Le rendu omet la marque et le signale, il n'en dessine jamais une autre |
| `PICTO.FUNCTION_AMBIGUOUS` | bloquant | Deux pictogrammes d'un même registre portent la même fonction sur un site |
| `PICTO.RASTER_CONTENT` | bloquant | Image en mode point dans un pictogramme |
| `PICTO.FAMILY_INCONSISTENT` | avertissement | Épaisseur ou grille incohérente avec la famille |
| `LIBRARY.DUPLICATE_ON_IMPORT` | avertissement | Symbole déjà présent dans la bibliothèque |

---

## J9. Rattachement aux tâches

| Élément | Rattachement |
| --- | --- |
| Saisie à l'encre et reconnaissance de forme | Incrément 1, extension de l'atelier |
| Décalque et réglages de fond | Incrément 1, avec l'import et le calage |
| Couche d'esquisse | Incrément 1 |
| Annotation de révision | Incrément 2, avec le circuit des bons à tirer |
| Éditeur de pictogrammes | Incrément 2 |
| Trois étages de bibliothèque | Incrément 2, partage portefeuille en incrément 5 |
| État de compréhensibilité | Incrément 2, visible au rapport d'audit |

La reconnaissance de forme est un lot de taille L, à découper. Elle n'est pas un préalable au produit : l'atelier fonctionne à la souris sans elle, et elle s'ajoute comme méthode de saisie supplémentaire. Cet ordre protège le calendrier.

---

## J10. Ce qui reste ouvert

Historique. Cette liste ne fait plus foi. Les points encore ouverts sont repris dans le registre de la partie K, section K3, seule liste à tenir.

1. **Les seuils de reconnaissance.** Écart angulaire, tolérance de fermeture, tolérance d'alignement. Valeurs de départ à établir, puis à régler sur usagers réels. C'est le paramètre qui décide si la fonction est agréable ou exaspérante, et il ne se choisit pas au bureau.
2. **La méthode de reconnaissance.** Plusieurs approches existent, de la géométrie simple à l'apprentissage. Le choix relève de la procédure d'arrêt et de demande, avec une contrainte ferme : la sortie doit être déterministe et explicable, ce qui écarte toute méthode dont le résultat varierait d'une version à l'autre.
3. **La reconnaissance d'écriture.** Admise dans la seule annotation. La solution technique n'est pas choisie, et une solution fonctionnant hors ligne est préférable, conformément aux contraintes de marché.
4. **Le volume des bibliothèques fournies.** Cinq secteurs annoncés, contenu non défini. C'est un travail de conception graphique, pas de développement, et il doit être chiffré séparément.
5. **Les essais de compréhensibilité.** Le produit enregistre leur résultat, il ne les organise pas. Qui les mène et à quelle fréquence reste à décider.

---

# PARTIE K. Registre consolidé des points ouverts

Cette partie consolide les huit listes de points ouverts dispersées dans les documents précédents (chapitre C5 du cahier des charges principal, puis D18, E19, F19, G10, H14, I7 et J10). Elle les remplace : à compter de cette version, le registre ci-dessous est la seule liste à tenir.

---

## K0. Ce que la consolidation révèle

Les huit listes comptent 47 entrées pour 31 sujets distincts.

Les essais sur usagers apparaissent quatre fois, le chiffrage trois fois, le corpus réglementaire trois fois, les licences de polices deux fois. Les documents se répétaient au lieu de s'accumuler, ce qui donnait l'impression d'un nombre de points ouverts supérieur à la réalité.

Par ailleurs, neuf entrées avaient déjà été résolues par un document postérieur sans que la liste d'origine soit mise à jour. Elles figuraient donc comme ouvertes alors qu'elles ne l'étaient plus.

Classement des 31 sujets par nature :

| Nature | Nombre | Ce qui les ferme |
| --- | --- | --- |
| Déjà résolus, liste non mise à jour | 9 | Rien, ils sont clos |
| Décidables maintenant | 7 | Ce document |
| Mesurables, demandent un essai technique | 5 | Une expérimentation bornée |
| Juridiques ou documentaires | 5 | Un tiers qualifié |
| Demandent des usagers réels | 3 | Des sessions d'essai |
| Commerciaux | 2 | Des rendez-vous de vente |

---

## K1. Points déjà résolus, et par quoi

Ces neuf sujets sont clos. Ils ne doivent plus figurer dans aucune liste.

| Sujet | Source | Résolu par |
| --- | --- | --- |
| Format d'échange des bornes | D18 | Profil de conformité matérielle, qui inverse la dépendance au fournisseur |
| Tolérance d'accrochage à la saisie | D18 | Tolérances par type de pointeur, partie G |
| Saisie tactile et stylet | E19 | Partie G, puis partie J pour l'encre |
| Édition simultanée | E19 | Exclue définitivement, présence et verrou consultatif à la place |
| Conversion colorimétrique exacte | E19 | Chaîne colorimétrique, partie G, référence faisant foi |
| Reprise des fichiers graphiques clients | E19 | Import en référence de fond, non-promesse assumée |
| Question de l'offre | H14 | Droits par module, qui laisse les deux options ouvertes |
| Diffusion sur écrans numériques | H14 | Exclue, contrat d'interface avec un système tiers spécifié |
| Relevé mobile des tournées | H14 | Application web installable hors ligne, pas d'application native |

---

## K2. Points résolus par ce document

Sept décisions, prises ici, qui ferment sept sujets.

### K2.1 Occultations sur empreintes recoupées

Source : D18. La limite reste réelle, mais elle cesse d'être subie.

**Décision.** L'algorithme de tri par profondeur est conservé tel quel. Un attribut `render_order` est ajouté à la table des volumes, saisissable par l'utilisateur, nul par défaut. Quand il est renseigné, il prime sur le tri calculé.

L'anomalie d'empreintes superposées passe d'information à avertissement, et propose la saisie d'un ordre manuel. Le cas cesse ainsi de produire un rendu faux sans recours, sans imposer un découpage de volumes hors périmètre.

### K2.2 Méthode de reconnaissance de forme

Source : J10.

**Décision.** Reconnaissance géométrique exclusivement. Aucune méthode par apprentissage.

Motif : l'invariant 4 impose un résultat déterministe et explicable. Un modèle appris change de comportement d'une version à l'autre, ne s'explique pas ligne à ligne et rendrait les empreintes de non-régression instables. La reconnaissance géométrique couvre la totalité des gestes du tableau de la partie J.

### K2.3 Reconnaissance d'écriture manuscrite

Source : J10.

**Décision.** Retenue uniquement si une solution fonctionnant entièrement hors ligne existe, cantonnée à l'annotation de révision. À défaut, la fonction est abandonnée, sans recherche d'un substitut en ligne.

Motif : la contrainte de connectivité irrégulière prime, et l'annotation reste utilisable en saisie clavier. Une fonction qui ne marche qu'avec du réseau sur un marché où le réseau manque n'a pas de valeur.

### K2.4 Volume des bibliothèques fournies

Source : J10.

**Décision.** Minimum par secteur à la première mise en marché : 40 pictogrammes d'orientation et 25 symboles d'habillage, pour les cinq secteurs annoncés.

Ce travail est un lot de conception graphique, chiffré et commandé séparément du développement. Il ne consomme pas de temps d'ingénierie et peut être mené en parallèle.

### K2.5 Facteur de lisibilité de l'exemple de règle

Source : D18. Ce n'était pas un point ouvert mais une règle permanente mal classée.

**Clarification.** Toute valeur numérique figurant dans un exemple de format de ce cahier des charges est un exemple de forme. Aucune ne doit être reprise comme valeur normative. La règle est permanente et sort du registre.

### K2.6 Largeur minimale de poste

Source : F19.

**Décision.** La valeur de 1366 pixels est conservée, étant déduite de la règle de proportion de la zone de travail. Sa confrontation au terrain se fait lors des sessions d'essai sur usagers, par simple relevé du matériel des participants. Aucune collecte automatisée, aucune donnée personnelle.

Le sujet cesse d'être un point ouvert et devient une observation à faire.

### K2.7 Écrans des modules ajoutés

Source : F19.

**Décision.** Ils sont inventoriés et rattachés à trois familles de mise en page. Chacun sera spécifié au moment d'entrer dans son incrément, jamais avant.

C'est une règle de méthode, pas une dette. Spécifier aujourd'hui un écran qui sera construit dans deux ans produit un texte réécrit avant d'être lu.

---

## K3. Registre des points qui ne se ferment pas par écrit

Quinze sujets. Chacun porte un responsable, un déclencheur et un niveau de blocage.

Niveaux de blocage : **P** bloque avant la première ligne de code, **V** bloque avant la première vente, **L** bloque avant la première livraison, **S** surveillé, sans blocage.

### K3.1 Études et documentation

| Sujet | Responsable | Déclencheur | Niveau |
| --- | --- | --- | --- |
| Corpus réglementaire ERP par pays | Expert normatif externe | Avant tout paquet de règles | P |
| Millésimes des normes citées | Expert normatif externe | Avec l'étude ci-dessus | P |
| Corpus réglementaire publicitaire | Expert normatif externe | Avant le module de régie | L |
| Standard de transcription braille | Expert normatif externe | Avant la chaîne tactile | L |
| État de l'offre concurrente | Atlas Studio | Avant tout engagement | P |

Le mécanisme d'accueil de ces corpus est prêt et testé. En leur absence, le produit refuse de composer plutôt que d'inventer, ce qui est le comportement correct. Le blocage porte sur la mise en marché, pas sur le développement du socle.

### K3.2 Questions juridiques

| Sujet | Responsable | Déclencheur | Niveau |
| --- | --- | --- | --- |
| Licences des polices incorporées | Conseil juridique | Avant incorporation dans un livrable distribué | L |
| Licence des données de nuanciers | Position arrêtée, aucune table fournie | Permanent | S |
| Disponibilité du nom Azimut | Conseil en propriété industrielle | Avant toute communication publique | V |
| Origine du code et des données réutilisés | Conseil juridique | Avant la première ligne de code | P |
| Obligations légales de la régie | Conseil juridique par pays | Avant le module de régie | L |

Le sujet le plus sous-estimé de cette liste est la disponibilité du nom. Un nom déjà déposé rend inutilisable tout ce qui aura été construit autour, y compris le signe, le site et les documents commerciaux.

### K3.3 Expérimentations techniques

| Sujet | Responsable | Déclencheur | Niveau |
| --- | --- | --- | --- |
| Déterminisme de la sortie PDF | Développement | Tâche T-0.9, avant l'incrément 2 | P |
| Cloisonnement sur agrégats et jointures profondes | Développement | Incrément 0, test empirique | P |
| Support réel du format d'échange de graphe | Développement | Avant de le promettre | S |
| Budget de rendu et tolérances de pointeur | Développement | Premier site réel modélisé | S |
| Seuils de reconnaissance de forme | Développement puis usagers | Avec les sessions d'essai | S |

Ces cinq sujets se ferment par une expérimentation bornée dans le temps, dont le livrable est une note, pas du code. Deux d'entre eux bloquent avant le développement parce qu'ils peuvent remettre en cause un choix de socle.

### K3.4 Essais sur usagers

Un seul sujet, qui figurait sous quatre formes différentes.

| Sujet | Responsable | Déclencheur | Niveau |
| --- | --- | --- | --- |
| Sessions d'essai sur usagers réels | Atlas Studio | Fin de chaque incrément | L |

Le protocole est établi en partie I : cinq participants minimum par session, dont deux extérieurs et un utilisant une technologie d'assistance, tâches réelles chronométrées, toute tâche échouée par plus de deux participants sur cinq ouvrant une anomalie de conception.

Ce qui s'y joue, et qui n'est pas un détail : la densité d'interface retenue, l'exclusion du tracé libre au doigt, les seuils de reconnaissance et le temps de mise en service d'un site. Ce sont quatre décisions déjà prises que ces sessions peuvent invalider.

### K3.5 Essais de compréhensibilité des pictogrammes

| Sujet | Responsable | Déclencheur | Niveau |
| --- | --- | --- | --- |
| Organisation des essais de compréhension | Client, non Atlas Studio | Avant fabrication d'un pictogramme maison | S |

Position confirmée : le produit enregistre le résultat et le rend opposable en audit, il n'organise pas les essais. La responsabilité reste au maître d'ouvrage.

### K3.6 Sujets commerciaux

| Sujet | Responsable | Déclencheur | Niveau |
| --- | --- | --- | --- |
| Seuils de viabilité, prix, volume, cycle de vente | Atlas Studio | Avant tout engagement de construction | P |
| Validation de la méthode d'exposition | Professionnel de la commercialisation | Avant de vendre un audit chiffré | V |

Ces deux sujets ne se ferment ni par une étude ni par du code. Ils se ferment en allant vendre.

### K3.7 Chiffrage

| Sujet | Responsable | Déclencheur | Niveau |
| --- | --- | --- | --- |
| Durées et charge | Atlas Studio | Après calibrage sur quatre lots réels | S |
| Découpage des lots de taille XL | Atlas Studio | Avant leur entrée en développement | S |

Rappel de la règle, qui n'a jamais changé : aucune durée ne doit être citée avant le calibrage, et aucun lot de taille XL n'entre en développement avant d'être découpé. Les deux lots concernés sont les assistances de tracé et la régie publicitaire.

### K3.8 Points ajoutés après la première consolidation

Points ouverts par les parties L à Q, qui n'avaient pas été inscrits ici.

| Sujet | Responsable | Déclencheur | Niveau |
| --- | --- | --- | --- |
| Mécanisme technique des événements, file ou notification | Développement, procédure d'arrêt et de demande | Avant la première chaîne de propagation | S |
| Droits de chaque rôle, module par module | Atlas Studio | À l'entrée de chaque module | S |
| Libellés des codes d'anomalie en français et en anglais | Rédaction par le développement, relecture par Atlas Studio | Avec la première utilisation de chaque code | S |
| Quatre parcours d'usage restant à auditer : annonceur, locataire, fabricant, visiteur | Atlas Studio | Avant l'incrément 3 | S |
| Connecteurs vers les systèmes de fidélité existants | Développement | À la demande d'un client | S |
| Valeur probante de l'approbation électronique | Conseil juridique | Avant la première approbation par un tiers | L |
| Choix du prestataire de paiement | Atlas Studio | Avant la première facture d'abonnement | V |
| Durées de conservation, préavis de fin de contrat, rotation des sauvegardes | Conseil juridique | Avant le premier contrat | V |
| Loi de protection des données applicable par pays et déclaration auprès de l'autorité de contrôle | Conseil juridique | Avant la première inscription réelle | L |
| Âge minimal d'inscription au programme de fidélité | Conseil juridique | Avant l'option fidélité | L |
| Clause de sous-traitance des données entre Atlas Studio et le site | Conseil juridique | Avant le premier contrat avec l'option fidélité | V |
| Articulation du mode urgence avec le système de sécurité incendie | Bureau de contrôle du site | Avant tout déploiement de bornes | L |
| Taux de taxe par pays et par nature de prestation | Conseil fiscal | Avant la première facture | V |
| Correspondance des pays vers les devises, et exposant de chaque devise, avec leur source documentaire et ses conditions de réutilisation | Atlas Studio | Avant la première facture | V |
| Format d'export de géométrie vers les outils de conception assistée, section S5 | Développement, procédure d'arrêt et de demande | Avant le premier export de géométrie | S |
| Accès de livraison et portails véhicules : objets, attributs et usages. Retirés du modèle faute d'usage, à reprendre quand la livraison entrera au produit | Atlas Studio | À l'entrée des accès de livraison | S |
| Grille de construction des pictogrammes présente à deux endroits, attribut déclaré de la famille et valeur écrite dans le moteur de composition. Deux sources pour une même valeur finissent par diverger | Développement | À la prochaine tâche touchant la composition de face | S |
| Poids du paquet du studio, au-dessus du seuil d'avertissement de l'outil de construction. Sujet réel sur une connexion médiocre, qui est le cas courant des marchés visés | Développement | Avant la première mise en service chez un client | S |
| Fournisseur et nature du modèle de l'assistant, compatibles avec la traçabilité de la section S7.2 | Atlas Studio | Avant l'incrément 5 | S |
| Régime juridique des données transmises à l'assistant : sous-traitance, localisation, conservation | Conseil juridique | Avant toute activation réelle de l'assistant | L |
| Coût d'usage de l'assistant et modèle de facturation associé | Atlas Studio | Avant la mise en marché de l'option | S |
| Délais et formes de notification d'une violation de données, par pays | Conseil juridique | Avant la première donnée personnelle réelle | L |
| Destinataires d'alerte et astreinte | Atlas Studio | Avant le premier client en production | L |

### K3.9 Points fermés depuis la consolidation

| Sujet | Fermé par |
| --- | --- |
| Spécification au champ près de l'écran du tableau des messages | Partie R, avec quatre décisions reportées en F5bis.3, N2.2, H11, A5.6, D11 et règle M02.W11 |
| Calage à n points avec résidu mesuré | Adopté et spécifié en section M2 |

---

## K4. Les préalables absolus

Extraits du registre, par jalon. C'est la seule liste à tenir sous les yeux.

### Avant la première ligne de code, sept préalables

1. Seuils de viabilité commerciale confrontés au terrain.
2. Étude concurrentielle documentée.
3. Corpus réglementaire ERP établi, au moins pour une juridiction.
4. Millésimes des normes confirmés.
5. Origine du code et des données réutilisés réglée par écrit.
6. Déterminisme de la sortie PDF démontré.
7. Cloisonnement sur agrégats et jointures profondes validé empiriquement.

Les deux derniers peuvent être menés comme premières tâches de l'incrément 0, les cinq premiers non.

### Avant la première vente

1. Disponibilité du nom vérifiée.
2. Méthode d'exposition validée par un professionnel de la commercialisation, si un audit chiffré est vendu.
3. Clause de sous-traitance des données rédigée, si l'option fidélité est vendue.
4. Durées de conservation et préavis de fin de contrat arrêtés.
5. Prestataire de paiement choisi.
6. Taux de taxe établis pour les pays de vente.

### Avant la première livraison

1. Licences des polices incorporées vérifiées.
2. Standard de transcription braille établi, si la chaîne tactile est livrée.
3. Corpus publicitaire établi, si le module de régie est livré.
4. Une session d'essai sur usagers menée.
5. Loi de protection des données et déclaration établies, si l'option fidélité est livrée.
6. Articulation du mode urgence validée par le bureau de contrôle, si des bornes sont livrées.
7. Procédure de violation de données écrite et testée.
8. Destinataires d'alerte et astreinte désignés.

---

## K5. Tenue du registre

- Ce registre remplace les huit listes antérieures. Les sections C5, D18, E19, F19, G10, H14, I7 et J10 ne sont plus tenues à jour et ne font plus foi.
- Un point ouvert nouveau s'ajoute ici, avec sa nature, son responsable, son déclencheur et son niveau de blocage. Un point sans responsable n'est pas un point ouvert, c'est un souhait.
- Un point se ferme par une décision écrite ou par un livrable, jamais par oubli.
- Le registre est relu à chaque fin d'incrément. Un point ouvert depuis plus de deux incréments sans mouvement est soit requalifié en décision, soit abandonné explicitement.

---

## K6. Ce qui reste, après tout

Deux choses, et elles ne sont pas de même nature.

**La première est mesurable.** Quinze sujets, tous avec un responsable et un déclencheur. Aucun n'est mystérieux, aucun ne demande une percée technique. Ils demandent des études, des avis et des essais, c'est-à-dire du temps et un peu d'argent.

**La seconde ne figure dans aucun registre.** Ce produit repose aujourd'hui sur une seule personne, qui en détient la méthode et qui exerce par ailleurs des fonctions de direction à temps plein. Aucune partie de ce cahier des charges ne corrige cela, et les quinze sujets ci-dessus se ferment d'autant plus lentement.

C'est le seul point ouvert qui ne se résout ni par une étude, ni par du code, ni par une décision écrite.

---

# PARTIE L. Fiches de modules et modèle d'intégration

Cette partie complète la partie H, qui décrivait le contenu des modules sans dire qui possède quelle donnée ni comment les modules se parlent.

---

## L0. Le cycle de dépendance trouvé, et sa résolution

En établissant la carte d'intégration, un cycle apparaît.

Le module wayfinding produit l'audit de couverture, qui compare les points de décision aux supports implantés. Il lit donc les supports. Le module signalétique produit les supports, et consomme le tableau des messages produit par le wayfinding. Chacun dépend de l'autre.

Un cycle de cette nature ne se contourne pas par une astuce technique. Il révèle une attribution fausse.

**Résolution.** L'implantation d'un support est une décision de wayfinding, pas de signalétique. Où l'on pose un support, de quelle typologie et à quel niveau d'information, relève de la stratégie d'orientation. À quoi il ressemble et comment il se fabrique relève de la production.

Le modèle de données se scinde en conséquence :

| Donnée | Module propriétaire |
| --- | --- |
| `support` : nœud, azimut, typologie, niveau d'information, distance de lecture | Wayfinding |
| `support_face`, `content_block`, `support_version`, `proof`, `approval` | Signalétique |
| `support` : cotes, substrat, fixation | Signalétique |

C'est aussi le découpage professionnel correct, et il supprime le cycle : le wayfinding ne lit plus la signalétique, il possède ce dont il a besoin.

Cette correction est reportée dans la section A5.6.

---

## L1. Les quatre règles d'intégration

**INT-1. Propriété unique.** Chaque entité appartient à exactement un module. Lui seul l'écrit. Une entité sans propriétaire déclaré ne peut pas être créée.

**INT-2. Lecture sans écriture.** Tout module lit ce dont il a besoin dans les autres, aucun n'y écrit. Une fonctionnalité qui exige d'écrire chez le voisin est le signe d'une attribution fausse, comme au chapitre L0. Elle relève de la procédure d'arrêt et de demande.

**INT-3. Dépendance descendante.** Les modules sont rangés en couches. Une couche lit les couches inférieures, jamais les supérieures. Une lecture entre modules d'une même couche est permise si elle est déclarée dans la fiche des deux modules et si elle ne crée pas de cycle. Un cycle est une erreur de conception, jamais un cas à gérer.

**INT-4. Dégradation déclarée.** Chaque module dit ce qu'il devient quand un module dont il dépend n'est pas souscrit. Le comportement dégradé est spécifié, jamais improvisé, et jamais silencieux.

---

## L2. Couches

| Couche | Modules | Lit |
| --- | --- | --- |
| Plateforme | 00 Plateforme, hors modules, partie Q | rien |
| 0. Socle | 01 Socle du site | plateforme |
| 1. Stratégie | 02 Wayfinding, 03 Parcours clients | couche 0 |
| 2. Production et commerce | 04 Signalétique, 05 Régie, 06 Enseignes locataires, 13 Application visiteur | couches 0 et 1, lectures intra-couche déclarées |
| 3. Aval | 07 Chantier, 08 Exploitation, 09 Budget, 14 Assistant | couches 0 à 2 |
| 4. Transverse | 10 Portefeuille, 11 Fonctions transverses | toutes |
| Surface | 12 Atelier de dessin | sert les couches 0 à 2, ne possède aucune donnée métier |

L'atelier n'est pas une couche. C'est la surface d'édition commune. Il possède ses propres données de travail, esquisses et calques, et aucune donnée métier.

---

## L3. Fiches de modules

### 01. Socle du site

**Rôle.** Porter la réalité physique du site. Tout le reste s'y appuie.

**Possède.** `site`, `building`, `level`, `zone`, `plan_source`, `plan_calibration`, `footprint`, `volume`, `opening`, `node`, `edge`, `vertical_link`, `building_link`, `graph_validation`, `destination`, `destination_name`, `category`, `decoration_layer`, `decoration_shape`, `annotation`, `imported_asset`, `layout_composition`.

**Lit.** Rien.

**Produit.** Le graphe validé, l'annuaire, la scène géométrique.

**Consommé par.** Tous.

**Moteurs.** `engine-graph` pour la validation de complétude, `engine-iso` pour la scène.

**Si absent.** Impossible. Aucun module ne fonctionne sans lui, il n'est pas optionnel et n'entre pas dans le modèle de droits.

---

### 02. Wayfinding

**Rôle.** Décider ce que l'on dit, où, et dans quel ordre.

**Possède.** `orientation_zone`, `naming_rule`, `information_level`, `wayfinding_sequence`, `message_schedule`, `message_line`, `message_schedule_approval`, et les attributs d'implantation de `support` selon L0.

**Lit.** Graphe, annuaire, zones du socle. Profils et points de décision du module 03.

**Produit.** Le plan de jalonnement, le **tableau des messages**, l'audit de couverture.

**Consommé par.** 04 Signalétique, qui compose depuis `message_line`. 09 Budget, pour le quantitatif prévisionnel.

**Moteurs.** `engine-graph`.

**Si absent.** La signalétique ne peut pas composer. Le tableau des messages est le seul producteur de contenu de face. Le module 02 est donc un préalable dur de la production, et non une option commerciale. À traiter comme le socle dans le modèle de droits.

---

### 03. Parcours clients

**Rôle.** Analyser les flux et l'exposition. Acteur : direction commerciale.

**Possède.** `travel_profile`, `flow_hypothesis`, `flow_result`, `cell_exposure`, `route_cache`, `decision_point`.

**Lit.** Graphe et annuaire du socle. Surfaces et loyers du module 09 si souscrit.

**Produit.** Parcours calculés, points de décision, indice d'exposition par cellule, comparaison de scénarios.

**Consommé par.** 02 Wayfinding, pour les points de décision. 05 Régie, pour l'exposition d'un emplacement. 09 Budget, pour le chiffrage d'une recomposition.

**Moteurs.** `engine-graph`.

**Si absent.** Le wayfinding calcule ses points de décision avec un profil par défaut unique, non paramétrable, et le signale. La régie perd la tarification indexée sur l'exposition et retombe sur une grille saisie à la main.

**Règle propre.** Un résultat de flux ne s'exporte jamais sans les hypothèses qui l'ont produit. Anomalie bloquante.

---

### 04. Signalétique

**Rôle.** Produire les supports fabricables.

**Possède.** `support_typology`, `support_face`, `content_block`, `support_version`, `proof`, `approval`, `font_asset`, `pictogram`, `pictogram_family`, et les attributs de fabrication de `support` selon L0.

**Lit.** `message_line` du module 02. Scène et annuaire du socle. Charte et paquet de règles.

**Produit.** Exécutions PDF, plans muraux orientés, plans d'évacuation, quantitatif, bons à tirer.

**Consommé par.** 07 Chantier, 08 Exploitation, 09 Budget.

**Moteurs.** `engine-layout`, `engine-iso`, `engine-artwork`.

**Si absent.** Le wayfinding reste utilisable seul et se vend comme prestation d'audit et de stratégie. C'est d'ailleurs le premier livrable vendable du produit.

---

### 05. Régie publicitaire

**Rôle.** Commercialiser les emplacements publicitaires.

**Possède.** `ad_placement`, `ad_placement_state`, `advertiser`, `ad_contract`, `ad_rate_card`, `ad_creative`, `ad_invoice`.

**Lit.** Géométrie et scène du socle. `cell_exposure` du module 03. Paquet de règles publicitaires.

**Produit.** Fiches techniques, planning d'occupation, factures, rendu en situation, états de vente exportables.

**Consommé par.** 09 Budget, 10 Portefeuille.

**Si absent.** Sans effet sur les autres modules.

**Limite ferme.** Azimut émet les factures et les données de vente. Il n'est jamais le livre comptable. Il exporte vers la comptabilité du client.

---

### 06. Enseignes locataires

**Rôle.** Instruire les projets de devanture au regard du règlement d'enseigne.

**Possède.** `tenant_signage_rule`, `tenant_signage_case`, `tenant_signage_doc`.

**Lit.** `destination` et géométrie du socle.

**Produit.** Avis, réserves, accords, constats de conformité.

**Consommé par.** 08 Exploitation, pour l'historique par cellule.

**Si absent.** Sans effet sur les autres modules.

**Frontière.** Une enseigne locataire appartient au locataire. Elle est instruite et suivie, jamais conçue par le produit. Elle n'est pas un support Azimut et n'entre dans aucun quantitatif.

---

### 07. Chantier et pose

**Rôle.** Conduire la fabrication et la pose, de l'approbation au constat.

**Possède.** `fabrication_lot`, `fabrication_order`, `installation_record`.

**Lit.** `support_version` approuvées et exécutions du module 04.

**Produit.** `installed_support`, qui bascule automatiquement au constat de pose.

**Consommé par.** 08 Exploitation, 09 Budget.

**Si absent.** Les supports posés se saisissent à la main dans le module 08. La divergence est alors détectée sans que son origine soit connue, ce qui est précisément le vide que ce module comble.

---

### 08. Exploitation et maintenance

**Rôle.** Maintenir le parc en condition.

**Possède.** `installed_support`, `divergence`, `work_order`, `inspection_round`, `inspection_finding`.

**Lit.** `support_version` et empreintes de contenu du module 04. `installation_record` du module 07.

**Produit.** Divergences, ordres de travaux, indicateurs de parc.

**Consommé par.** 09 Budget, 10 Portefeuille.

**Si absent.** Le produit perd sa raison d'abonnement. Il redevient un outil de conception vendu au projet.

---

### 09. Budget et estimation

**Rôle.** Chiffrer et suivre.

**Possède.** `cost_reference`, `budget_line`.

**Lit.** Quantitatif du module 04, lots du module 07, ordres de travaux du module 08, contrats du module 05.

**Produit.** Estimations, comparaisons estimé et réalisé, coût de reprise sur mutation.

**Si absent.** Le quantitatif reste produit, sans valorisation.

---

### 10. Portefeuille

**Rôle.** Vue et consolidation multi-sites.

**Possède.** Bibliothèques partagées, chartes et règlements de groupe, règles d'héritage.

**Lit.** Tous les modules de tous les sites de l'organisation.

**Si absent.** Chaque site vit isolément, les bibliothèques se dupliquent.

---

### 11. Fonctions transverses

**Rôle.** Ce dont tous les modules ont besoin.

**Possède.** `attachment`, `notification`, tâches, journal d'activité, recherche.

**Lit.** Tout, en respectant le cloisonnement par organisation et les droits de rôle.

**Règle propre.** La recherche globale n'expose jamais une entité d'un module non souscrit ni d'une organisation tierce. Test dédié.

---

### 12. Atelier de dessin

**Rôle.** Surface d'édition commune.

**Possède.** `sketch_layer`, `sketch_stroke`, préférences d'outils, tables de raccourcis.

**Lit et écrit.** Les entités des modules 01, 02, 04 et 05, **par leur intermédiaire et jamais directement en base**. L'atelier appelle les commandes du module propriétaire. C'est ce qui empêche la règle INT-2 d'être contournée par l'interface.

**Si absent.** Sans objet. L'atelier n'est pas optionnel.

---

## L4. Chaîne de propagation

C'est le mécanisme qui porte la valeur du produit. Il traverse cinq modules et doit être implémenté comme une chaîne explicite, pas comme une série d'effets de bord.

**Un occupant change dans l'annuaire.**

1. Socle : `destination` est modifiée.
2. Wayfinding : les `message_line` qui citent cette destination passent à `stale`. Le tableau des messages est marqué périmé.
3. Signalétique : les faces dont le `content_hash` diffère de la dernière version approuvée deviennent périmées. Les autres ne bougent pas.
4. Budget : le coût de reprise des seuls supports périmés est estimé.
5. Exploitation : un ordre de travaux est proposé, jamais créé automatiquement.

**Règle de précision.** À chaque étape, le nombre d'entités touchées doit être exactement celui attendu. Une propagation trop large marque tout comme périmé et rend le mécanisme inutile. Une propagation trop étroite laisse des supports faux sur le terrain. Un test de bout en bout vérifie ce compte sur un site de référence.

**Autres chaînes à implémenter de la même manière :**

| Déclencheur | Propagation |
| --- | --- |
| Une arête du graphe change | Cache de parcours invalidé, points de décision recalculés, couverture réévaluée, tableau des messages marqué périmé |
| La charte change de version | Faces périmées, exécutions à régénérer |
| Le paquet de règles change de version | Contrôles rejoués sur tout le site, anomalies nouvelles remontées |
| Un support est posé | `installed_support` créé, divergence évaluée, ligne budgétaire consommée |
| Un contrat publicitaire expire | Emplacement libéré au planning, notification à la régie |

---

## L5. Événements

Chaque chaîne de L4 se déclenche par un événement nommé, émis par le module propriétaire et consommé par les autres.

Règles :

- Un événement porte l'identifiant de l'entité, le type de changement et la version. Jamais l'état complet.
- Un consommateur ne modifie jamais les données du module émetteur en réaction. Il modifie les siennes.
- Le traitement est idempotent. Rejouer un événement ne produit ni doublon ni effet supplémentaire.
- L'ordre de traitement entre consommateurs n'est jamais supposé.
- Aucun événement ne crée d'ordre de travaux, de facture ou de commande. Ces objets naissent d'une décision humaine, toujours.

---

## L6. Dégradation par module non souscrit

Récapitulatif, pour que le comportement ne s'improvise pas.

| Module absent | Effet déclaré |
| --- | --- |
| 03 Parcours clients | Profil unique par défaut pour le wayfinding, tarification publicitaire manuelle |
| 04 Signalétique | Le wayfinding se vend seul comme audit et stratégie |
| 05 Régie | Aucun effet |
| 06 Enseignes locataires | Aucun effet |
| 07 Chantier | Saisie manuelle des poses, origine des divergences inconnue |
| 08 Exploitation | Perte de la logique d'abonnement, retour au projet |
| 09 Budget | Quantitatif sans valorisation |
| 10 Portefeuille | Bibliothèques dupliquées par site |

La plateforme et les modules 01, 02, 11 et 12 ne sont pas optionnels et n'entrent pas dans le modèle de droits. Le module 13 est optionnel ; s'il est souscrit, son socle d'orientation est inclus et ses trois options se souscrivent séparément (partie P). Le module 02 en particulier : sans tableau des messages, la signalétique n'a aucun producteur de contenu.

---

## L7. Ce que cette partie ne couvre pas

Historique. Cette liste ne fait plus foi. Les points encore ouverts sont repris dans le registre de la partie K, section K3, seule liste à tenir.

1. **Les écrans, en détail.** Inventoriés et rattachés à trois familles de mise en page. Chacun sera spécifié en entrant dans son incrément.
2. **Le mécanisme technique des événements.** File en base, notification interne ou autre. Relève de la procédure d'arrêt et de demande, avec deux contraintes fermes : idempotence et fonctionnement hors ligne.
3. **Les droits de rôle module par module.** Les sept rôles sont définis, leur déclinaison fine par module reste à faire au moment de construire chaque module.
4. **L'effet de cette partie sur le chiffrage.** La scission de propriété de `support` touche une migration déjà prévue. L'ampleur n'est pas estimée.

---

# PARTIE M. Spécification d'écran, première tranche verticale

Cette partie spécifie cinq écrans, qui forment une chaîne complète : ouvrir un site, importer et caler un plan, tracer des empreintes, saisir le graphe, obtenir la validation de complétude.

---

## M0. Pourquoi une tranche, et pas les treize modules

Les documents précédents donnent les jetons, la typographie, trois familles de mise en page et un inventaire d'écrans à une ligne chacun. Aucun écran n'est spécifié. L'agent de développement ne pouvait donc produire que la navigation, et il a eu raison de ne pas inventer le reste.

Spécifier les soixante écrans maintenant produirait un texte réécrit avant d'être lu. Spécifier une chaîne complète produit deux choses immédiatement utiles.

D'abord un apprentissage réel : une tranche qui fonctionne dit en deux semaines si la saisie est rapide, si la densité tient, et si le temps de mise en service d'un site est tenable. C'est l'indicateur économique central du produit, et aucun document ne peut y répondre.

Ensuite un modèle. Les écrans de cette partie deviennent la référence. Les suivants s'y conforment au lieu d'être spécifiés un par un, selon les règles du chapitre M7.

---

## M1. Écran, liste des sites

**Chemin.** `/sites`
**Famille.** Registre.
**Rôles.** Tous. Création réservée à `admin` et `designer`.

### Structure

```
+---------------------------------------------------------------+
| Sites                                    [ Nouveau site ]      |
+---------------------------------------------------------------+
| Recherche                                                      |
+---------------------------------------------------------------+
| Nom            Pays   Niveaux  Cellules  Anomalies  Modifie le |
| ...                                                            |
+---------------------------------------------------------------+
```

### Colonnes

| Colonne | Source | Format |
| --- | --- | --- |
| Nom | `site.name` | texte |
| Pays | `site.country_code` | code sur deux lettres |
| Niveaux | compte | entier |
| Cellules | compte des empreintes de type cellule | entier |
| Anomalies | compte des bloquantes | entier, pastille `state-blocking` si supérieur à 0 |
| Modifié le | `site.updated_at` | date courte |

### Formulaire de création

| Champ | Type | Contrainte | Erreur |
| --- | --- | --- | --- |
| Nom du site | texte | requis, 2 à 120 caractères, unique dans l'organisation | `DATA.NAME_REQUIRED`, `DATA.NAME_DUPLICATE` |
| Pays | sélecteur | requis, valeurs issues de la table `country` | `DATA.COUNTRY_REQUIRED` |
| Fuseau horaire | sélecteur | requis, valeurs issues de `country.timezones`, pré-rempli quand le pays n'en compte qu'un | `DATA.TIMEZONE_REQUIRED` |
| Paquet de règles | sélecteur | facultatif à la création | aucune anomalie à la création ; information affichée : la composition restera bloquée tant qu'aucun paquet n'est rattaché |
| Langues actives | choix multiple | au moins une, français et anglais proposés | `DATA.LANG_REQUIRED` |
| Entité juridique | sélecteur | facultative à la création, requise avant l'émission de la première facture. Le champ n'apparaît que si l'organisation porte au moins une entité juridique ; à défaut, le formulaire indique où la créer, jamais un sélecteur vide | `DATA.LEGAL_ENTITY_REQUIRED`, à l'émission d'une facture |

Le nom du site est un nom propre : il n'est pas traduit et reste identique dans toutes les langues actives.

Créer un site crée aussi un premier bâtiment et un premier niveau, nommés par défaut et renommables. Un site sans niveau est un état inutile que l'utilisateur devrait corriger lui-même.

### États

| État | Traitement |
| --- | --- |
| Vide | Titre court, une phrase expliquant qu'un site contient les plans et le graphe, bouton de création en évidence |
| Chargement | Structure d'attente calquée sur les lignes du tableau |
| Erreur | Cause et action de reprise |
| Hors ligne | Bandeau, sites déjà ouverts localement accessibles, création indisponible et dite telle |
| Droit refusé | Liste visible, bouton de création absent, non grisé |

---

## M1bis. Écran, fiche de site

Sans cet écran, un site reste au bâtiment et au niveau créés par le formulaire de M1. La tâche T-1.5 et l'outil de liaison verticale sont alors impossibles.

**Chemin.** `/sites/:siteId`
**Famille.** Registre.
**Rôles.** Consultation pour tous. Création et modification pour `admin` et `designer`.

### Structure

```
+---------------------------------------------------------------+
| Site                                       [ Nouveau bâtiment ]|
+---------------------------------------------------------------+
| Bâtiment A                                 [ Nouveau niveau ]  |
|   R+0   altitude 0,00 m                                        |
|   R+1   altitude 4,20 m                                        |
| Bâtiment B                                                     |
+---------------------------------------------------------------+
```

### Champs d'un bâtiment

| Champ | Type | Contrainte | Erreur |
| --- | --- | --- | --- |
| Nom | texte | requis, 1 à 80 caractères, unique par site | `DATA.NAME_REQUIRED`, `DATA.NAME_DUPLICATE` |
| Accès indépendant | interrupteur | faux par défaut | |
| Horaires d'ouverture | plages par jour | facultatif, fuseau du site | |
| Largeur d'arête par défaut | numérique, mètres | facultatif, hérité par les arêtes du bâtiment | |

### Champs d'un niveau

| Champ | Type | Contrainte | Erreur |
| --- | --- | --- | --- |
| Nom | texte | requis, unique par bâtiment | `DATA.NAME_REQUIRED`, `DATA.NAME_DUPLICATE` |
| Rang | entier | requis, unique par bâtiment, négatif admis pour les sous-sols | `DATA.LEVEL_ORDINAL_DUPLICATE` |
| Altitude | numérique, mètres | requise, relative à l'altitude de référence du site | |

### Actions

| Action | Effet |
| --- | --- |
| Nouveau bâtiment | Crée un bâtiment, et un premier niveau nommé par défaut |
| Nouveau niveau | Crée un niveau dans le bâtiment, rang proposé à la suite du plus élevé |
| Renommer | Bâtiment ou niveau |
| Supprimer un niveau | Refusé s'il porte des empreintes ou des nœuds, `DATA.LEVEL_NOT_EMPTY`. La suppression demande une confirmation qui nomme la conséquence |

### États

Les six états de la section F7. L'état vide, pour un site qui n'aurait aucun bâtiment, invite à en créer un et explique que les plans se calent par niveau.

### Critères d'acceptation

1. Un site à deux bâtiments et quatre niveaux se crée entièrement par cet écran, sans intervention en base.
2. Deux niveaux de même rang dans un bâtiment sont refusés.
3. Un niveau portant des empreintes ou des nœuds ne peut pas être supprimé.
4. L'altitude saisie est celle que lit la géométrie : un volume posé sur ce niveau s'en déduit.
5. Le parcours complet est réalisable au clavier seul.

---

## M2. Écran, import et calage de plan

C'est l'écran d'entrée réel du produit, et le plus important de la tranche. Tout le reste en dépend.

**Chemin.** `/sites/:siteId/levels/:levelId/plan`
**Famille.** Atelier.
**Rôles.** `designer`, `admin`.

### Structure

```
+---------------------------------------------------------------+
| Azimut | Site | Niveau R+1                      [ Valider ]    |
+--------+------------------------------------------+-----------+
| Etapes |                                          | Calage    |
| 1 Fond |                                          |           |
| 2 Echel|         zone de travail                  | Point A   |
| 3 Nord |         plan affiche                     | Point B   |
|        |                                          | Distance  |
|        |                                          | Nord      |
|        |                                          |           |
|        |                                          | Echelle   |
+--------+------------------------------------------+-----------+
| Echelle 1:200  |  x 12,340 m  y 8,221 m  |  Hors ligne         |
+---------------------------------------------------------------+
```

### Étape 1, fond de plan

| Champ | Type | Contrainte | Erreur |
| --- | --- | --- | --- |
| Fichier | dépôt ou sélection | PDF, PNG, JPG, DWG. 60 Mo maximum | `IMPORT.FILE_TOO_LARGE`, `IMPORT.FORMAT_UNSUPPORTED` |
| Page | sélecteur | si PDF multipage, requis | `IMPORT.PAGE_REQUIRED` |

Pour un fichier de CAO, la qualification décrite en partie D s'exécute avant tout import et affiche son rapport : proportion de polylignes fermées, calques exploitables, cohérence des unités, références manquantes, doublons, nombre de niveaux. En dessous du seuil, l'écran recommande explicitement le calage manuel et propose les deux voies sans en imposer une.

### Étape 2, échelle

| Champ | Type | Contrainte | Erreur |
| --- | --- | --- | --- |
| Point A | clic dans la zone de travail | requis | `CALIB.POINT_REQUIRED` |
| Point B | clic dans la zone de travail | requis, distinct de A d'au moins 40 pixels | `CALIB.POINTS_TOO_CLOSE` |
| Distance réelle | numérique, mètres | requis, supérieur à 0, 3 décimales | `CALIB.DISTANCE_INVALID` |

**Calage à n points.** En complément du calage à deux points, qui reste le minimum, l'écran accepte un calage à n points homologues, ajusté et mesuré. Il produit un résidu, moyen et par point, qui donne la preuve chiffrée du critère 1 de cette section au lieu d'une vérification à la main. Les seuils de résidu sont des tolérances techniques, section D1.5, non des valeurs normatives. À moins de quatre points, le résidu ne mesure rien et l'écran le dit.

Calculé et affiché en lecture seule : échelle en pixels par mètre, et son équivalent en échelle de plan arrondie à la valeur courante la plus proche, 1:100, 1:200, 1:500.

Contrôle d'invraisemblance : une échelle hors de la plage 0,05 à 500 pixels par mètre lève `CALIB.SCALE_IMPLAUSIBLE` en avertissement. L'utilisateur peut passer outre, la valeur étant parfois légitime sur un extrait.

### Étape 3, orientation

| Champ | Type | Contrainte | Erreur |
| --- | --- | --- | --- |
| Azimut du nord | numérique, degrés | 0 à 360 exclus, convention compas | `CALIB.AZIMUTH_INVALID` |
| ou Tracé de la flèche nord | geste dans la zone de travail | alternative au champ | |

Les deux voies écrivent la même donnée. La saisie numérique est le moyen le plus précis et le seul accessible au clavier, elle n'est donc jamais secondaire.

### Actions

| Action | Effet |
| --- | --- |
| Valider le calage | Écrit `plan_calibration`, débloque le tracé |
| Recaler | Reprend à l'étape 2, conserve le fond |
| Remplacer le fond | Conserve le calage si les dimensions concordent, sinon avertit et propose de recaler |

Remplacer un fond sans recaler est le geste qui décale silencieusement toute une modélisation. Il demande donc une confirmation nommant la conséquence.

### Raccourcis

| Touche | Action |
| --- | --- |
| Espace maintenu | Déplacement de la vue |
| Molette | Zoom |
| `0` | Ajuster à la fenêtre |
| `Entrée` | Étape suivante |
| `Échap` | Annuler le point en cours |

### États

| État | Traitement |
| --- | --- |
| Vide | Zone de dépôt centrée, formats acceptés énoncés, mention du calage manuel possible sans fichier de CAO |
| Chargement | Progression réelle du téléversement, annulable |
| Partiel | Fond chargé, calage incomplet : le tracé reste inaccessible et l'écran dit pourquoi |
| Erreur | Cause et reprise, le fichier déjà téléversé n'est jamais perdu |
| Hors ligne | Import local possible, téléversement différé, état visible dans la barre |
| Droit refusé | Plan en lecture, outils absents |

### Critères d'acceptation

1. Un plan calé restitue une distance connue à moins de 1 % d'erreur.
2. Le calage rejoué sur les mêmes points donne exactement le même résultat.
3. Aucune coordonnée de géométrie du site n'est écrite en pixels. Seuls les points de calage de la source de plan le sont, selon la règle M01.S2.
4. Le parcours complet est réalisable au clavier seul.
5. Un remplacement de fond sans recalage demande une confirmation nommant la conséquence.

---

## M3. Écran, tracé des empreintes

**Chemin.** `/sites/:siteId/levels/:levelId/footprints`
**Famille.** Atelier.

### Structure

```
+---------------------------------------------------------------+
| Azimut | Site | Niveau R+1            3 empreintes             |
+--------+-----+------------------------------------+-----------+
| Calques| out |                                    | Proprietes|
| Fond   | ils |        zone de travail             |           |
| Cellul |     |                                    | Code      |
| Circul |     |                                    | Categorie |
|        |     |                                    | Surface   |
|        |     |                                    |           |
+--------+-----+------------------------------------+-----------+
| Echelle | x y | Magnetisme actif | 0 anomalie                  |
+---------------------------------------------------------------+
```

### Outils

| Outil | Touche | Comportement |
| --- | --- | --- |
| Sélection | `V` | Sélection simple, additive, par rectangle |
| Cellule | `C` | Polygone contraint aux angles droits, libérable par `Alt` |
| Polygone libre | `P` | Sans contrainte d'angle |
| Rectangle | `R` | Deux points opposés |
| Sommet | `A` | Édition de sommet |

### Propriétés d'une empreinte

| Champ | Type | Contrainte | Erreur |
| --- | --- | --- | --- |
| Code de cellule | texte | requis, unique par niveau, 1 à 20 caractères | `DATA.CODE_DUPLICATE` |
| Nature | sélecteur | cellule, circulation, technique, noyau vertical, place de stationnement | requis |
| Catégorie | sélecteur | facultative à ce stade | |
| Surface | calculé | lecture seule, m2, 1 décimale | |
| Coordonnées des sommets | numérique | saisissables individuellement, mètres, 3 décimales | |

La saisie numérique des sommets est le moyen le plus précis et le seul accessible au clavier. Elle figure dans le panneau, pas dans un menu secondaire.

### Contrôles à la saisie

| Situation | Code | Effet |
| --- | --- | --- |
| Polygone auto-intersectant | `GEOM.POLYGON_SELF_INTERSECTING` | Refus, le tracé reste en cours |
| Moins de 3 sommets | `GEOM.POLYGON_TOO_FEW_VERTICES` | Refus |
| Surface sous tolérance | `GEOM.POLYGON_DEGENERATE` | Refus |
| Empreintes superposées | `GEOM.FOOTPRINTS_OVERLAP` | Avertissement, tracé accepté |

Un refus n'efface jamais le travail en cours. Il empêche la validation et dit pourquoi.

### Actions en série

Alignement, répartition, duplication en série le long d'un axe, suppression groupée. La duplication en série est l'action qui fait gagner le plus de temps sur une galerie à trame régulière, elle est en évidence et non enfouie.

### Raccourcis

| Touche | Action |
| --- | --- |
| `Entrée` | Fermer le polygone en cours |
| `Échap` | Abandonner le tracé en cours |
| `Retour arrière` | Supprimer le dernier sommet |
| Flèches | Déplacer la sélection de 0,01 m |
| Maj + flèches | Déplacer de 0,10 m |
| `Ctrl+Z` | Annuler |
| `Ctrl+D` | Dupliquer |

### États

| État | Traitement |
| --- | --- |
| Vide | Plan calé visible, invitation à tracer la première cellule, outil cellule déjà actif |
| Partiel | Empreintes sans code signalées, non bloquant à ce stade |
| Hors ligne | Tracé possible, indicateur de synchronisation en attente |
| Droit refusé | Empreintes visibles, outils absents |

### Critères d'acceptation

1. Un polygone auto-intersectant est refusé avec son code, et le tracé en cours est conservé.
2. Les coordonnées stockées sont en mètres, quantifiées au millimètre.
3. Une empreinte tracée à la souris et la même saisie au clavier produisent des données identiques.
4. La duplication en série de 20 cellules se fait en une commande annulable d'un seul geste.

---

## M4. Écran, saisie du graphe

**Chemin.** `/sites/:siteId/levels/:levelId/graph`
**Famille.** Atelier.

### Outils

| Outil | Touche | Comportement |
| --- | --- | --- |
| Nœud | `N` | Le type se choisit avant le geste, jamais après |
| Arête | `E` | Relie deux nœuds, ou crée les nœuds manquants aux extrémités |
| Axe de circulation | `X` | Tracé continu produisant nœuds et arêtes en une passe |
| Liaison verticale | `L` | Relie deux nœuds de niveaux différents |

### Propriétés d'un nœud

| Champ | Type | Contrainte |
| --- | --- | --- |
| Type | sélecteur | requis, parmi la liste fermée de la partie A |
| Libellé | texte | facultatif |
| Position | numérique, mètres | saisissable |

### Propriétés d'une arête

| Champ | Type | Contrainte | Défaut |
| --- | --- | --- | --- |
| Largeur utile | numérique, mètres | supérieure à 0 | hérité du bâtiment, `building.default_edge_width_m` |
| Pente | numérique, pourcentage | -20 à +20 | 0 |
| Accessible | booléen | | vrai |
| Sens | sélecteur | les deux, aller, retour | les deux |
| Cheminement d'évacuation | booléen | | faux |
| Disponibilité horaire | plage | facultative | héritée du bâtiment |
| Longueur | calculé | lecture seule, jamais saisissable | |

La longueur est recalculée à toute modification de position. Un champ de longueur saisissable serait une source permanente d'incohérence.

### Contrôles à la saisie

| Situation | Code | Effet |
| --- | --- | --- |
| Arête reliant un nœud à lui-même | `GRAPH.EDGE_SELF_LOOP` | Refus |
| Longueur sous tolérance | `GRAPH.EDGE_ZERO_LENGTH` | Refus |
| Arête entre niveaux sans liaison verticale | `GRAPH.VERTICAL_LINK_MISSING` | Refus, avec proposition de créer la liaison |

### Affichage

Les nœuds sont différenciés par leur forme, jamais par la seule couleur. Les arêtes non accessibles sont tracées en trait interrompu. Les cheminements d'évacuation portent un liseré distinct. Aucune de ces distinctions ne repose sur la couleur seule, contrôle vérifié en niveaux de gris.

### Critères d'acceptation

1. Un axe tracé en une passe produit les nœuds et arêtes attendus, sans doublon.
2. La longueur n'est jamais saisissable et se recalcule à chaque déplacement.
3. Une arête inter-niveaux sans liaison verticale est refusée avec proposition de correction.
4. Le graphe complet est saisissable au clavier seul.

---

## M5. Écran, validation de complétude

**Chemin.** `/sites/:siteId/validation`
**Famille.** Document.

### Structure

```
+---------------------------------------------------------------+
| Validation du graphe                      [ Relancer ]         |
+---------------------------------------------------------------+
| 3 bloquantes   2 avertissements   1 information                |
+---------------------------------------------------------------+
| Bloquantes                                                     |
|   Noeud N-12  Relie a aucune arete                Ouvrir       |
|   ...                                                          |
+---------------------------------------------------------------+
```

### Contenu

Anomalies groupées par entité, ordonnées par gravité décroissante. Chaque ligne porte le libellé issu du dictionnaire, l'entité concernée, et un lien qui ouvre la zone de travail centrée sur elle avec la sélection déjà faite.

Une anomalie d'origine normative affiche sa référence documentaire. Une anomalie normative sans référence visible est un défaut, pas un détail de présentation.

### Règle

Aucun taux de couverture n'est affiché tant que la validation de complétude échoue. Le compteur correspondant indique que le calcul est conditionné, il n'affiche jamais zéro ni un tiret.

### Actions

| Action | Effet |
| --- | --- |
| Relancer | Recalcule, affiche la durée réelle, enregistre le passage dans `graph_validation` |
| Ouvrir | Va à l'entité, sélection faite |
| Exporter | Document ou tableur, avec l'horodatage et la version du paquet de règles |

### États

| État | Traitement |
| --- | --- |
| Vide, aucune anomalie | Constat net, et la mention que la complétude n'est pas la justesse : le graphe est cohérent, pas nécessairement conforme au terrain |
| Chargement | Progression, annulable |
| Jamais lancé | Invitation à lancer, jamais un résultat vide présenté comme un succès |

Ce dernier point importe : un écran vide qui ressemble à une réussite alors que rien n'a été calculé est le pire des états possibles.

---

## M6. Composants employés

Tous figurent dans la liste fermée de la partie F. Cette tranche n'en introduit aucun nouveau.

Champ texte, champ numérique avec unité, champ d'angle, sélecteur, choix multiple, interrupteur, arborescence, tableau de données, barre d'outils, barre d'état, panneau, section repliable, pastille d'état, ligne d'anomalie, bandeau, indicateur de progression, bouton principal, secondaire, discret, d'icône, menu contextuel, boîte de dialogue, vue, cadre de sélection, poignées, guides, règles.

Si un écran de cette tranche semble exiger un composant absent de la liste, c'est l'écran qu'il faut revoir, pas la liste qu'il faut étendre.

---

## M7. Règles que les écrans suivants reprennent

Ces onze règles sont extraites de la tranche. Tout écran construit ensuite s'y conforme, sans qu'il soit nécessaire de le spécifier en entier.

1. Les six états sont traités. Un écran qui ne traite que le cas nominal est incomplet.
2. Toute valeur saisissable au pointeur l'est aussi au clavier, en numérique, dans le panneau et non dans un menu secondaire.
3. Toute valeur calculée est en lecture seule, et son caractère calculé est visible.
4. Tout champ dimensionnel affiche son unité.
5. Un refus de saisie n'efface jamais le travail en cours.
6. Une anomalie porte son entité, un lien vers elle, et sa référence normative le cas échéant.
7. Aucune information n'est portée par la seule couleur.
8. L'indicateur de focus est distinct de l'indicateur de sélection.
9. Une action irréversible ou à conséquence lointaine demande une confirmation qui nomme la conséquence.
10. L'accent ne signale que ce que le logiciel a calculé.
11. Aucun résultat vide n'est présenté comme un succès si le calcul n'a pas eu lieu.

---

## M8. Critères d'acceptation de la tranche entière

Ce qui compte n'est pas que chaque écran existe, mais que la chaîne fonctionne.

1. Un opérateur part d'un site vide, importe un plan, le cale, trace trois cellules, pose quatre nœuds, trace les arêtes, lance la validation, et obtient un résultat cohérent. Sans aide, sans documentation.
2. Le même parcours est réalisable au clavier seul.
3. Le même parcours est réalisable hors ligne, avec synchronisation au retour du réseau.
4. **Le temps du parcours est mesuré et consigné, selon le protocole de la section D13** : cinq exécutions, la première écartée, médiane retenue, machine de référence déclarée. C'est le premier relevé de l'indicateur économique central du produit, et il sert de base à toutes les révisions ultérieures. Un relevé unique ne vaut pas comme base de révision : l'écart d'une machine à elle-même peut dépasser celui que l'on cherche à mesurer.
5. Aucune violation détectable automatiquement aux niveaux A et AA sur les cinq écrans, dans leurs six états et les deux langues. Les résultats incomplets sont listés pour revue manuelle. La conformité AA elle-même est attestée par l'audit externe, pas par ce contrôle.
6. Aucune couleur en dur, aucune valeur d'espacement hors échelle, aucune chaîne de texte écrite dans un composant.

---

## M9. Ce que cette partie ne couvre pas

Historique. Cette liste ne fait plus foi. Les points encore ouverts sont repris dans le registre de la partie K, section K3, seule liste à tenir.

1. **Les écrans des autres modules.** Ils s'appuieront sur M7, et seront spécifiés en entrant dans leur incrément.
2. **Le tableau des messages.** C'est l'autre écran qui mérite une spécification propre, puisque c'est celui que la maîtrise d'ouvrage regardera le plus longtemps. Il vient ensuite.
3. **Les libellés exacts.** Les codes d'anomalie sont stables, leurs libellés dans les deux langues restent à rédiger.
4. **Les seuils d'ergonomie.** Tolérances de magnétisme, pas de déplacement au clavier, durée avant confirmation. Valeurs de départ données, à régler sur usagers réels.

---

# PARTIE N. Cahier des charges détaillé par module

Cette partie spécifie les modules 01 à 12. Le module 13 est spécifié en partie P, la plateforme en partie Q. Elle s'appuie sur la partie L pour la propriété des données et l'intégration, et sur la partie M pour les règles d'écran.

---

## N0. Profondeur et méthode

La profondeur suit l'ordre de construction.

| Modules | Profondeur | Motif |
| --- | --- | --- |
| 01, 02, 04 | Champ et règle | Se construisent maintenant, tout en dépend |
| 03, 12 | Règle et contrôle | Incrément suivant |
| 05 à 11 | Règle et frontière | Deux ans ou plus, seraient réécrits |

Chaque fiche suit la même structure : rôle et frontière, entités, règles métier numérotées, contrôles, écrans, intégration, critères d'acceptation, points ouverts.

Une règle numérotée est opposable. Elle se cite dans une revue de code et dans un test.

---

# Module 01. Socle du site

## N1.1 Rôle et frontière

Porter la réalité physique et locative du site.

**Dans le périmètre.** Sites, bâtiments, niveaux, zones, plans de fond et calage, empreintes, volumes, ouvertures, graphe de circulation, annuaire des occupants, couche d'habillage, composition de page.

**Hors périmètre.** Toute interprétation. Le socle décrit ce qui existe, il ne dit ni ce qu'il faut afficher, ni où poser un support, ni comment un visiteur circule. Ces trois questions appartiennent aux modules 02 et 03.

## N1.2 Entités et champs non encore spécifiés

Les tables figurent en partie A. Les champs ci-dessous complètent ou précisent.

**`site`**

| Champ | Type | Contrainte |
| --- | --- | --- |
| `origin_x_m`, `origin_y_m` | numérique, mètres | Point de référence du repère site, fixé au premier calage, jamais modifié ensuite |
| `active_langs` | tableau | Au moins une, `fr` et `en` seules valeurs admises en V1 |
| `reference_elevation_m` | numérique | Altitude du niveau de référence, à laquelle Z vaut 0 |

**`building`**

| Champ | Type | Contrainte |
| --- | --- | --- |
| `independent_access` | booléen | Faux par défaut |
| `opening_hours` | structure | Par jour, plusieurs plages possibles, fuseau du site |
| `default_edge_width_m` | numérique | Largeur héritée par les arêtes du bâtiment |

**`level`**

| Champ | Type | Contrainte |
| --- | --- | --- |
| `ordinal` | entier | Unique par bâtiment, négatif admis pour les sous-sols |
| `elevation_m` | numérique | Relative à `reference_elevation_m` |

**`footprint`**

| Champ | Type | Contrainte |
| --- | --- | --- |
| `kind` | énuméré | `cell`, `circulation`, `technical`, `vertical_core`, `outdoor` |
| `unit_code` | texte | Requis si `kind = cell`, unique par niveau |
| `geometry` | polygone | Simple, fermé, non auto-intersectant, au moins 3 sommets, surface au-dessus de la tolérance |

**`destination`**

| Champ | Type | Contrainte |
| --- | --- | --- |
| `occupancy_status` | énuméré | `occupied`, `vacant`, `reserved`, `under_fit_out` |
| `display_priority` | entier | 1 à 9, 1 le plus fort, sert au module 02 pour arbitrer une face trop chargée |
| `valid_from`, `valid_to` | date | Historique conservé, une cellule peut avoir plusieurs occupants successifs |

## N1.3 Règles métier

**M01.S1.** Le repère site est fixé au premier calage et n'est jamais modifié. Le modifier invaliderait toute géométrie déjà saisie.

**M01.S2.** Aucune coordonnée de géométrie du site n'est stockée en pixels. La conversion se fait à l'affichage, jamais en base. Seule exception, le calage d'une source de plan, qui décrit l'image et non le site : ses points sont conservés en pixels de l'image, suffixe `_px`, dans les tables `plan_calibration` et `plan_calibration_point`.

**M01.S3.** Une empreinte de nature `cell` porte obligatoirement un code de cellule. Les autres natures ne l'exigent pas.

**M01.S4.** Une destination est rattachée à une empreinte et à un nœud d'accès. Sans nœud d'accès, elle est inatteignable et le module 02 le signalera.

**M01.S5.** L'historique d'occupation est conservé. Une cellule qui change d'occupant ne perd pas la trace du précédent, ce qui alimente les modules 03 et 09.

**M01.S6.** La longueur d'une arête est calculée, jamais saisie, et recalculée à toute modification de position.

**M01.S7.** La couche d'habillage ne participe à aucun calcul. Elle n'apparaît dans aucun quantitatif, aucune zone cliquable, aucun parcours.

**M01.S8.** La légende et la rose des vents ne sont pas dessinées. Elles sont générées depuis les catégories présentes et depuis l'orientation. Seule leur position est composée.

**M01.S9.** Un plan de fond remplacé sans recalage conserve son calage uniquement si les dimensions concordent. Sinon, avertissement et proposition de recaler.

**M01.S10.** Toute arête dont les deux extrémités appartiennent à des bâtiments différents porte une ligne `building_link`, qui déclare si le passage est couvert. C'est la règle symétrique de celle des liaisons verticales : la connectivité est portée par l'arête, l'attribut de passage par la liaison. Sans elle, `GRAPH.BUILDING_LINK_MISSING`.

Limite déclarée : aucun calcul de parcours ne lit aujourd'hui l'attribut de passage couvert. Il est conservé parce qu'un cheminement extérieur non couvert change le parcours réel d'un visiteur, et qu'aucune autre donnée ne le porte.

## N1.4 Contrôles

Ceux de `validateGraph` en partie A, plus les contrôles géométriques de la partie M.

Ajouts propres au module :

| Situation | Code | Gravité |
| --- | --- | --- |
| Cellule sans code | `DATA.UNIT_CODE_REQUIRED` | bloquant |
| Deux cellules de même code sur un niveau | `DATA.CODE_DUPLICATE` | bloquant |
| Niveau sans plan calé | `CALIB.LEVEL_NOT_CALIBRATED` | bloquant |
| Destination sans dénomination dans une langue active | `LAYOUT.LANG_VARIANT_MISSING` | avertissement |
| Bâtiment sans accès ni liaison | `GRAPH.BUILDING_ISOLATED` | avertissement |

## N1.5 Écrans

Spécifiés en partie M pour l'import, le calage, le tracé et le graphe. La fiche de site, bâtiments et niveaux, est spécifiée en section M1bis. Restent à spécifier, selon les règles de M7 : annuaire des occupants, habillage, composition de page.

## N1.6 Intégration

Lit : rien. Produit : graphe validé, annuaire, scène géométrique. Consommé par : tous. Non optionnel.

## N1.7 Critères d'acceptation

1. Un site modélisé se recharge à l'identique, géométrie et graphe compris.
2. Aucune coordonnée de géométrie en pixels en base, vérifié par analyse du schéma. Les seules colonnes en pixels admises sont celles des tables de calage, suffixées `_px`.
3. `validateGraph` détecte chacun de ses cas sur un site de référence dédié, et ne le détecte pas sur le site voisin.
4. L'historique d'occupation survit à trois changements successifs sur une même cellule.

## N1.8 Ouvert

Le format d'échange du graphe vers l'extérieur, reporté faute de vérification du support réel par les outils des clients.

---

# Module 02. Wayfinding

## N2.1 Rôle et frontière

Décider ce que l'on dit, où, et dans quel ordre.

**Dans le périmètre.** Zonage d'orientation, nomenclature, hiérarchie de l'information, plan de jalonnement, tableau des messages, implantation des supports, audit de couverture.

**Hors périmètre.** L'apparence des supports, leurs cotes de fabrication, leur substrat. Module 04.

**Frontière avec le socle.** Une zone d'orientation n'est pas une zone technique. Un même espace peut relever de deux zones d'orientation différentes selon le parcours, ce qu'une zone du socle ne permet pas.

## N2.2 Entités et champs

**`orientation_zone`**

| Champ | Type | Contrainte |
| --- | --- | --- |
| `code` | texte | Unique par site, 1 à 8 caractères |
| `name_fr`, `name_en` | texte | Requis dans chaque langue active |
| `kind` | énuméré | `mall`, `entrance`, `core`, `service`, `outdoor` |
| `footprint_ids` | tableau | Empreintes couvertes, recouvrement admis |

**`naming_rule`**

| Champ | Type | Contrainte |
| --- | --- | --- |
| `target` | énuméré | `level`, `zone`, `door`, `core`, `parking` |
| `pattern` | texte | Modèle de nommage, avec jetons |
| `max_length` | entier | Longueur maximale compatible avec les supports |
| `uniqueness_scope` | énuméré | `site`, `building`, `level` |

**`information_level`**

Rattache une typologie de support à un ou plusieurs des quatre niveaux : identification, orientation, direction, confirmation.

**`wayfinding_sequence`**

| Champ | Type | Contrainte |
| --- | --- | --- |
| `profile_id` | référence | Profil du module 03 |
| `ordinal` | entier | Ordre de rencontre le long du parcours |
| `node_id` | référence | Point de décision |
| `expected_level` | entier | Niveau d'information attendu à ce point |

**`message_schedule`**

| Champ | Type | Contrainte |
| --- | --- | --- |
| `version` | entier | Incrémenté à chaque génération |
| `state` | énuméré | `draft`, `in_review`, `approved`, `superseded` |
| `inputs_hash` | texte | Empreinte du graphe et de l'annuaire ayant servi |
| `generated_at` | horodatage | |

**`message_line`**

| Champ | Type | Contrainte |
| --- | --- | --- |
| `support_id`, `face_index`, `block_index` | références | Localisent la ligne |
| `content` | structure | Une valeur par langue active |
| `pictogram_id` | référence | Facultatif |
| `direction` | énuméré | `left`, `right`, `ahead`, `up`, `down`, `back`, aucune |
| `information_level` | entier | 1 à 4 |
| `decision_point_id` | référence | **Requis.** La ligne qui la justifie |
| `stale` | booléen | Dérivé, recalculé, jamais saisi |
| `excluded` | booléen | Vrai si la ligne a été écartée par l'arbitrage de M02.W9. Une ligne écartée n'est jamais composée sur une face |
| `exclusion_reason` | structure | Plafond appliqué, référence de la règle, `display_priority` de la destination écartée et de la dernière retenue |

**`support`, attributs d'implantation** (propriété module 02 selon la partie L)

| Champ | Type | Contrainte |
| --- | --- | --- |
| `code` | texte | Requis, unique par site, lisible, par exemple `D-042` |
| `node_id` | référence | Requis |
| `azimuth_deg` | numérique | 0 à 360 exclus, convention compas |
| `typology_id` | référence | Requis |
| `reading_distance_m` | numérique | Supérieur à 0 |
| `information_levels` | tableau | Au moins un |

## N2.3 Règles métier

**M02.W1.** Le nommage est une donnée, jamais une saisie libre au moment de composer un panneau.

**M02.W2.** Une règle de nommage déclarée est vérifiée à toute création. Une collision lève une anomalie bloquante, y compris entre bâtiments.

**M02.W3.** Tout support porte au moins un niveau d'information. Un support qui n'en porte aucun existe sans raison.

**M02.W4.** Toute ligne du tableau des messages référence le point de décision qui la justifie. Une ligne sans justification est une anomalie bloquante. C'est cette règle qui empêche un panneau de dire quelque chose que rien ne motive.

**M02.W5.** Continuité du message. Une destination annoncée à un point de décision doit être reprise ou confirmée au point suivant du même parcours, jusqu'à ce qu'elle soit atteinte. La rupture est l'erreur de wayfinding la plus fréquente et la moins visible.

**M02.W6.** Le tableau des messages est généré depuis le graphe, le jalonnement et l'annuaire. Il n'est jamais saisi à la main. Un bloc explicitement typé libre est la seule exception.

**M02.W7.** Le tableau des messages est versionné et validé selon le même circuit que les bons à tirer. C'est lui que valide la maîtrise d'ouvrage, avant tout dessin.

**M02.W8.** Toute modification du graphe ou de l'annuaire marque périmées les seules lignes concernées. Ni plus, ni moins.

**M02.W9.** Le nombre de destinations affichables sur une face est plafonné par le paquet de règles. Au-delà, l'arbitrage se fait par `display_priority`, et l'écartement est tracé, jamais silencieux.

**M02.W10.** Aucun taux de couverture n'est publié tant que la validation de complétude du graphe échoue.

**M02.W11.** Le tableau des messages ne peut être émis pour revue que si la validation de complétude du graphe est passée, c'est-à-dire si le dernier enregistrement de `graph_validation` du site est passé et porte l'empreinte du graphe actuel. Une validation obtenue avant une modification du graphe ne vaut pas.

**M02.W12.** Un support appartient aux zones d'orientation dont les empreintes contiennent la position de son nœud. L'appartenance se calcule, elle n'est jamais saisie. Un support peut appartenir à plusieurs zones quand elles se recouvrent, et un nœud situé sur une limite, à la tolérance de la section D1.5, appartient aux zones des deux côtés. Faire relire à la maîtrise d'ouvrage un tableau bâti sur un graphe incomplet reviendrait à lui faire valider une erreur.

## N2.4 Contrôles

| Situation | Code | Gravité |
| --- | --- | --- |
| Collision de nommage | `WAYFIND.NAMING_COLLISION` | bloquant |
| Continuité rompue | `WAYFIND.CONTINUITY_BROKEN` | bloquant |
| Support sans niveau d'information | `WAYFIND.NO_INFORMATION_LEVEL` | bloquant |
| Ligne sans point de décision | `WAYFIND.LINE_UNJUSTIFIED` | bloquant |
| Tableau périmé | `WAYFIND.SCHEDULE_STALE` | avertissement |
| Trop de destinations sur une face | `WAYFIND.TOO_MANY_DESTINATIONS` | bloquant |
| Point de décision non couvert | `GRAPH.DECISION_POINT_UNCOVERED` | bloquant |
| Support ne servant aucun parcours | `GRAPH.SUPPORT_UNUSED` | avertissement |

`WAYFIND.LINE_UNJUSTIFIED` et `GRAPH.DECISION_POINT_UNCOVERED` figurent au catalogue D2.2.

## N2.5 Écrans

| Écran | Famille | Note |
| --- | --- | --- |
| Zonage et nomenclature | Atelier | Tracé de zones, règles de nommage, détection de collisions |
| Hiérarchie de l'information | Registre | Rattachement typologies et niveaux |
| Plan de jalonnement | Atelier | Séquence par profil, points de décision ordonnés |
| Implantation des supports | Atelier | Pose, azimut, typologie, proposition automatique |
| **Tableau des messages** | Registre | Écran central, spécification propre à produire |
| Audit de couverture | Document | Anomalies groupées, liens vers entités |

Le tableau des messages mérite une spécification au champ près, au même titre que la tranche de la partie M. C'est l'écran que la maîtrise d'ouvrage regardera le plus longtemps, et celui qui débloque la composition.

## N2.6 Intégration

Lit : socle, plus profils et points de décision du module 03. Produit : tableau des messages, jalonnement, audit de couverture, implantation. Consommé par : 04, 09.

Dégradation : sans module 03, un profil par défaut unique, non paramétrable, signalé à l'écran.

Non optionnel. Sans tableau des messages, la signalétique n'a aucun producteur de contenu.

## N2.7 Critères d'acceptation

1. Sur un site de référence, le tableau des messages généré est exactement celui attendu, ligne pour ligne.
2. Une destination modifiée marque périmées les seules lignes qui la citent. Le test échoue si une ligne non concernée est marquée.
3. Une continuité rompue est détectée sur un site conçu pour la produire, et non détectée sur le site voisin.
4. Une ligne sans point de décision ne peut pas être créée.
5. Le tableau s'exporte en tableur et en document, avec un identifiant stable par ligne, deux exports identiques donnant des fichiers identiques.

## N2.8 Ouvert

Les valeurs plafonds du paquet de règles, qui dépendent du corpus normatif non établi. En leur absence, le contrôle de M02.W9 ne s'exécute pas et le signale.

---

# Module 03. Parcours clients

## N3.1 Rôle et frontière

Analyser les flux et l'exposition. Acteur : direction commerciale.

**Frontière ferme.** Le module produit des indices relatifs entre cellules d'un même site. Il ne produit jamais un nombre de visiteurs, ni une prévision de chiffre d'affaires pour une enseigne non installée.

## N3.2 Règles métier

**M03.P1.** Les pondérations sont déclarées, jamais devinées par l'outil : part de fréquentation par accès, pouvoir d'attraction par destination motrice, cône de visibilité par typologie de circulation.

**M03.P2.** L'exposition d'une cellule est le nombre de parcours calculés passant devant elle, pondérés par ces trois facteurs.

**M03.P3.** Le résultat est un indice relatif et un rang, jamais une valeur absolue.

**M03.P4.** Un résultat de flux ne s'exporte jamais sans les hypothèses qui l'ont produit. Anomalie bloquante.

**M03.P5.** Les montants ne sont calculés que si la corrélation entre exposition et performance réelle atteint le seuil déclaré. En dessous, seuls les écarts d'exposition sont produits, et l'interface le dit.

**M03.P6.** Les données réelles importées, comptage, télémétrie, chiffre d'affaires déclaré, ne sont jamais produites par Azimut. Leur origine et leur date sont conservées.

**M03.P7.** Une comparaison de scénarios porte toujours sur deux états du même site, jamais sur une référence externe.

## N3.3 Contrôles

| Situation | Code | Gravité |
| --- | --- | --- |
| Export sans hypothèses | `FLOW.HYPOTHESIS_MISSING` | bloquant |
| Pondérations non déclarées | `FLOW.WEIGHTS_UNDECLARED` | bloquant |
| Somme des parts différente de 100 % | `FLOW.WEIGHTS_NOT_NORMALIZED` | bloquant |
| Corrélation insuffisante pour un montant | `FLOW.CORRELATION_TOO_LOW` | bloquant |

Les deux derniers figurent au catalogue D2.2.

## N3.4 Écrans

Profils, hypothèses, carte d'exposition, comparaison de scénarios, rapport de flux.

## N3.5 Intégration

Lit : socle, plus surfaces et loyers du module 09 si souscrit. Produit : parcours, points de décision, exposition. Consommé par : 02, 05, 09.

## N3.6 Critères d'acceptation

1. Deux calculs sur les mêmes hypothèses donnent le même résultat.
2. Modifier une pondération change l'indice, et le rapport le mentionne.
3. Un export tenté sans hypothèses échoue avec son code.
4. Un montant est refusé tant que la corrélation est sous le seuil.

## N3.7 Ouvert

La méthode de pondération est défendable, non validée par un professionnel de la commercialisation. C'est un préalable à la vente d'un audit chiffré.

---

# Module 04. Signalétique

## N4.1 Rôle et frontière

Produire les supports fabricables à partir du tableau des messages.

**Frontière avec le module 02.** Il reçoit le contenu et l'implantation. Il ne les décide pas et ne peut pas les modifier.

## N4.2 Entités et champs

**`support_typology`**

| Champ | Type | Contrainte |
| --- | --- | --- |
| `key` | texte | Unique par organisation |
| `face_count` | entier | 1 à 4 |
| `template_key` | référence | Gabarit par défaut |
| `default_substrate` | texte | |
| `registry` | énuméré | `wayfinding` ou `safety` |

**`support`, attributs de fabrication**

| Champ | Type | Contrainte |
| --- | --- | --- |
| `width_mm`, `height_mm` | entier | Calculés par défaut |
| `dimensions_source` | énuméré | `computed` ou `overridden` |
| `substrate_key` | texte | |
| `mounting` | structure | Type de fixation, hauteur, dégagement |

**`content_block`**

| Champ | Type | Contrainte |
| --- | --- | --- |
| `kind` | énuméré | `resolved`, `free`, `pictogram`, `map`, `legend` |
| `binding` | structure | Pour `resolved` : référence à `message_line` |
| `free_text` | structure | Pour `free` uniquement, une valeur par langue |

## N4.3 Règles métier

**M04.G1.** Un bloc `resolved` référence une `message_line`. Il ne résout jamais depuis le graphe directement.

**M04.G2.** Un bloc `free` est le seul dont le texte est saisi.

**M04.G3.** Le format est calculé depuis le contenu, la distance de lecture et la variante linguistique la plus longue. `overridden` est un choix explicite qui déclenche un contrôle bloquant si le résultat n'est pas conforme.

**M04.G4.** Aucune valeur normative dans le code. Hauteur de caractère, contraste, dimensions de pictogramme viennent du paquet de règles.

**M04.G5.** Le registre de sécurité est verrouillé. Aucune charte ne peut en modifier une couleur, une géométrie, un pictogramme ou une proportion. Le moteur refuse, il n'avertit pas.

**M04.G6.** Un plan mural n'est pas un fichier mais une famille de fichiers, un par implantation, orienté selon l'azimut du support.

**M04.G7.** Une version approuvée est immuable. Une correction crée une nouvelle version.

**M04.G8.** Un contrôle bloquant empêche l'émission d'une épreuve. Il ne peut être ni ignoré, ni accepté, ni reporté.

**M04.G9.** Le rendu est déterministe. Deux compilations du même état produisent des fichiers identiques.

**M04.G10.** Les plans d'évacuation sont un livrable nommé, avec leurs propres règles d'orientation, de légende et de contenu.

## N4.4 Contrôles

Ceux du domaine `LAYOUT` en partie D, plus `SECURITY.REGISTRY_WRITE_DENIED` et `SECURITY.CHARTER_OVERRIDE_DENIED`.

## N4.5 Écrans

Implantation en lecture, composition de face, contrôle de face, plans muraux, plans d'évacuation, bons à tirer, quantitatif.

L'écran de contrôle de face n'autorise aucune édition libre. Sa spécification figure en partie F.

## N4.6 Intégration

Lit : `message_line` du module 02, scène et annuaire du socle, charte, paquet de règles. Produit : exécutions, quantitatif, bons à tirer. Consommé par : 07, 08, 09.

Dégradation : sans module 02, ne fonctionne pas. Sans paquet de règles, refuse de composer et le dit.

## N4.7 Critères d'acceptation

1. Un carnet complet est accepté par un fabricant réel.
2. Deux compilations du même état produisent des fichiers identiques, octet pour octet.
3. Toute tentative de modification du registre de sécurité échoue, un test par voie de contournement.
4. Deux supports d'azimut différent produisent deux plans différents, la destination physiquement devant le support apparaissant dans la moitié supérieure.
5. Une version approuvée résiste à toute tentative de modification, y compris avec le rôle d'administration.

## N4.8 Ouvert

Le déterminisme de la sortie PDF, non acquis, tranché par la tâche T-0.9.

---

# Module 05. Régie publicitaire

## N5.1 Rôle et frontière

Commercialiser les emplacements publicitaires d'un site, du recensement à la facture.

**Frontière ferme, à porter au contrat.** Azimut émet les factures et les états de vente. Il n'est jamais le livre comptable. Il exporte vers la comptabilité du client, et ne tient ni grand livre, ni déclaration fiscale, ni rapprochement bancaire. Franchir cette ligne obligerait à suivre les réglementations fiscales de chaque pays de vente.

**Seconde frontière.** Inventaire et planning des écrans numériques, jamais la diffusion, confiée à un système tiers.

## N5.2 Règles métier

**M05.R1.** Un emplacement publicitaire est un objet distinct d'un support de signalétique, même s'il partage la géométrie du site. Il n'entre dans aucun quantitatif de signalétique.

**M05.R2.** La tarification s'indexe sur l'exposition calculée par le module 03. Sans ce module, la grille est saisie à la main et l'écran le signale.

**M05.R3.** Une option porte une date d'expiration. Elle tombe seule, sans intervention.

**M05.R4.** Un emplacement ne peut pas être réservé deux fois sur des périodes qui se recoupent.

**M05.R5.** Tout visuel reçu est assaini avant stockage, selon les règles d'import d'actifs déjà posées. Un visuel non assaini n'est jamais rendu.

**M05.R6.** Les contrôles techniques sont automatiques : format, résolution, zone de sécurité, profil colorimétrique, poids. Les contrôles de fond sont déclaratifs et validés par un humain : conformité au règlement du site, contenu interdit, mentions légales.

**M05.R7.** Les règles publicitaires applicables viennent d'une extension du paquet de règles, enfichable, versionnée, refusée sans référence documentaire. En son absence, le module produit une anomalie et n'invente aucune règle.

**M05.R8.** Le rendu en situation compose le visuel reçu sur la vue du plan, à l'emplacement et à l'échelle réels. Il porte une mention d'aperçu, jamais présenté comme une épreuve.

**M05.R9.** Une facture n'est jamais créée par un événement. Elle naît d'une décision humaine.

## N5.3 Contrôles

`AD.PLACEMENT_DOUBLE_BOOKED`, `AD.CREATIVE_SPEC_MISMATCH`, `AD.OPTION_EXPIRED`, `AD.RULES_PACK_MISSING`, `ASSET.SANITIZATION_FAILED`.

## N5.4 Écrans

Inventaire des emplacements, fiche technique, planning d'occupation, contrats, réception des visuels, rendu en situation, espace annonceur.

L'espace annonceur porte l'identité du site, jamais celle d'Azimut, et n'expose ni les données du site ni celles des autres annonceurs.

## N5.5 Intégration

Lit : géométrie du socle, exposition du module 03, paquet de règles publicitaires. Produit : fiches techniques, planning, factures, états de vente. Consommé par : 09, 10.

## N5.6 Critères d'acceptation

1. Deux réservations qui se recoupent sont refusées avec leur code.
2. Un visuel non conforme à la fiche technique est refusé, chaque critère testé séparément.
3. Un visuel non assaini ne peut pas être rendu.
4. Une facture ne peut pas être créée par un traitement automatique, vérifié par un test.
5. L'espace annonceur ne laisse fuir aucune donnée d'un autre annonceur, test d'étanchéité dédié.

## N5.7 Ouvert

Le corpus réglementaire publicitaire par pays. Mécanisme prêt, contenu absent.

---

# Module 06. Enseignes locataires

## N6.1 Rôle et frontière

Instruire et suivre les projets de devanture au regard du règlement d'enseigne.

**Frontière ferme.** Une enseigne locataire appartient au locataire. Elle est instruite et suivie, jamais conçue par Azimut. Elle n'est pas un support et n'entre dans aucun quantitatif.

## N6.2 Règles métier

**M06.T1.** Le règlement d'enseigne est exprimé en règles contrôlables : hauteurs, débords, matériaux, éclairage, plages horaires, interdits.

**M06.T2.** Ce qui est mesurable est contrôlé automatiquement. Le reste fait l'objet d'un avis humain, et la distinction est visible.

**M06.T3.** Un refus est motivé. Un accord peut porter des réserves, qui se lèvent explicitement.

**M06.T4.** L'historique par cellule survit au changement de locataire.

**M06.T5.** Un constat de conformité après pose clôt le dossier, avec photographie.

## N6.3 Contrôles

`TENANT.RULE_VIOLATION`, plus les contrôles d'assainissement des pièces déposées.

## N6.4 Écrans

Règlement, dossiers déposés, instruction, constat de conformité, historique par cellule.

## N6.5 Intégration

Lit : destinations et géométrie du socle. Consommé par : 08 pour l'historique.

## N6.6 Critères d'acceptation

1. Un projet non conforme sur un critère mesurable est refusé automatiquement, avec le critère nommé.
2. Un accord sans levée de réserve ne clôt pas le dossier.
3. L'historique survit à deux changements de locataire sur la même cellule.

---

# Module 07. Chantier et pose

## N7.1 Rôle et frontière

Conduire la fabrication et la pose, de l'approbation au constat.

C'est le module qui comble le vide entre le bon à tirer approuvé et le support posé. Sans lui, les divergences sont détectées sans que leur origine soit connue.

## N7.2 Règles métier

**M07.C1.** Un lot de fabrication ne peut contenir que des versions approuvées. Une version en revue bloque la constitution du lot.

**M07.C2.** Un prestataire n'accède qu'aux exécutions du lot qui lui est rattaché. C'est le rôle le plus contraint du produit et il fait l'objet de tests dédiés.

**M07.C3.** Une réception peut porter des réserves. Une réserve non levée est visible jusqu'à sa levée, et bloque la clôture du lot.

**M07.C4.** Le constat de pose crée le support posé et fixe la version installée. C'est ce qui donne une origine connue à toute divergence ultérieure.

**M07.C5.** Un procès-verbal de pose porte une photographie. Sans elle, il n'est pas valide.

## N7.3 Contrôles

`INSTALL.RESERVATION_OPEN`, plus un code à ajouter pour un lot contenant une version non approuvée.

## N7.4 Écrans

Allotissement, ordres de fabrication, planning de pose, procès-verbaux, réserves.

## N7.5 Intégration

Lit : versions approuvées et exécutions du module 04. Produit : supports posés. Consommé par : 08, 09.

Dégradation : sans ce module, saisie manuelle des poses dans le module 08, origine des divergences inconnue.

## N7.6 Critères d'acceptation

1. Un lot contenant une version non approuvée est refusé.
2. Un prestataire ne voit aucune exécution hors de son lot, y compris par canal indirect.
3. Une réserve non levée empêche la clôture.
4. Le constat de pose crée bien le support posé avec la bonne version.

---

# Module 08. Exploitation et maintenance

## N8.1 Rôle et frontière

Maintenir le parc en condition, et détecter l'écart entre le conçu et le posé.

C'est le module qui fonde la logique d'abonnement. Sans lui, le produit redevient un outil de conception vendu au projet.

## N8.2 Règles métier

**M08.E1.** L'état conçu et l'état physique installé sont deux objets distincts. Les confondre supprime toute possibilité de détecter une divergence.

**M08.E2.** Une divergence est typée et datée. Elle ne disparaît jamais sans trace : elle se résout par un constat de pose conforme, ou s'accepte par une décision explicite tracée.

**M08.E3.** Un ordre de travaux naît d'une décision humaine. Aucun événement ne le crée.

**M08.E4.** Une tournée d'inspection fonctionne hors ligne, en application web installable, sans application native.

**M08.E5.** Un relevé porte une photographie et une position dans le plan.

## N8.3 Contrôles

Les six types de divergence de la partie H, plus `SURVEY.SYNC_PENDING`.

## N8.4 Écrans

Tournées, relevé mobile hors ligne, incidents, divergences, ordres de travaux, état du parc.

## N8.5 Intégration

Lit : versions et empreintes du module 04, constats du module 07. Produit : divergences, ordres de travaux, indicateurs. Consommé par : 09, 10.

## N8.6 Critères d'acceptation

1. Une modification d'annuaire crée exactement les divergences attendues, ni plus ni moins.
2. Une divergence acceptée conserve sa trace.
3. Une tournée complète se réalise sans réseau et se synchronise sans perte.
4. Aucun ordre de travaux n'est créé automatiquement, vérifié par un test.

---

# Module 09. Budget et estimation

## N9.1 Rôle et frontière

Chiffrer et suivre. Le module ne décide rien, il valorise.

## N9.2 Règles métier

**M09.B1.** Un coût de référence est historisé. Le remplacer n'efface pas le précédent, sans quoi aucune comparaison dans le temps n'est possible.

**M09.B2.** Multi-devises, avec la devise portée par la ligne et jamais supposée.

**M09.B3.** Une estimation porte la date et la version des coûts de référence utilisés.

**M09.B4.** L'écart entre estimé, engagé et réalisé est toujours affiché ensemble. Un chiffre seul induit en erreur.

**M09.B5.** Le coût de reprise sur mutation ne valorise que les supports réellement périmés, selon l'empreinte de contenu.

## N9.3 Contrôles

`COST.REFERENCE_MISSING`, plus un code pour une devise absente.

## N9.4 Écrans

Coûts de référence, estimation, suivi budgétaire, coût de reprise.

## N9.5 Intégration

Lit : quantitatif du module 04, lots du 07, ordres de travaux du 08, contrats du 05, exposition du 03.

Dégradation : absent, le quantitatif reste produit sans valorisation.

## N9.6 Critères d'acceptation

1. Une estimation se rejoue à l'identique avec la même version de coûts.
2. Le coût de reprise porte sur le nombre exact de supports périmés.
3. Un changement de coût de référence n'altère pas une estimation déjà émise.

---

# Module 10. Portefeuille

## N10.1 Rôle

Vue et consolidation multi-sites pour une organisation qui en gère plusieurs.

## N10.2 Règles métier

**M10.F1.** Une bibliothèque de portefeuille est héritée par les sites. Un site peut y déroger, la dérogation est explicite et visible.

**M10.F2.** Une charte de groupe suit la même logique d'héritage et de dérogation.

**M10.F3.** La consolidation ne franchit jamais la frontière d'organisation.

**M10.F4.** Une comparaison entre sites porte sur des indicateurs de même définition et de même date, ou elle ne se fait pas.

## N10.3 Écrans

Vue multi-sites, comparaison, bibliothèques partagées, consolidation budgétaire.

## N10.4 Critères d'acceptation

1. Une modification d'une bibliothèque de portefeuille se propage aux sites non dérogataires, et à eux seuls.
2. Aucune donnée d'une autre organisation n'apparaît, y compris dans un agrégat.

---

# Module 11. Fonctions transverses

## N11.1 Rôle

Ce dont tous les modules ont besoin : documents, recherche, notifications, tâches, journal d'activité, tableau de bord.

## N11.2 Règles métier

**M11.X1.** La recherche globale n'expose jamais une entité d'un module non souscrit ni d'une organisation tierce. Test dédié.

**M11.X2.** Une pièce jointe est versionnée et rattachée à une entité, jamais flottante.

**M11.X3.** Les notifications sont réglables par utilisateur. Une notification non réglable devient du bruit et fait ignorer les autres.

**M11.X4.** Le journal d'activité visible par l'utilisateur est distinct du journal d'audit technique, qui reste en insertion seule.

**M11.X5.** Un tableau de bord montre ce qui attend l'utilisateur dans son rôle. Jamais une collection d'indicateurs décoratifs.

## N11.3 Critères d'acceptation

1. La recherche ne remonte rien d'un module non souscrit, ni d'une autre organisation.
2. Une pièce jointe survit à trois versions successives, chacune consultable.
3. Le journal d'audit résiste à une tentative de modification avec le rôle d'administration.

---

# Module 12. Atelier de dessin

## N12.1 Rôle et frontière

Surface d'édition commune des modules 01, 02, 04 et 05. Il ne possède aucune donnée métier.

Spécifié en parties E, I et J. Cette fiche récapitule les règles opposables.

## N12.2 Règles métier

**M12.A1.** Trois contextes d'édition, jamais confondus : géométrie et habillage librement éditables, gabarits édités visuellement mais produisant une donnée, faces de supports non éditables.

**M12.A2.** L'atelier n'écrit jamais directement en base. Il appelle les commandes du module propriétaire. C'est ce qui empêche la règle de propriété unique d'être contournée par l'interface.

**M12.A3.** L'encre est une méthode de saisie, pas une donnée. La forme reconnue est quantifiée au millimètre, le tracé disparaît. Deux exceptions cantonnées : la couche d'esquisse et l'annotation de révision.

**M12.A4.** Toute opération est quantifiée à la validation du geste, jamais pendant, jamais au rendu.

**M12.A5.** Toute opération réalisable au pointeur l'est au clavier, y compris le dessin.

**M12.A6.** La pile d'annulation est vidée à la synchronisation. Revenir sur une modification synchronisée se fait par une commande inverse tracée.

**M12.A7.** Aucune bibliothèque tierce de dessin, de diagramme ou de gestion d'état.

**M12.A8.** Le tracé libre au doigt est exclu. La pression et l'inclinaison ne servent que la couche d'esquisse.

**M12.A9.** Le budget de rendu est mesuré à l'exécution. Le mode allégé change la façon de dessiner, jamais le résultat.

## N12.3 Critères d'acceptation

1. Une forme tracée au stylet et la même saisie au clavier produisent des données identiques.
2. Une esquisse n'apparaît dans aucun export destiné à un tiers, contrôle automatisé.
3. Une opération interdite dans son contexte est refusée avec son code.
4. Le mode allégé et le mode complet produisent le même état final après la même séquence.

---

# N13. Ce que cette partie ne couvre pas

Historique. Cette liste ne fait plus foi. Les points encore ouverts sont repris dans le registre de la partie K, section K3, seule liste à tenir.

1. **Les écrans, sauf ceux de la partie M.** Les autres se conforment aux onze règles de M7 et seront spécifiés en entrant dans leur incrément.
2. **Le tableau des messages, au champ près.** C'est la spécification d'écran qui vient ensuite, et celle qui débloque la composition.
3. **Les champs des modules 05 à 11.** Volontairement non descendus au champ, conformément à N0.
4. **Les droits de rôle module par module.** Les sept rôles sont définis, leur déclinaison fine reste à faire au moment de construire chaque module.
5. **Le chiffrage.** Cette partie ne modifie pas le périmètre, elle le précise. La décomposition de la partie I reste valable.

---

# PARTIE O. Audit par parcours d'usage réel

Cette partie ne relit pas les documents. Elle suit le parcours d'un client réel, de la démonstration commerciale à la fin du contrat, et relève chaque étape qu'aucune exigence ne porte. C'est ce type de lecture qui aurait trouvé l'absence de chemin d'écriture.

---

## O0. Méthode et résultat

Le parcours est découpé en quatorze étapes. Pour chacune, la question est unique : quelle exigence numérotée porte cette étape ? Si aucune, c'est un manque.

**Résultat : quinze manques.** Dont une incohérence du modèle de données, deux fonctions majeures pour l'exploitation sur plusieurs années, et une table construite par l'agent sans spécification.

| Étape du parcours | Couverte | Manques |
| --- | --- | --- |
| 1. Démonstration et essai | Non | O1 |
| 2. Contractualisation | Partiellement | O2 |
| 3. Création de l'organisation | Partiellement | O3 |
| 4. Mise en service du site | Oui, parties M et D | O4, O5 |
| 5. Charte du client | Non | O6 |
| 6. Stratégie et tableau des messages | Oui, parties H et N | aucun |
| 7. Validation par la maîtrise d'ouvrage | Partiellement | O7 |
| 8. Consultation des fabricants | Non | O8 |
| 9. Fabrication et pose | Oui, module 07 | aucun |
| 10. Livraison du dossier final | Non | O9 |
| 11. Mise en service des bornes | Partiellement | O10 |
| 12. Exploitation sur plusieurs années | Partiellement | O11, O12 |
| 13. Assistance et évolutions | Non | O13, O14 |
| 14. Fin de contrat | Partiellement | O15 |

Les quinze manques sont tous spécifiables. Aucun ne demande un expert externe, sauf un point juridique signalé en O7.

---

## O1. Démonstration et période d'essai

**Constat.** Le modèle de droits prévoit un état d'essai, mais rien ne dit comment un prospect découvre le produit. Or on ne peut pas faire une démonstration sur les données d'un client : elles sont confidentielles et cloisonnées.

**Spécification.**

- Une organisation de démonstration, livrée avec le produit, contenant un site fictif complet : plan, graphe, annuaire, tableau des messages, supports, bornes, divergences. Construite à partir des sites de référence du `testkit`, jamais à partir de données réelles.
- Réinitialisation automatique à un état connu, quotidienne, pour que chaque démonstration parte du même point.
- Une période d'essai crée une organisation vierge, avec tous les modules en état `trial`, pour une durée déclarée en constante.
- À l'expiration, les données de l'essai sont conservées en lecture pendant une durée déclarée, puis supprimées selon O15. Jamais supprimées sans préavis.

**Critères.** L'organisation de démonstration ne contient aucune donnée réelle, vérifié par un test. Sa réinitialisation rend un état identique octet pour octet.

---

## O2. Facturation de l'abonnement Azimut

**Constat.** Les documents spécifient en détail la facturation de la régie publicitaire, qui est l'activité du client. Ils ne spécifient pas la facturation d'Azimut lui-même, qui est votre revenu. Le modèle de droits dit ce qui est ouvert, pas ce que le client paie.

**Spécification.**

- Un abonnement porte l'organisation, les sites, les modules souscrits, la tranche, la devise, la périodicité et les dates.
- Changer de tranche ou ajouter un module produit un avenant tracé, jamais une modification silencieuse.
- Les factures d'abonnement sont émises par Atlas Studio, pas par le client. Elles relèvent d'un circuit distinct de celui de la régie, et d'une table distincte.
- Même frontière qu'en régie : le produit émet et exporte, il n'est pas le livre comptable d'Atlas Studio.
- Moyens de paiement locaux et multi-devises, déjà posés en principe, à arrêter lors du choix du prestataire de paiement.

**Point ouvert.** Le choix du prestataire de paiement relève de la procédure d'arrêt et de demande, avec une contrainte : disponibilité sur les trois pays de base.

---

## O3. Cycle de vie des comptes

**Constat.** Les sept rôles sont définis. La double authentification est exigée pour deux d'entre eux. Mais rien ne dit comment un utilisateur arrive, s'active, se réinitialise ou part.

**Spécification.**

- Invitation par l'administrateur, lien à usage unique et durée de validité limitée.
- Activation avec enrôlement de la double authentification pour les rôles qui l'exigent. Un compte de ces rôles sans double authentification enrôlée ne peut rien faire d'autre que l'enrôler.
- Réinitialisation du mot de passe et récupération de la double authentification, avec journalisation.
- **Départ d'un collaborateur.** Désactivation immédiate, jamais suppression : ses approbations et son journal d'audit restent attribués. Ses verrous consultatifs tombent. Ses tâches sont réaffectées avant désactivation, ou signalées.
- Un administrateur ne peut pas se retirer ses propres droits s'il est le dernier administrateur de l'organisation.

**Critères.** Un compte désactivé ne peut plus se connecter, et ses approbations passées restent lisibles et attribuées. Le dernier administrateur ne peut pas se destituer.

---

## O4. Fuseau horaire du site, incohérence du modèle

**Constat.** La partie N spécifie que les horaires d'ouverture d'un bâtiment sont exprimés « dans le fuseau du site ». La table `site` ne porte aucun fuseau. L'exigence référence une donnée qui n'existe pas.

**Correction.** Ajout du champ `site.timezone`, identifiant de fuseau normalisé, requis à la création. Tous les horaires, disponibilités d'arêtes, plages de fermeture et échéances de contrats s'interprètent dans ce fuseau. Les horodatages techniques restent en temps universel.

**Critère.** Une disponibilité horaire s'évalue correctement sur deux sites de fuseaux différents appartenant à la même organisation.

---

## O5. Import des données de comptage

**Constat.** Le module 03 prévoit d'importer des données réelles de fréquentation. La partie D spécifie les formats d'import du carnet de supports et de l'état locatif, pas celui du comptage.

**Spécification du format.**

| Colonne | Obligatoire | Type |
| --- | --- | --- |
| `sensor_ref` | oui | texte, rattaché à un nœud ou à une arête |
| `period_start`, `period_end` | oui | horodatage, fuseau du site |
| `count_in` | oui | entier |
| `count_out` | non | entier |
| `source` | oui | texte, nom du système de comptage |

Règles : l'origine et la date d'import sont conservées. Une période qui chevauche une période déjà importée pour le même capteur est rejetée. Les données de comptage ne sont jamais produites par Azimut, seulement importées.

---

## O6. Charte du client

**Constat.** Les tables de charte sont spécifiées, couleurs, typographies, règles d'adjacence, lexique. Aucun écran ni aucun parcours ne dit comment une charte entre dans le produit. Or c'est la deuxième chose qu'un client fournit, après ses plans.

**Spécification.**

- Écran de création de charte, famille registre : couleurs avec référence de nuancier, valeur d'affichage et rôle, typographies avec contrôle de licence, règles d'adjacence, lexique interdit et déconseillé.
- Import des polices avec les contrôles de la partie G.
- Aperçu de contrôle : la charte appliquée à un gabarit de démonstration, avec les contrôles de contraste calculés et visibles.
- Versionnement : toute modification crée une version. Les faces composées sous l'ancienne version deviennent périmées selon l'empreinte de contenu.
- Refus explicite de toute règle qui toucherait le registre de sécurité.

**Critère.** Modifier une couleur de charte marque périmées exactement les faces qui l'emploient.

---

## O7. Relecteur externe de la maîtrise d'ouvrage

**Constat.** Le rôle de validation existe. Mais dans la réalité, la maîtrise d'ouvrage est souvent extérieure au client : un bureau d'études, un architecte, un assistant à maîtrise d'ouvrage. Le modèle ne dit pas comment on lui donne accès sans lui attribuer un siège complet.

**Spécification.**

- Un accès invité, limité à un site, à une période et à un périmètre : tableau des messages et bons à tirer.
- Droits : consulter, annoter en révision, approuver ou rejeter. Rien d'autre.
- Accès révocable, avec expiration automatique.
- Ne compte pas comme un siège dans la tranche d'abonnement.
- Double authentification obligatoire, puisque l'invité peut approuver.

**Point juridique à ouvrir au registre.** La valeur probante d'une approbation électronique dans le produit, au regard du droit de chaque pays. Le produit trace et horodate, il ne garantit pas la valeur juridique d'une signature. Relève d'un conseil juridique.

---

## O8. Consultation des fabricants

**Constat.** Entre le bon à tirer approuvé et la fabrication, il y a dans la réalité une consultation : le carnet est envoyé à plusieurs fabricants, qui répondent par des offres à comparer. Le module 07 commence à l'allotissement, une fois le fabricant choisi. Le module 09 compare un devis reçu, mais ne dit pas d'où il vient.

**Spécification.**

- Constitution d'un dossier de consultation depuis les versions approuvées : carnet, exécutions, quantitatif au format bordereau.
- Envoi à plusieurs prestataires, chacun avec un accès limité à ce dossier.
- Saisie ou dépôt des offres, ligne à ligne sur le quantitatif, pour que la comparaison soit ligne à ligne et non au total.
- Tableau comparatif calculé : écarts par ligne, lignes non chiffrées, lignes chiffrées hors quantité.
- Attribution tracée, qui alimente l'allotissement du module 07.

**Règle.** Une offre qui ne chiffre pas toutes les lignes est signalée, jamais complétée par une valeur supposée.

**Rattachement.** Nouveau lot du module 07, avant l'allotissement.

---

## O9. Dossier de livraison final

**Constat.** L'agent a créé en base une table `delivery_package`, sans spécification correspondante dans les documents. Le besoin est réel : à la fin d'une opération, le client reçoit un dossier complet. Mais son contenu n'est défini nulle part, et une table sans spécification est exactement ce que la règle de propriété unique interdit.

**Spécification.**

Contenu du dossier, généré et non assemblé à la main :

- Carnet final des supports posés, avec versions installées.
- Plans d'implantation par niveau.
- Tableau des messages approuvé, dans sa version finale.
- Exécutions de fabrication archivées au format d'archivage.
- Procès-verbaux de pose et levées de réserves.
- Fiches techniques des typologies et substrats.
- Registre des pictogrammes employés, avec leur état de compréhension.

Règles : le dossier est figé à son émission, porte une empreinte, et reste consultable après la fin du contrat pendant la durée de conservation de O15.

**Action sur l'existant.** La table `delivery_package` est à confronter à cette spécification. Son module propriétaire est le module 07.

---

## O10. Supervision du parc de bornes

**Constat.** La télémétrie spécifiée enregistre ce que font les visiteurs : recherches, destinations, retours à l'accueil. Rien ne dit si une borne fonctionne. Un exploitant qui gère dix bornes a besoin de savoir laquelle est éteinte.

**Spécification.**

- Chaque borne émet un signal de présence périodique quand le réseau est disponible, portant sa version de paquet et son état.
- Tableau de supervision : borne, dernier contact, version déployée, version attendue, état.
- Anomalie quand une borne n'a pas émis depuis une durée déclarée, et quand sa version diffère de la version publiée.
- Aucune donnée de visiteur dans ce signal. C'est de la supervision d'appareil, distincte de la télémétrie d'usage.

**Précision.** Une borne hors ligne n'est pas une borne en panne : elle affiche sa copie locale. Le tableau distingue les deux, faute de quoi il déclencherait de fausses alertes à chaque coupure réseau.

---

## O11. Fermetures temporaires et signalétique provisoire

**Constat.** Une arête porte des horaires de disponibilité, qui se répètent chaque semaine. Rien ne permet de fermer une circulation pour des travaux du 3 au 17 mars, ni de produire la signalétique de déviation correspondante. C'est pourtant l'une des situations les plus fréquentes dans la vie d'un site.

**Spécification.**

- Une fermeture temporaire porte une ou plusieurs arêtes, une date de début, une date de fin, un motif.
- Pendant la fermeture, les parcours sont recalculés sans ces arêtes, et les points de décision qui en résultent sont dérivés.
- Le système produit la liste des supports provisoires nécessaires, et le tableau des messages provisoire correspondant.
- Les bornes affichent le parcours dévié pendant la période, avec mention de la fermeture.
- À la date de fin, retour automatique à l'état nominal, et la signalétique provisoire passe en dépose.

**Règle.** Une signalétique provisoire est une donnée à part, datée, qui ne modifie jamais le tableau des messages nominal.

**Critère.** Une fermeture de deux arêtes sur une période donnée produit exactement les parcours et les supports provisoires attendus, et l'état nominal revient intact à la date de fin.

---

## O12. Versionnement de la géométrie du site

**Constat.** Les supports, les faces, le tableau des messages et les chartes sont versionnés. La géométrie du site ne l'est pas. Or un site vit : une cellule est scindée, une extension est construite, un escalier est ajouté. Sans version, on perd la trace de ce qu'était le site quand un support a été posé, et la couche de divergence ne peut plus dire si l'écart vient du support ou du bâtiment.

**Spécification.**

- Une modification structurelle du socle, empreintes, volumes, arêtes, liaisons, est rattachée à un état daté du site.
- Un état validé est figé. Les travaux de réaménagement se modélisent dans un état futur, sans altérer l'état en vigueur.
- Bascule d'un état au suivant à une date déclarée, qui déclenche la chaîne de propagation de la partie L.
- Comparaison entre deux états : empreintes ajoutées, supprimées, modifiées.
- Chaque support posé référence l'état du site en vigueur à sa pose.

**Conséquence sur la divergence.** Un écart entre un support et son environnement se qualifie désormais : le support a changé, ou le site a changé. C'est ce qui rend la divergence exploitable sur plusieurs années.

**Rattachement.** Incrément 3, avec la couche de divergence. C'est le plus lourd des quinze manques, lot de taille L.

---

## O13. Assistance et documentation

**Constat.** Rien n'est spécifié sur l'aide à l'utilisateur. Or le produit est dense, destiné à des opérateurs experts, et vendu sur des marchés où l'assistance en présentiel coûte cher.

**Spécification.**

- Aide contextuelle par écran, tirée d'une documentation versionnée avec le produit, dans les deux langues.
- Chaque code d'anomalie renvoie à une page expliquant sa cause et sa correction. C'est le moyen le plus rentable de réduire les demandes d'assistance.
- Demande d'assistance depuis le produit, qui joint automatiquement le contexte technique utile : écran, version, identifiant d'erreur. Jamais le contenu métier du site sans accord explicite de l'utilisateur.
- Notes de version publiées à chaque mise à jour.

---

## O14. Montée de version du produit

**Constat.** Le manifeste du paquet de borne porte une version minimale d'exécution. Rien ne dit ce qui se passe pour les données des clients quand le produit évolue, ni pour les bornes déjà déployées.

**Spécification.**

- Toute mise à jour qui modifie le modèle de données est accompagnée d'une migration des données existantes, testée sur une copie des sites de référence avant déploiement.
- Une mise à jour ne rend jamais illisible une version approuvée, un dossier de livraison ou un journal d'audit antérieurs.
- Les bornes déployées continuent de fonctionner avec leur paquet tant qu'il reste compatible. Une incompatibilité est signalée dans la supervision de O10, jamais découverte par une borne en panne.
- Un paquet de règles et une charte conservent leur version d'origine sur les éléments déjà approuvés. Une mise à jour du produit ne recalcule jamais silencieusement un élément approuvé.

---

## O15. Fin de contrat

**Constat.** La réversibilité est exigée par le cahier des charges principal comme argument commercial. Aucun parcours ne dit comment elle s'exerce, ni ce que deviennent les données après la résiliation.

**Spécification.**

- **Export de réversibilité** complet, en formats ouverts, déclenchable par l'administrateur à tout moment et automatiquement proposé à la résiliation.
- **Préavis** : à la résiliation, l'organisation passe en lecture seule pendant une durée déclarée, avec export toujours possible.
- **Suppression** à l'issue du préavis, effective et vérifiable, avec attestation de suppression remise au client.
- **La purge est une procédure explicite**, exécutée par la plateforme, jamais une cascade. Dans l'ordre : anonymisation du journal d'audit, puis suppression des lignes des tables en insertion seule de la section A12.3, puis suppression des données de l'organisation. Le refus de suppression posé en section A5.11 garantit que rien n'est oublié : une table restée peuplée bloque la purge et se signale.
- **La purge est tracée hors des données du client**, chez Atlas Studio, par l'attestation et sa date. C'est la seule trace conservée.
- **Exceptions à la suppression**, déclarées et limitées : les factures d'abonnement émises par Atlas Studio, soumises à conservation légale.
- Le journal d'audit est anonymisé et non conservé tel quel, pour ne pas garder de données personnelles au-delà du nécessaire.

**Critère.** Après suppression, aucune donnée de l'organisation n'est accessible, y compris dans les sauvegardes au terme de leur durée de rotation. L'attestation porte cette date.

---

## O16. Ajouts au modèle de données

```sql
demo_seed            (id, key, version, source_testkit_site, reset_at)

subscription         (id, org_id, tier, currency, period, from_date, to_date, state)
                     state in ('trial','active','suspended','terminated','expired')
subscription_line    (id, org_id, subscription_id, module_key, site_id)
subscription_invoice (id, org_id, subscription_id, reference, issued_at,
                      amount_minor bigint, currency, state, exported_at)
                     state in ('draft','issued','exported','cancelled')

user_invitation      (id, org_id, email, role, token_hash, expires_at, accepted_at)
                     role in ('admin','designer','owner_rep','vendor','operator','auditor','marketing')
guest_access         (id, org_id, site_id, email, scope jsonb, expires_at, revoked_at)

site                 (..., timezone)

counter_import       (id, org_id, site_id, sensor_ref, period_start, period_end,
                      count_in int, count_out int, source, imported_at)

charter_version      (id, org_id, charter_id, version int, created_at)

vendor_consultation  (id, org_id, site_id, reference, state, issued_at, closes_at)
                     state in ('draft','issued','closed','awarded','cancelled')
vendor_offer         (id, org_id, consultation_id, vendor_id, submitted_at, state)
                     state in ('invited','submitted','withdrawn','awarded','not_awarded')
vendor_offer_line    (id, org_id, offer_id, quantity_line_ref,
                      unit_price_minor bigint, quantity numeric)

delivery_package     (id, org_id, site_id, issued_at, content_hash,
                      storage_path, retention_until)

kiosk_heartbeat      (id, org_id, kiosk_id, seen_at, package_version, state)
                     state in ('running','updating','update_failed','rolled_back','error')

temporary_closure    (id, org_id, site_id, edge_ids jsonb, from_at, to_at, reason)
provisional_support  (id, org_id, closure_id, node_id, azimuth_deg,
                      content jsonb, state)
                     state in ('planned','installed','to_remove','removed')

site_state           (id, org_id, site_id, label, effective_from, state)
                     state in ('draft','validated','active','superseded')

support_request      (id, org_id, user_id, screen, app_version, error_ref,
                      message, created_at, consent_content boolean)

termination          (id, org_id, requested_at, read_only_until,
                      deleted_at, certificate_path)
```

Toutes ces tables portent `org_id`, sauf `demo_seed`, et arrivent avec leur politique de cloisonnement dans la même migration.

---

## O17. Ajouts au catalogue des codes d'anomalie

| Code | Gravité | Sens |
| --- | --- | --- |
| `ACCOUNT.MFA_NOT_ENROLLED` | bloquant | Compte sans double authentification enrôlée alors qu'elle est exigée |
| `ACCOUNT.LAST_ADMIN` | bloquant | Tentative de retrait du dernier administrateur |
| `DATA.TIMEZONE_REQUIRED` | bloquant | Site sans fuseau horaire |
| `IMPORT.COUNTER_OVERLAP` | bloquant | Période de comptage chevauchant une période déjà importée |
| `VENDOR.OFFER_INCOMPLETE` | avertissement | Offre ne chiffrant pas toutes les lignes |
| `KIOSK.NO_HEARTBEAT` | avertissement | Borne sans signal depuis la durée déclarée |
| `KIOSK.VERSION_MISMATCH` | avertissement | Version déployée différente de la version publiée |
| `CLOSURE.OVERLAP` | avertissement | Fermetures temporaires se recoupant sur une même arête |
| `SITE_STATE.ACTIVE_LOCKED` | bloquant | Modification directe d'un état de site en vigueur |
| `TERMINATION.EXPORT_PENDING` | avertissement | Résiliation sans export de réversibilité effectué |

---

## O18. Rattachement

| Manque | Rattachement | Taille |
| --- | --- | --- |
| O4 Fuseau horaire | Incrément 0, correction immédiate | S |
| O3 Cycle de vie des comptes | Incrément 0 | M |
| O6 Charte du client | Incrément 1 | M |
| O5 Format de comptage | Incrément 1, avec le module 03 | S |
| O7 Relecteur externe | Incrément 2 | M |
| O8 Consultation des fabricants | Incrément 3, module 07 | M |
| O9 Dossier de livraison | Incrément 3, module 07 | M |
| O10 Supervision des bornes | Incrément 3 | M |
| O11 Fermetures temporaires | Incrément 3 | L |
| O12 Versionnement du site | Incrément 3 | L |
| O1 Démonstration et essai | Incrément 4 | M |
| O2 Facturation d'abonnement | Incrément 4 | M |
| O13 Assistance et documentation | Incrément 4 | M |
| O14 Montée de version | Incrément 4 | M |
| O15 Fin de contrat | Incrément 4 | M |

O4 est à corriger tout de suite : c'est une incohérence du modèle, pas une fonction. Et O9 demande une vérification immédiate de la table déjà créée par l'agent.

---

## O19. Ajouts au registre des points ouverts

À inscrire dans la partie K :

| Sujet | Responsable | Déclencheur | Niveau |
| --- | --- | --- | --- |
| Valeur probante de l'approbation électronique | Conseil juridique | Avant la première approbation par un tiers | L |
| Choix du prestataire de paiement | Atlas Studio | Avant la première facture d'abonnement | V |
| Durées de conservation, préavis, rotation des sauvegardes | Conseil juridique | Avant le premier contrat | V |

---

## O20. Ce que cet audit ne garantit pas

Historique. Cette liste ne fait plus foi. Les points encore ouverts sont repris dans le registre de la partie K, section K3, seule liste à tenir.

Cet audit a suivi un seul parcours, celui d'un exploitant qui conçoit puis maintient un site. Il ne suit ni le parcours d'un annonceur, ni celui d'un locataire, ni celui d'un fabricant, ni celui d'un visiteur devant une borne. Chacun de ces parcours peut révéler d'autres manques.

Il ne garantit donc pas l'exhaustivité. Il garantit que le parcours principal, celui qui produit le revenu, est désormais porté par une exigence à chaque étape.

---

# PARTIE P. Module 13, application visiteur

Cette partie spécifie l'application qui tourne sur les totems électroniques et sur le téléphone du visiteur.

---

## P0. Pourquoi cette partie, et deux corrections

### P0.1 Le trou d'architecture

La mécanique technique de la borne était couverte, dispersée entre les parties A, D, F et O : format du paquet, mise à jour, hors ligne, configuration par borne, télémétrie, supervision.

L'application elle-même ne l'était pas : ce que le visiteur voit et fait devant le totem n'était spécifié nulle part.

Plus grave, dans le modèle d'intégration de la partie L, les tables `kiosk`, `kiosk_package`, `kiosk_telemetry` et `kiosk_heartbeat` n'appartenaient à aucun module. C'est une violation directe de la règle de propriété unique. Elles appartiennent désormais au module 13.

### P0.2 Le nom

Deux mots presque identiques désignent deux choses différentes :

| Terme | Module | Nature |
| --- | --- | --- |
| Wayfinding | 02 | Stratégie d'orientation, outil de conception |
| Wayfinder | 13 | Application utilisée par le visiteur |

Pour éviter une confusion permanente dans le code et dans les échanges, le module 13 s'appelle **application visiteur** dans le code, avec le préfixe `visitor_` pour ses tables nouvelles. Le mot « Wayfinder » peut rester dans la communication commerciale, jamais dans le code.

### P0.3 Deux décisions antérieures révisées

**Diffusion de contenu.** Le cahier des charges excluait toute diffusion. Elle est désormais permise, **uniquement sur les totems qui exécutent l'application visiteur**. Les écrans numériques d'autres fabricants restent pilotés par un système tiers, avec l'export spécifié en partie I.

**Données personnelles.** La borne n'en contenait aucune. L'inscription au programme de fidélité en introduit dans le produit, mais **jamais sur la borne** : elle se fait sur le téléphone du visiteur, par code à scanner. La borne reste sans donnée personnelle, et la télémétrie aussi. Voir P7.

---

## P1. Une application, deux surfaces

Le totem et le téléphone du visiteur exécutent la même application, déployée de deux façons.

| Surface | Mode | Réseau |
| --- | --- | --- |
| Totem | Paquet statique autonome, partie D | Hors ligne par défaut |
| Téléphone | Application web installable, atteinte par code à scanner | Réseau du téléphone |

Conséquence : l'application web visiteur, que le cahier des charges repoussait à l'incrément 5, est le même produit. Elle n'est pas développée séparément.

Le passage du totem au téléphone se fait par code à scanner, dans deux cas : emporter un itinéraire, s'inscrire au programme de fidélité.

---

## P2. Règles non négociables

Ces règles priment sur toute option commerciale. Une demande de client qui les contredit est refusée, quel que soit le montant de l'option.

**M13.V1. L'orientation prime toujours.** La recherche d'une destination est accessible en un seul geste depuis n'importe quel écran.

**M13.V2. Aucun contenu commercial entre la question et la réponse.** Aucune annonce, promotion ou invitation ne s'affiche entre le moment où le visiteur demande un chemin et celui où il l'obtient. Un totem qui impose une annonce avant d'indiquer le chemin cesse d'être un outil d'orientation.

**M13.V3. Rien ne recouvre l'information d'orientation ou de sécurité.** Aucun contenu commercial ne masque le repère de position, l'itinéraire, les sorties ni une information de sécurité.

**M13.V4. Un geste interrompt tout.** Pendant la boucle d'attente, le premier contact du visiteur arrête immédiatement le contenu en cours et ouvre l'accueil d'orientation. Jamais d'attente de fin d'annonce.

**M13.V5. Le mode urgence coupe tout.** Voir P10.

**M13.V6. Aucun clignotement dangereux.** Aucun contenu ne produit plus de trois éclairs par seconde. Contrôle automatique à la réception de chaque visuel. C'est une exigence d'accessibilité et de sécurité dans un lieu public, elle ne se discute pas.

**M13.V7. Silence par défaut.** Aucun contenu commercial n'émet de son. La sortie audio est réservée au mode accessible.

**M13.V8. L'identité est celle du site.** L'application affiche l'identité du site, jamais celle d'Azimut, sur le totem comme sur le téléphone. Règle déjà posée en partie F, rappelée parce que l'application visiteur est la surface la plus visible du produit.

**M13.V9. Aucune donnée personnelle sur la borne.** Ni saisie, ni stockage, ni transit.

---

## P3. Modèle commercial

| Élément | Statut |
| --- | --- |
| Orientation | Socle inclus, non dégradable, non optionnel |
| Publicité | Option payante |
| Fidélité | Option payante |
| Promotions et événements | Option payante |

Chaque option s'active séparément par le modèle de droits de la partie I. Une option non souscrite est absente de l'application, jamais grisée, jamais annoncée comme disponible.

Aucune option ne peut dégrader le socle. Un contrôle vérifie, pour chaque combinaison d'options, que les règles M13.V1 à M13.V9 restent satisfaites.

---

## P4. Place dans l'architecture

### P4.1 Couche et dépendances

Le module 13 se place en couche 2, aux côtés des modules 04, 05 et 06.

**Il lit** : le socle (scène, géométrie, annuaire, horaires), le module 02 (nomenclature et zones d'orientation, pour nommer les lieux), le module 03 (profils, pour calculer les itinéraires).

**Il ne lit jamais** le module 05.

### P4.2 Le cycle évité avec la régie

Un cycle apparaît, du même type que celui résolu en partie L.

La régie vend des annonces, le module 13 les diffuse. Pour diffuser, le module 13 devrait lire les contrats de la régie. Pour facturer, la régie devrait lire les comptages de diffusion du module 13. Chacun dépendrait de l'autre.

**Résolution.** La dépendance est rendue à sens unique :

- La régie **alimente** le module 13 en appelant ses commandes : elle lui transmet une liste de diffusion validée. Le module 13 reste propriétaire de ses listes de diffusion et les écrit lui-même, conformément à la règle de propriété unique.
- La régie **lit** les comptages de diffusion du module 13 pour facturer.
- Le module 13 **ne lit jamais** la régie.

La régie dépend du module 13, jamais l'inverse. Le graphe reste sans cycle.

### P4.3 Amendement à la partie L

La règle INT-3 de la partie L a été complétée : une lecture entre modules d'une même couche est permise si elle est déclarée dans la fiche des deux modules et si elle ne crée pas de cycle. Le complément est reporté dans la règle INT-3 elle-même.

### P4.4 Propriété des tables

| Table | Propriétaire |
| --- | --- |
| `kiosk`, `kiosk_package`, `kiosk_telemetry`, `kiosk_heartbeat` | 13 |
| `visitor_playlist`, `visitor_playlist_item` | 13, alimentées par 05 via commande |
| `visitor_display_count` | 13, lue par 05 |
| `visitor_campaign`, `visitor_campaign_target` | 13 |
| `visitor_loyalty_signup`, `visitor_consent` | 13 |
| `visitor_emergency_state` | 13 |
| `ad_contract`, `ad_creative`, `ad_placement` | 05, inchangé |

---

## P5. Écrans du totem

Famille propre, distincte des trois familles de l'application de conception. Contraintes de la partie F13 : texte de 20 pixels au minimum, cibles tactiles de 44 pixels, zone d'interaction principale dans le tiers inférieur, aucun survol.

### P5.1 Écran d'attente

```
+-----------------------------------+
|                                   |
|      contenu en rotation          |
|      annonce, promotion,          |
|      evenement, ou plan           |
|                                   |
+-----------------------------------+
|  Touchez pour trouver votre chemin |
+-----------------------------------+
```

Le bandeau d'orientation est **fixe et permanent**, sur toute la durée de la boucle. Il n'est jamais recouvert, jamais réduit, jamais animé au point de perdre sa lisibilité.

Sans option commerciale souscrite, la boucle affiche le plan du niveau orienté selon l'azimut de la borne.

### P5.2 Accueil d'orientation

| Élément | Comportement |
| --- | --- |
| Plan orienté | Selon l'azimut de la borne, repère de position visible |
| Recherche | Champ avec clavier à l'écran, suggestions dès la première lettre |
| Catégories | Accès à l'annuaire par catégorie |
| Services | Sanitaires, sorties, accueil, distributeurs |
| Langue | Bascule français et anglais, toujours visible |
| Mode accessible | Toujours visible, un geste |
| Informations pratiques | Horaires du site |
| Options | Fidélité, promotions, si souscrites |

### P5.3 Recherche

Tolérante aux accents, à la casse et aux fautes de frappe simples. Recherche dans les noms d'enseignes, les catégories et les mots-clés, dans les deux langues. Une recherche sans résultat est journalisée en télémétrie, sans donnée personnelle, et propose l'annuaire par catégorie plutôt qu'un écran vide.

### P5.4 Fiche destination

Nom, catégorie, niveau, horaires, bouton d'itinéraire en évidence. Si l'option promotions est souscrite et qu'une promotion active concerne cette destination, elle apparaît **sous** le bouton d'itinéraire, jamais au-dessus, jamais à sa place.

### P5.5 Itinéraire

- Tracé animé sur le plan orienté, avec mise en évidence des points de décision.
- Étapes écrites, courtes, dans la langue active.
- Changement de niveau signalé explicitement, avec le moyen : ascenseur, escalier, escalier mécanique.
- Profil accessible disponible : l'itinéraire n'emprunte alors que des arêtes accessibles.
- Code à scanner pour emporter l'itinéraire sur son téléphone.
- Équivalent statique de l'animation en mode accessible et à animation réduite.

### P5.6 Mode accessible

Texte agrandi, contraste renforcé, sortie audio avec prise casque, interaction rapprochée du bas de l'écran pour un usage assis, temporisation d'inactivité allongée, vue en plan simplifié à la place de l'isométrie.

### P5.7 Retour à l'attente

Après une durée d'inactivité déclarée, retour à l'écran d'attente, effacement complet de la session, aucune trace de la recherche précédente.

---

## P6. Option publicité

### P6.1 Circuit

1. La régie vend un emplacement de diffusion sur une ou plusieurs bornes, pour une période.
2. Le visuel est reçu, assaini et contrôlé par la régie, selon la partie N5.
3. La régie transmet au module 13 une liste de diffusion validée, par commande.
4. Le module 13 compile la liste dans le paquet de la borne, qui la diffuse hors ligne.
5. La borne compte les diffusions. Le module 13 remonte les comptages au retour du réseau.
6. La régie lit les comptages et facture.

### P6.2 Règles de diffusion

- Diffusion uniquement pendant la boucle d'attente. Jamais pendant une session de visiteur. Application de M13.V2.
- Durée par visuel déclarée, part maximale de la boucle réservée à la publicité déclarée par le site.
- Formats déclarés par le profil de conformité matérielle de la borne. Un visuel hors format est refusé à la réception, jamais redimensionné silencieusement.
- Contrôle de clignotement à la réception, application de M13.V6.
- Aucun son, application de M13.V7.

### P6.3 Preuve de diffusion

Le comptage porte sur la borne, le visuel, la période et le nombre d'affichages complets. Il ne porte aucune donnée de visiteur. Un affichage interrompu par un visiteur n'est pas compté comme complet.

La preuve de diffusion est ce qui rend la publicité facturable. Elle doit être exacte, ni gonflée ni sous-estimée : un test compare le comptage à un nombre de diffusions connu.

---

## P7. Option fidélité

### P7.1 Principe

**L'inscription se fait sur le téléphone du visiteur, jamais sur le totem.**

Trois raisons, qui ont décidé ce choix : aucune donnée personnelle ne s'affiche sur un écran public, aucune donnée personnelle n'est stockée sur une borne qui fonctionne hors ligne, et l'inscription ne dépend pas du réseau de la borne puisqu'elle utilise celui du téléphone.

### P7.2 Parcours

1. Le totem affiche un code à scanner et les avantages du programme.
2. Le code ouvre un formulaire sur le téléphone, sous le domaine et l'identité du site.
3. Le visiteur saisit ses données sur son propre téléphone.
4. Le consentement est recueilli, explicite et détaillé.
5. L'inscription est transmise au système de fidélité du site, ou conservée selon P7.5.

Le code à scanner ne contient aucune donnée personnelle. Il porte l'identifiant de la borne, pour attribuer l'inscription à son lieu d'origine, et rien d'autre. Il peut donc rester fixe et fonctionner hors ligne.

### P7.3 Données collectées

Minimales par défaut : prénom, un moyen de contact, téléphone ou courriel, et le consentement. Tout champ supplémentaire est ajouté par le site, déclaré, et justifié.

Un site ne peut pas rendre obligatoire un champ qui n'est pas nécessaire au programme.

### P7.4 Consentement

- Explicite, jamais présupposé, jamais par case précochée.
- Détaillé par usage : adhésion au programme, et séparément, réception d'offres par message ou par courriel.
- Conservé avec sa date, l'identifiant de la borne d'origine et la version exacte du texte présenté.
- Retirable à tout moment, aussi simplement qu'il a été donné.

### P7.5 Frontière : Azimut n'est pas le fichier clients du site

Même principe que pour la comptabilité.

**Si le site dispose d'un système de fidélité**, l'inscription lui est transmise par un connecteur, et Azimut n'en conserve que la trace nécessaire à l'attribution : borne d'origine, date, sans donnée personnelle au-delà du délai de transmission.

**S'il n'en dispose pas**, Azimut conserve le strict minimum de P7.3, exportable à tout moment, et le site reste propriétaire de ces données. Atlas Studio agit comme sous-traitant, ce qui figure au contrat.

### P7.6 Droits des personnes

Accès, rectification, suppression et retrait du consentement, exerçables par le visiteur sans passer par la borne. Une suppression est effective et vérifiable.

### P7.7 Saisie directe sur le totem

Exclue. Le choix du code à scanner a été retenu précisément pour qu'aucune donnée personnelle ne soit tapée sur un écran public. Une demande ultérieure de saisie sur le totem relève de la procédure d'arrêt et de demande.

---

## P8. Option promotions et événements

### P8.1 Contenu

Une campagne est une promotion d'enseigne ou un événement du site. Elle porte un titre et un texte dans chaque langue active, un visuel, une période, une destination liée facultative, et un ciblage.

### P8.2 Ciblage

Par borne, par zone d'orientation, par niveau, ou sur l'ensemble du site. Par plage horaire, dans le fuseau du site.

### P8.3 Circuit de validation

Création par l'équipe marketing du site, validation par un second utilisateur avant publication. Aucune campagne ne se publie sans validation.

Contrôles automatiques à la création : format, clignotement, période cohérente, destination liée existante et atteignable.

### P8.4 Affichage

Dans la boucle d'attente, et dans la fiche d'une destination liée, sous le bouton d'itinéraire. Jamais ailleurs, application de M13.V2 et M13.V3.

À la date de fin, retrait automatique de toutes les bornes à la synchronisation suivante.

---

## P9. Écrans de gestion, côté site

Famille registre, dans l'application de conception.

| Écran | Rôle concerné | Contenu |
| --- | --- | --- |
| Parc de bornes | Exploitant | Configuration, azimut, langue, supervision de la partie O |
| Campagnes | Marketing | Création, validation, planification, ciblage |
| Planning de diffusion | Marketing, régie | Ce qui passe sur quelle borne et quand |
| Inscriptions fidélité | Marketing | Liste, consentements, export, transmission au système du site |
| Mode urgence | Exploitant, sécurité | Déclenchement et levée |

Le rôle `marketing`, présent dans l'énumération de la section A5.1, est limité aux campagnes et aux inscriptions de son site.

---

## P10. Mode urgence

### P10.1 Comportement

Sur déclenchement, et sur toutes les bornes du site ou d'une zone :

- Tout contenu commercial s'arrête immédiatement.
- La boucle d'attente est remplacée par un écran d'évacuation : plan orienté, repère de position, sorties et cheminements d'évacuation.
- Le calcul d'itinéraire n'emprunte que les cheminements d'évacuation et exclut les ascenseurs.
- Le mode reste actif jusqu'à sa levée explicite.

### P10.2 Déclenchement

Par un utilisateur habilité, depuis l'écran de gestion, avec confirmation. Levée par le même circuit. Tout déclenchement et toute levée sont journalisés.

### P10.3 Contrainte du hors ligne

Une borne hors ligne ne reçoit pas un déclenchement à distance. C'est une limite réelle, à ne pas masquer.

**Conséquence.** Le mode urgence d'Azimut complète le système de sécurité incendie du site, il ne le remplace jamais. Le contrat et la documentation le disent explicitement. Un moyen de déclenchement local, bouton ou commande de service sur la borne, est prévu pour couvrir ce cas.

---

## P11. Hors ligne et synchronisation

Le socle d'orientation fonctionne intégralement hors ligne, selon la partie D.

Les contenus commerciaux suivent le même mécanisme : ils sont compilés dans le paquet et diffusés localement. Une borne hors ligne continue de diffuser la dernière liste reçue.

Règle de péremption : **une borne hors ligne ne diffuse jamais un contenu dont la période est échue**, même si elle n'a pas pu recevoir son retrait. La date de fin est embarquée avec le contenu et vérifiée localement.

Les comptages de diffusion et la télémétrie s'accumulent localement et remontent au retour du réseau, sans perte.

---

## P12. Ajouts au modèle de données

```sql
visitor_playlist         (id, org_id, kiosk_id, version int, compiled_at,
                          content_hash, source_module)
visitor_playlist_item    (id, org_id, playlist_id, kind, ref_id, ordinal int,
                          duration_s int, valid_from, valid_to)
                         kind in ('ad','campaign','orientation')

visitor_display_count    (id, org_id, kiosk_id, item_ref, period_start,
                          period_end, complete_count int, synced_at)

visitor_campaign         (id, org_id, site_id, kind, title jsonb, body jsonb,
                          visual_asset_id, destination_id, valid_from, valid_to,
                          state, created_by, validated_by)
                         kind in ('promotion','event')
                         state in ('draft','in_review','published','expired','withdrawn')
visitor_campaign_target  (id, org_id, campaign_id, scope, ref_id, hours jsonb)
                         scope in ('site','zone','level','kiosk')

visitor_loyalty_signup   (id, org_id, site_id, kiosk_id, submitted_at,
                          first_name, contact, forwarded_at, external_ref)
visitor_consent          (id, org_id, signup_id, purpose, granted boolean,
                          text_version, granted_at, withdrawn_at)

visitor_emergency_state  (id, org_id, site_id, scope, ref_id, raised_at,
                          raised_by, lifted_at, lifted_by)
                         scope in ('site','zone')
```

`visitor_loyalty_signup` est la seule table du module qui contient une donnée personnelle. Elle est cloisonnée par organisation, chiffrée, et ses lignes sont purgées après transmission lorsque le site dispose d'un système de fidélité.

---

## P13. Ajouts au catalogue des codes d'anomalie

| Code | Gravité | Sens |
| --- | --- | --- |
| `VISITOR.COMMERCIAL_BLOCKS_ORIENTATION` | bloquant | Contenu commercial masquant l'orientation ou la sécurité |
| `VISITOR.FLASH_HAZARD` | bloquant | Visuel dépassant trois éclairs par seconde |
| `VISITOR.AUDIO_IN_COMMERCIAL` | bloquant | Contenu commercial comportant du son |
| `VISITOR.FORMAT_MISMATCH` | bloquant | Visuel hors format du profil matériel |
| `VISITOR.CAMPAIGN_NOT_VALIDATED` | bloquant | Publication sans validation par un second utilisateur |
| `VISITOR.EXPIRED_CONTENT` | bloquant | Contenu dont la période est échue |
| `VISITOR.PII_ON_KIOSK` | bloquant | Donnée personnelle détectée sur la borne |
| `VISITOR.CONSENT_MISSING` | bloquant | Inscription sans consentement enregistré |
| `VISITOR.EMERGENCY_ACTIVE` | information | Mode urgence en cours |

---

## P14. Critères d'acceptation

1. Pour chaque combinaison d'options, un test vérifie que la recherche est accessible en un geste et qu'aucun contenu commercial ne s'intercale entre une demande et sa réponse.
2. Un contact pendant la boucle d'attente ouvre l'accueil d'orientation immédiatement, sans attendre la fin du contenu.
3. Un visuel produisant plus de trois éclairs par seconde est refusé à la réception.
4. Aucune donnée personnelle n'est présente sur la borne, vérifié par analyse du paquet et du stockage local.
5. Le code à scanner d'inscription ne contient que l'identifiant de la borne.
6. Une inscription sans consentement explicite ne peut pas être enregistrée.
7. Un retrait de consentement est effectif, et une suppression est vérifiable.
8. Une borne hors ligne ne diffuse aucun contenu dont la période est échue.
9. Le comptage de diffusion correspond exactement à un nombre de diffusions connu.
10. Le mode urgence arrête tout contenu commercial sur toutes les bornes connectées, et le déclenchement local fonctionne sur une borne hors ligne.
11. L'identité affichée est celle du site, jamais celle d'Azimut, sur le totem comme sur le téléphone.
12. Aucune option non souscrite n'apparaît, même grisée.

---

## P15. Rattachement

| Élément | Incrément | Taille |
| --- | --- | --- |
| Correction de propriété des tables de borne | 0, immédiat | S |
| Socle d'orientation, écrans P5 | 3 | L |
| Passage au téléphone, itinéraire emporté | 3 | M |
| Mode urgence | 3 | M |
| Option promotions et événements | 4 | M |
| Option publicité, diffusion et comptage | 5, avec la régie | L |
| Option fidélité | 5 | M |

La correction de propriété est à faire tout de suite : c'est un défaut d'architecture existant, pas une fonction nouvelle.

---

## P16. Ajouts au registre des points ouverts

| Sujet | Responsable | Déclencheur | Niveau |
| --- | --- | --- | --- |
| Loi de protection des données applicable par pays, et déclaration auprès de l'autorité de contrôle | Conseil juridique | Avant la première inscription réelle | L |
| Âge minimal d'inscription au programme de fidélité | Conseil juridique | Avant l'option fidélité | L |
| Clause de sous-traitance des données entre Atlas Studio et le site | Conseil juridique | Avant le premier contrat avec l'option | V |
| Articulation du mode urgence avec le système de sécurité incendie | Bureau de contrôle du site | Avant tout déploiement | L |

---

## P17. Ce que cette partie ne couvre pas

Historique. Cette liste ne fait plus foi. Les points encore ouverts sont repris dans le registre de la partie K, section K3, seule liste à tenir.

1. **Le matériel de borne.** Toujours non arrêté. Le produit s'appuie sur le profil de conformité matérielle, et les formats de visuels en dépendent.
2. **Les connecteurs vers les systèmes de fidélité existants.** Le principe est posé, chaque connecteur dépend du système du site et sera spécifié à la demande.
3. **La mesure d'audience au-delà du comptage de diffusion.** Estimer combien de personnes ont vu une annonce demanderait une détection de présence devant la borne, donc une captation dans un lieu public. Exclu en l'état, et à ne pas promettre aux annonceurs.
4. **Les essais sur usagers de l'application visiteur.** C'est la surface la plus exposée du produit, utilisée par des personnes qui ne l'ont jamais vue et ne la reverront peut-être jamais. Elle mérite ses propres sessions d'essai, avec des visiteurs réels et non des opérateurs.

---

# PARTIE Q. Compléments de la consolidation

Cette partie porte ce que la vérification croisée de l'ensemble a révélé : une plateforme sans module, trente-deux tables sans propriétaire, et quatre oublis de fond.

---

## Q1. Plateforme

### Q1.1 Rôle

La plateforme porte le compte client lui-même : organisation, entités juridiques, membres, abonnement, droits, paquets de règles, référentiels de devises et de taxes, journal d'audit, travaux, assistance, cycle de vie du contrat.

Elle est numérotée 00. **Ce n'est pas un module commercial** : elle ne se souscrit pas, ne se désactive pas, et n'entre pas dans le modèle de droits. Le produit compte treize modules, numérotés 01 à 13, posés sur la plateforme.

### Q1.2 Place dans l'architecture

Elle se situe sous le socle. Elle ne lit aucun module. Tous les modules la lisent.

C'est la seule entité de l'architecture lue par tous et ne lisant rien. Une fonctionnalité de plateforme qui aurait besoin de lire un module métier révélerait une attribution fausse, et relève de la procédure d'arrêt et de demande.

### Q1.3 Règles

**M00.PL1.** Une organisation contient une ou plusieurs entités juridiques. Un site est rattaché à une seule entité juridique, au plus tard avant sa première facture. Voir Q5.

**M00.PL2.** Les référentiels globaux, paquets de règles, devises et taux de taxe, ne sont rattachés à aucune organisation et sont en lecture seule pour l'application. Ils sont alimentés par fichier et migration, jamais par l'interface.

**M00.PL3.** Le journal d'audit est en insertion seule, garanti au niveau de la base.

**M00.PL4.** Un membre désactivé n'est jamais supprimé. Ses approbations et son journal restent attribués.

**M00.PL5.** La plateforme ne porte aucune donnée métier de site.

---

## Q2. Rattachement de toutes les tables

La règle de propriété unique interdit de créer une table sans propriétaire. Les trente-deux premières tables ci-dessous n'en avaient pas, les cinq dernières sont créées par cette partie. Ce tableau fait foi et complète les fiches de la partie L.

| Table | Propriétaire | Motif |
| --- | --- | --- |
| `organization` | 00 Plateforme | Compte client |
| `membership` | 00 Plateforme | Membres et rôles |
| `user_invitation` | 00 Plateforme | Cycle de vie des comptes |
| `guest_access` | 00 Plateforme | Accès du relecteur externe |
| `module_entitlement` | 00 Plateforme | Droits par module |
| `subscription`, `subscription_line`, `subscription_invoice` | 00 Plateforme | Abonnement à Azimut |
| `termination` | 00 Plateforme | Fin de contrat |
| `demo_seed` | 00 Plateforme | Démonstration |
| `support_request` | 00 Plateforme | Assistance |
| `rules_pack`, `rules_pack_rule` | 00 Plateforme | Référentiel global |
| `site_rules_binding` | 01 Socle | Rattachement d'un site à un paquet |
| `site_fact` | 01 Socle | Faits déclarés du site, avec source et statut, section A5.11 |
| `plan_calibration_point` | 01 Socle | Points de calage d'une source de plan, en pixels de l'image, règle M01.S2 |
| `parking_space` | 01 Socle | Extension d'une empreinte de place, section A5.3 |
| `view_layer`, `work_color`, `dimension_note` | 01 Socle | Calques, coloration de travail, cotations, partie S |
| `assistant_setting`, `assistant_suggestion` | 14 Assistant | Assistant de conception, section S7 |
| `audit_log` | 00 Plateforme | Journal d'audit |
| `job` | 00 Plateforme | File de travaux |
| `charter`, `charter_version`, `charter_color`, `charter_typeface`, `charter_rule`, `lexicon_term` | 04 Signalétique | Voir Q3 |
| `color_output_profile` | 04 Signalétique | Profils de sortie par substrat |
| `counter_import` | 03 Parcours clients | Données de comptage |
| `site_state` | 01 Socle | Versionnement de la géométrie |
| `temporary_closure` | 01 Socle | Porte sur les arêtes |
| `provisional_support` | 02 Wayfinding | Implantation provisoire |
| `vendor_consultation`, `vendor_offer`, `vendor_offer_line` | 07 Chantier et pose | Consultation des fabricants |
| `delivery_package` | 07 Chantier et pose | Dossier de livraison |
| `visitor_campaign_target` | 13 Application visiteur | Ciblage des campagnes |
| `legal_entity` | 00 Plateforme | Entité juridique émettrice, voir Q5 |
| `currency` | 00 Plateforme | Référentiel global des devises, voir Q4 |
| `country` | 00 Plateforme | Référentiel global des pays et de leurs fuseaux, voir Q9 |
| `tax_rate` | 00 Plateforme | Référentiel global des taux, voir Q6 |
| `invoice_line` | Module émetteur : 05 pour la régie, 00 pour l'abonnement | Voir Q6 |
| `incident` | 00 Plateforme | Surveillance et incidents, voir Q7 |

Motif de deux attributions qui pourraient se discuter :

- **`temporary_closure` appartient au socle**, parce qu'elle modifie la disponibilité des arêtes, qui sont des données du socle. Le wayfinding en tire la signalétique provisoire, dont il est propriétaire.
- **`site_rules_binding` appartient au socle**, parce que c'est un attribut du site. Le paquet de règles lui-même reste à la plateforme.

---

## Q3. Charte

**Propriétaire : module 04, Signalétique.**

La charte d'un site est une donnée de production : elle ne sert qu'à composer les supports. Une charte de groupe est posée au niveau du portefeuille, module 10, et héritée par les sites, avec dérogation explicite et visible, conformément à la règle M10.F1 de la partie N.

Le module 13 lit la charte du site pour afficher l'identité du site sur les bornes et sur le téléphone. C'est une lecture intra-couche, déclarée ici, sans cycle : le module 04 ne lit pas le module 13.

---

## Q4. Devises sans subdivision

### Q4.1 Le défaut

Le modèle stocke tous les montants « en unité mineure », suffixe `_minor`, en supposant implicitement une subdivision en centièmes.

Or les deux francs CFA, d'Afrique de l'Ouest et d'Afrique centrale, n'ont pas de subdivision en usage. Ce sont les monnaies des trois bases d'implantation d'Atlas Studio. Sans exposant déclaré par devise, un montant saisi en francs serait lu comme des centimes, et faux d'un facteur cent.

### Q4.2 Règle

Chaque devise porte son exposant, c'est-à-dire le nombre de décimales de son unité mineure. Les montants restent stockés en entiers dans l'unité mineure, et la conversion vers l'affichage utilise l'exposant de la devise, jamais une valeur supposée.

```sql
currency     (code, exponent int, name, source_ref)
```

Table globale, rattachée à la plateforme, en lecture seule, alimentée par fichier avec une référence documentaire, selon la règle M00.PL2.

### Q4.3 Contrôles

- Tout montant porte sa devise. Un montant sans devise est refusé.
- Aucune addition de montants de devises différentes. Un total multi-devises s'affiche par devise, jamais converti implicitement.
- Test obligatoire : un montant saisi dans une devise à exposant nul est restitué à l'identique, sans multiplication ni division par cent.

---

## Q5. Entité juridique émettrice

### Q5.1 Le défaut

Une facture est émise par une entité juridique, pas par une organisation. Une société de gestion peut exploiter plusieurs sites détenus par des sociétés différentes, et chaque facture de régie doit porter l'identité de l'entité qui détient ou exploite le site. Le modèle ne connaissait que l'organisation.

### Q5.2 Règle

```sql
legal_entity  (id, org_id, legal_name, registration_ref, tax_ref,
               address jsonb, country_code, currency_code)
site          (..., legal_entity_id)
```

- Un site est rattaché à une seule entité juridique. Elle est facultative à la création du site et requise avant l'émission de sa première facture : `DATA.LEGAL_ENTITY_REQUIRED` bloque l'émission tant qu'elle manque. Elle ne sert qu'à facturer, et n'est donc pas un préalable au travail de conception.
- Toute facture de régie, module 05, porte l'entité juridique du site, figée au moment de l'émission. Un changement ultérieur d'entité ne modifie jamais une facture émise.
- Les factures d'abonnement, `subscription_invoice`, sont émises par Atlas Studio, jamais par l'entité du client.

`legal_entity` appartient à la plateforme.

---

## Q6. Taxes sur les factures

### Q6.1 Le défaut

Les factures de régie et d'abonnement ne calculaient aucune taxe. Une facture sans taxe n'est pas une facture valide.

### Q6.2 Règle

Même logique que les paquets de règles : **aucun taux dans le code.**

```sql
tax_rate      (id, country_code, kind, rate_pct numeric, effective_from,
               effective_to, source_ref)
              kind in ('standard','reduced','exempt')
invoice_line  (id, org_id, invoice_kind, invoice_id, label, quantity numeric,
               unit_amount_minor bigint, tax_rate_id, tax_amount_minor bigint,
               currency_code)
```

- Les taux sont une donnée par pays, datée, avec référence documentaire, sans valeur de repli. Un taux absent bloque l'émission de la facture au lieu de produire une facture sans taxe.
- Le taux appliqué est figé sur la ligne à l'émission. Un changement de taux ultérieur ne modifie jamais une facture émise.
- L'arrondi de taxe suit l'exposant de la devise de Q4.

`tax_rate` appartient à la plateforme. `invoice_line` appartient au module émetteur : 05 pour la régie, 00 pour l'abonnement.

### Q6.3 Frontière rappelée

Azimut calcule et émet. Il ne déclare pas la taxe, ne tient pas le livre comptable et n'effectue aucun rapprochement. Les taux eux-mêmes relèvent du registre des points ouverts, section K3.8.

---

## Q7. Surveillance de production et réponse aux incidents

### Q7.1 Le défaut

Le plan promet une disponibilité de 99,5 %, et depuis la partie P le produit détient des données personnelles. Aucun document ne spécifiait ni la surveillance de la production, ni l'astreinte, ni la procédure en cas d'incident ou de violation de données.

### Q7.2 Surveillance

- Mesure continue de la disponibilité de la plateforme, du service de compilation et de la file de travaux.
- Alerte sur : indisponibilité, travaux en échec répété, file de travaux bloquée, erreur de cloisonnement, taux d'erreur anormal.
- Une alerte a un destinataire nommé et un délai de prise en charge. Une alerte sans destinataire n'existe pas.
- La supervision du parc de bornes, spécifiée en partie O, s'y raccorde.

### Q7.3 Réponse à incident

- Chaque incident est ouvert, qualifié, traité, clos, et tracé.
- Une revue écrite suit tout incident ayant affecté un client, avec cause et mesure corrective.

### Q7.4 Violation de données

Procédure écrite, testée au moins une fois par an :

1. Confinement et qualification : quelles données, quelles personnes, quelle organisation.
2. Information de l'organisation cliente, responsable du traitement pour les données de fidélité.
3. Notification à l'autorité de contrôle et aux personnes concernées, dans les délais et selon les formes de la loi applicable.
4. Revue et mesures correctives.

Les délais et les formes de notification dépendent de la loi de chaque pays et relèvent du registre des points ouverts.

### Q7.5 Données du modèle

```sql
incident      (id, org_id, kind, severity, opened_at, qualified_at,
               closed_at, summary, root_cause, corrective_action)
              severity in ('critical','major','minor')
               kind in ('availability','security','data_breach','integrity')
```

`org_id` est nul pour un incident de plateforme sans client identifié. `incident` appartient à la plateforme.

---

## Q8. Codes d'anomalie ajoutés

| Code | Gravité | Sens |
| --- | --- | --- |
| `DATA.LEGAL_ENTITY_REQUIRED` | bloquant | Émission d'une facture pour un site sans entité juridique |
| `DATA.CURRENCY_REQUIRED` | bloquant | Montant sans devise |
| `DATA.CURRENCY_MIXED` | bloquant | Addition de montants de devises différentes |
| `DATA.TAX_RATE_MISSING` | bloquant | Aucun taux applicable pour ce pays et cette date |
| `SECURITY.INCIDENT_OPEN` | information | Incident ouvert affectant l'organisation |

---

## Q9. Référentiel des pays

### Q9.1 Le défaut

Le formulaire de création d'un site demande un pays et un fuseau horaire, et la section M1 prévoit que le fuseau soit pré-rempli d'après le pays quand celui-ci n'en compte qu'un. Aucune donnée ne portait cette information : elle serait alors écrite dans le code, où elle vieillirait sans que personne s'en aperçoive, et la correspondance entre un pays et ses fuseaux serait rédigée à la main.

### Q9.2 Règle

```sql
country      (code, name_fr, name_en, timezones jsonb,
              default_currency_code, source_ref)
```

Table globale, rattachée à la plateforme, en lecture seule pour l'application, alimentée par fichier avec une référence documentaire, selon la règle M00.PL2, exactement comme la table des devises.

- `code` : code de pays sur deux lettres, celui qu'emploie `site.country_code`.
- `timezones` : la liste des fuseaux du pays, dans l'ordre. Le pré-remplissage de la section M1 s'applique quand cette liste n'en compte qu'un.
- `default_currency_code` : devise proposée par défaut pour une entité juridique de ce pays, section Q4.

**Cette colonne reste vide jusqu'à l'incrément qui facture.** Aucune source de la machine ne donne la correspondance d'un pays vers sa devise, et la table des devises de la section Q4 n'existe pas encore. La colonne attend son fichier, comme les paquets de règles attendent le leur : une colonne vide n'est donc pas un oubli, et rien de ce qui précède l'incrément qui facture ne la lit.

Aucune liste de pays, aucun fuseau et aucune correspondance entre les deux n'est écrite dans le code.

---

## Q10. Ce que cette partie ne résout pas

Les points suivants sont inscrits au registre, section K3.8 :

1. Les taux de taxe réels par pays et par nature de prestation.
2. Les délais et formes de notification d'une violation de données par pays.
3. La désignation des destinataires d'alerte et de l'astreinte, qui relève de l'organisation d'Atlas Studio et non du logiciel.

---

# PARTIE R. Écran du tableau des messages

## R0. Statut

Cette partie est un livrable d'Atlas Studio. Elle lève le point ouvert de la section K3.8 du cahier des charges consolidé, « spécification au champ près de l'écran du tableau des messages ».

Elle suit la forme des écrans de la partie M et respecte les onze règles de la section M7.

**Elle est opposable.** Sa rédaction a révélé quatre points du cahier des charges qui demandaient un arbitrage. Atlas Studio les a tranchés. Les décisions sont consignées à la section R19 et reportées dans les sections qu'elles modifient.

---

## R1. Objet et utilisateurs

Le tableau des messages dit, pour chaque face de chaque support, ce qui y sera écrit, dans quelle langue, avec quel pictogramme, dans quelle direction, et quel point de décision le justifie. C'est le livrable central du wayfinding. C'est lui que la maîtrise d'ouvrage valide, avant tout dessin. Règle M02.W7.

L'écran sert trois usages, et doit servir les trois sans compromis :

| Usage | Qui | Ce qu'il cherche |
| --- | --- | --- |
| Produire | Concepteur | Générer, vérifier, repérer les anomalies, remonter à la source d'une erreur |
| Valider | Maîtrise d'ouvrage, relecteur externe | Lire vite, comprendre pourquoi chaque ligne existe, annoter, approuver |
| Contrôler | Auditeur | Retrouver ce qui a été approuvé, quand, par qui, et ce qui a changé |

Section F5bis.3 : c'est l'écran que la maîtrise d'ouvrage regardera le plus longtemps. Sa densité et sa lisibilité priment sur son élégance.

---

## R2. Chemin, famille, droits

**Chemin.** `/sites/:siteId/wayfinding/messages`
**Famille.** Registre, section F5bis.1.

| Rôle | Consulter | Générer | Émettre pour revue | Annoter | Approuver ou rejeter | Exporter |
| --- | --- | --- | --- | --- | --- | --- |
| `admin` | oui | oui | oui | oui | non | oui |
| `designer` | oui | oui | oui | oui | non | oui |
| `owner_rep` | oui | non | non | oui | oui | oui |
| Relecteur externe, accès invité | oui | non | non | oui | oui | oui |
| `auditor` | oui | non | non | non | non | oui |
| `operator`, `vendor`, `marketing` | non | non | non | non | non | non |

Le relecteur externe est défini en section O7. Son accès est limité au site, à la période et au périmètre accordés.

Séparation voulue : **celui qui génère ne peut pas approuver.** Un `admin` ou un `designer` qui approuverait son propre tableau ferait disparaître le contrôle que la maîtrise d'ouvrage est censée exercer.

---

## R3. Structure

```
+------------------------------------------------------------------------+
| Azimut | Site | Tableau des messages                                    |
+------------------------------------------------------------------------+
| Version 7  |  En revue  |  Généré le ...  | [Comparer] [Exporter] [...] |
+------------------------------------------------------------------------+
| Filtres : support, zone, niveau, bâtiment, direction, niveau d'info,   |
|           périmées seules, anomalies seules          | Recherche        |
+-------------------------------------------------+----------------------+
| Id stable | Support | F | B | FR | EN | Picto |   | Détail de la ligne   |
| Dir | Niv | Point de décision | État            |   |                      |
| ...                                              |   | Justification        |
| ...                                              |   | Continuité           |
| ...                                              |   | Sources              |
|                                                  |   | Annotations          |
+-------------------------------------------------+----------------------+
| 412 lignes | 9 périmées | 2 bloquantes | 3 écartées | Synchronisé      |
+------------------------------------------------------------------------+
```

Le tableau occupe toute la largeur disponible hors panneau de détail. Le panneau de détail est repliable et sa largeur mémorisée par utilisateur.

---

## R4. Barre de version

| Élément | Source | Format |
| --- | --- | --- |
| Numéro de version | `message_schedule.version` | entier |
| État | `message_schedule.state` | `draft` Brouillon, `in_review` En revue, `approved` Approuvé, `superseded` Remplacé |
| Date de génération | `message_schedule.generated_at` | date et heure, fuseau du site |
| Empreinte des entrées | `message_schedule.inputs_hash` | huit premiers caractères, chasse fixe, valeur complète en infobulle |

Actions, affichées selon l'état et le rôle, conformément à la section R12 :

| Action | Visible si |
| --- | --- |
| Générer | État `draft`, ou aucune version |
| Émettre pour revue | État `draft`, aucune anomalie bloquante |
| Approuver | État `in_review`, rôle d'approbation, aucune annotation ouverte |
| Rejeter | État `in_review`, rôle d'approbation |
| Comparer | Au moins deux versions |
| Exporter | Toujours, pour les rôles qui le permettent |

Une action non permise est absente, jamais grisée, conformément à la section F5bis.2.

---

## R5. Colonnes

Colonnes de la section F5bis.3, dans cet ordre, précédées de l'identifiant stable.

| Colonne | Source | Format | Tri |
| --- | --- | --- | --- |
| Identifiant stable | Code du support, face, bloc | `D-042/F1/B3`, chasse fixe, formé à partir de `support.code`, section A5.6 | oui, défaut |
| Support | Code et typologie du support | texte | oui |
| Face | `message_line.face_index` | entier | oui |
| Bloc | `message_line.block_index` | entier | oui |
| Contenu français | `message_line.content`, langue `fr` | texte, retour à la ligne permis | oui |
| Contenu anglais | `message_line.content`, langue `en` | texte, retour à la ligne permis | oui |
| Pictogramme | `message_line.pictogram_id` | vignette de 16 pixels et libellé | non |
| Direction | `message_line.direction` | symbole de direction et libellé | oui |
| Niveau d'information | `message_line.information_level` | libellé : Identification, Orientation, Direction, Confirmation | oui |
| Point de décision | `message_line.decision_point_id` | code du nœud, lien vers la zone de travail | oui |
| État | `message_line.stale` et anomalies de la ligne | pastille, voir section R10 | oui |

Règles de présentation :

- Seules les langues actives du site ont une colonne. Section N1.2.
- Une langue active sans contenu pour une ligne affiche une cellule vide marquée, jamais une cellule vide muette, et lève `LAYOUT.LANG_VARIANT_MISSING`.
- La direction est signalée par un **symbole et un libellé**, jamais par le seul symbole. Le symbole de direction est un contenu, distinct des icônes d'interface, et suit le registre des pictogrammes d'orientation.
- Le contenu n'est jamais tronqué sans indication. Une cellule trop longue passe à la ligne ; la hauteur de ligne s'adapte.
- **Aucune cellule du tableau n'est éditable.** Règle M02.W6. Voir section R8.

---

## R6. Regroupement, filtres, recherche

### R6.1 Regroupement

Par défaut, les lignes sont groupées par support, puis ordonnées par face et par bloc. Un en-tête de groupe rappelle le code du support, sa typologie, son nœud d'implantation et son nombre de lignes.

Autres regroupements disponibles : par zone d'orientation, par niveau, par point de décision. Le regroupement par point de décision est celui qui sert à vérifier la continuité, règle M02.W5.

### R6.2 Filtres

| Filtre | Valeurs |
| --- | --- |
| Support | Sélection multiple |
| Zone d'orientation | Sélection multiple. Appartenance calculée selon la règle M02.W12 |
| Niveau | Sélection multiple |
| Bâtiment | Sélection multiple. Le bâtiment d'un support se déduit de son nœud, par le niveau |
| Direction | Sélection multiple |
| Niveau d'information | 1 à 4 |
| Périmées seules | Interrupteur |
| Anomalies seules | Interrupteur |
| Écartées | Interrupteur, voir section R9 |

Les filtres actifs sont visibles en permanence sous forme de pastilles retirables. Un filtre actif qui masque des lignes affiche leur nombre : « 38 lignes masquées par les filtres ». Un filtre oublié ne doit jamais faire croire qu'une ligne n'existe pas.

### R6.3 Recherche

Dans les contenus des deux langues, les codes de support, les codes de point de décision. Tolérante aux accents et à la casse.

---

## R7. Panneau de détail

Il répond à la seule question que la maîtrise d'ouvrage se pose devant une ligne : **pourquoi cette ligne existe-t-elle ?**

### R7.1 Justification

Le point de décision, le ou les profils de parcours qui y passent, et la destination annoncée. Règle M02.W4 : une ligne sans point de décision ne peut pas exister, l'écran n'a donc jamais à afficher une justification vide.

### R7.2 Continuité

Pour la destination annoncée, la séquence du plan de jalonnement : le point précédent qui l'annonçait, le point suivant qui la reprend ou la confirme, jusqu'à la destination. Règle M02.W5.

Une rupture de continuité s'affiche à l'endroit exact où elle se produit, avec `WAYFIND.CONTINUITY_BROKEN`.

### R7.3 Sources

Les données dont la ligne est dérivée, chacune avec un lien vers l'écran où elle se corrige :

| Source | Écran de correction |
| --- | --- |
| Destination et dénominations | Annuaire, module 01 |
| Nom de zone ou de lieu | Zonage et nomenclature, module 02 |
| Implantation du support | Implantation des supports, module 02 |
| Point de décision et parcours | Plan de jalonnement, module 02 |
| Pictogramme | Bibliothèque, partie J |

C'est le seul moyen de corriger une ligne. Voir section R8.

### R7.4 Annotations

Les annotations de révision ancrées sur la ligne, section J4 : auteur, date, état, fil de réponses. Création d'une annotation depuis le panneau.

---

## R8. Actions en série

**L'action en série porte sur la revue, jamais sur le contenu.** La règle M02.W6 interdit toute saisie manuelle du tableau des messages, et la table `message_line` ne porte aucun champ modifiable. La section F5bis.3 le précise.

Sur une sélection multiple, sont permis :

- Annoter la sélection d'une même remarque, qui crée une annotation par ligne.
- Marquer comme relues, pour le relecteur, sans valeur d'approbation.
- Filtrer sur la sélection.
- Exporter la sélection.
- Ouvrir la source commune, si toutes les lignes sélectionnées dérivent d'une même source.

Ne sont jamais permis : modifier un contenu, une direction, un pictogramme, un niveau d'information ou un point de décision. Une ligne fausse se corrige à sa source, puis le tableau se régénère. C'est ce qui garantit qu'un panneau ne dit rien que le graphe et l'annuaire ne justifient.

---

## R9. Lignes écartées

La règle M02.W9 plafonne le nombre de destinations par face et impose que l'écartement soit tracé, jamais silencieux. Il est enregistré par deux champs de `message_line`, définis en section N2.2 :

| Champ | Type | Contrainte |
| --- | --- | --- |
| `excluded` | booléen | Vrai si la ligne a été écartée par l'arbitrage de M02.W9 |
| `exclusion_reason` | structure | Plafond appliqué, référence de la règle, `display_priority` de la destination écartée et de la dernière retenue |

Une ligne écartée n'est jamais composée sur une face. Elle reste dans le tableau pour que la maîtrise d'ouvrage voie ce qui n'a pas trouvé de place et puisse, si besoin, faire changer une priorité à la source.

À l'écran : masquées par défaut, visibles par le filtre « Écartées », comptées dans la barre d'état, affichées en `text-muted` avec le motif en panneau de détail.

---

## R10. Péremption et état des lignes

Une ligne est périmée quand une donnée dont elle dérive a changé depuis la génération. Règle M02.W8. `stale` est dérivé, jamais saisi.

| État de la ligne | Présentation |
| --- | --- |
| À jour | Aucun marquage |
| Périmée | Pastille `state-warning` et libellé « Périmée » |
| Anomalie bloquante | Pastille `state-blocking` et libellé du code |
| Écartée | Texte en `text-muted` et libellé « Écartée » |

Aucun état n'est porté par la seule couleur : chaque pastille a son libellé. Section F14.

Quand au moins une ligne est périmée, un bandeau permanent en haut du tableau l'indique avec `WAYFIND.SCHEDULE_STALE`, le nombre de lignes concernées et l'action « Générer une nouvelle version ». Un tableau périmé ne peut pas être approuvé en l'état.

---

## R11. Comparaison de versions

Choix de deux versions. Affichage en un seul tableau, chaque ligne marquée :

| Marque | Sens |
| --- | --- |
| Ajoutée | Absente de la version de référence |
| Supprimée | Absente de la version comparée |
| Modifiée | Même identifiant stable, contenu ou attribut différent. La valeur ancienne et la nouvelle sont visibles côte à côte |
| Inchangée | Masquée par défaut |

La comparaison repose sur l'identifiant stable. Sans lui, une ligne regénérée paraîtrait supprimée puis ajoutée, et la comparaison serait inutilisable. C'est la raison du code lisible des supports, `support.code`, section A5.6.

Les marques combinent symbole et libellé, jamais la couleur seule.

---

## R12. Circuit de validation

Règle M02.W7 : même circuit que les bons à tirer. Machine à états transposée de la section D9.1 :

| De | Vers | Déclencheur | Condition |
| --- | --- | --- | --- |
| aucune version | `draft` | Générer | Possible sans paquet de règles rattaché, avec le bandeau de la section R14 |
| `draft` | `draft` | Générer à nouveau | Nouvelle version, l'ancienne brouillon est remplacée |
| `draft` | `in_review` | Émettre pour revue | Aucune anomalie bloquante, et validation de complétude du graphe passée, règle M02.W11 |
| `in_review` | `draft` | Rejeter | Motif obligatoire, enregistré dans `message_schedule_approval.comment` |
| `in_review` | `approved` | Approuver | Aucune annotation ouverte, aucune ligne périmée |
| `approved` | `superseded` | Approbation d'une version ultérieure | Automatique |

Règles :

- L'émission pour revue fige le contenu. Une version en revue ne se régénère pas ; une correction passe par un rejet, puis une nouvelle génération.
- Une annotation ouverte bloque l'approbation, avec `REVIEW.ANNOTATION_OPEN`. Section J4.
- L'approbation écrit une ligne dans `message_schedule_approval`, en insertion seule, portant l'approbateur, la date et l'empreinte des entrées. Elle n'écrit jamais dans `approval`, qui appartient au module 04 et porte les bons à tirer.
- Une version approuvée n'est jamais modifiable.
- L'approbation demande une confirmation qui nomme la conséquence : « Approuver la version 7. La composition des supports se fera sur cette version. » Section M7, règle 9.

---

## R13. Export

Deux formats : tableur et document.

- Chaque ligne porte son identifiant stable.
- Le document d'export porte en tête : site, version, état, date de génération, empreinte des entrées, version du paquet de règles, et, si la version est approuvée, l'approbateur et la date.
- Deux exports d'une même version produisent des fichiers identiques. Critère 5 de N2.7.
- Un export ne porte aucune annotation de révision, aucune donnée d'esquisse, et aucune marque Azimut. Sections J4 et F18.4.
- Un export d'une version non approuvée porte en tête la mention « Version non approuvée ».

---

## R14. Contrôles et anomalies

Tous les codes figurent déjà au catalogue du cahier des charges consolidé. Cet écran n'en crée aucun.

| Situation | Code | Effet à l'écran |
| --- | --- | --- |
| Ligne sans point de décision | `WAYFIND.LINE_UNJUSTIFIED` | Ne peut pas exister, règle M02.W4. Si détectée, bloque l'émission |
| Continuité rompue | `WAYFIND.CONTINUITY_BROKEN` | Bloque l'émission, affichée en continuité, section R7.2 |
| Support sans niveau d'information | `WAYFIND.NO_INFORMATION_LEVEL` | Bloque l'émission |
| Collision de nommage | `WAYFIND.NAMING_COLLISION` | Bloque l'émission |
| Trop de destinations sur une face | `WAYFIND.TOO_MANY_DESTINATIONS` | Déclenche l'écartement, section R9 |
| Tableau périmé | `WAYFIND.SCHEDULE_STALE` | Bandeau, bloque l'approbation |
| Variante de langue absente | `LAYOUT.LANG_VARIANT_MISSING` | Cellule marquée, avertissement |
| Annotation ouverte | `REVIEW.ANNOTATION_OPEN` | Bloque l'approbation |
| Graphe non validé | `GRAPH.NOT_VALIDATED` | Bandeau. Bloque l'émission, règle M02.W11 |
| Aucun paquet de règles | `RULES.PACK_NOT_BOUND` | Bandeau. Le plafond de M02.W9 n'est pas appliqué et c'est dit, section N2.8. Bloque l'émission pour revue |

Chaque anomalie porte son entité, un lien vers elle, et sa référence normative le cas échéant. Section M7, règle 6.

---

## R15. Raccourcis

| Touche | Action |
| --- | --- |
| Flèches haut et bas | Ligne précédente, suivante |
| `Espace` | Ajouter la ligne à la sélection ou l'en retirer |
| `Maj` + flèches | Étendre la sélection |
| `Entrée` | Ouvrir le détail de la ligne |
| `Échap` | Fermer le détail, puis vider la sélection |
| `/` | Placer le focus dans la recherche |
| `A` | Annoter la ligne ou la sélection |
| `N` | Aller à la prochaine ligne périmée ou en anomalie |

Aucun raccourci ne modifie un contenu, conformément à la section R8. Les conflits avec les raccourcis du navigateur et du système sont vérifiés selon la section E16.

---

## R16. États de l'écran

Les six états de la section F7, plus trois états propres.

| État | Traitement |
| --- | --- |
| Vide, aucune version | Invitation à générer, avec les prérequis visibles : graphe validé, jalonnement établi, paquet de règles rattaché. Jamais un tableau vide présenté comme un résultat |
| Chargement | Structure d'attente calquée sur les lignes du tableau |
| Génération en cours | Progression, annulable, durée réelle affichée à la fin |
| Partiel | Lignes disponibles affichées, supports non encore traités nommés |
| Erreur | Cause et reprise. Une génération échouée ne remplace jamais la version précédente |
| Hors ligne | Bandeau. Consultation et annotation possibles, générer, émettre et approuver indisponibles et dits tels |
| Droit refusé | Écran absent pour les rôles sans consultation. Pour les autres, actions non permises absentes |
| Graphe non validé | Bandeau `GRAPH.NOT_VALIDATED` avec lien vers la validation de complétude, écran M5 |
| Version approuvée | Bandeau d'état indiquant l'approbateur et la date. Aucune action de génération sur cette version |

---

## R17. Accessibilité

- Tableau pilotable entièrement au clavier, section R15.
- Indicateur de focus sur la ligne, distinct de l'indicateur de sélection. Section F14.
- Aucun état porté par la seule couleur, section R10. Contrôle en niveaux de gris.
- Les en-têtes de colonnes et de groupes sont restitués par les technologies d'assistance.
- La direction et le pictogramme ont un libellé textuel.

---

## R18. Critères d'acceptation

1. Sur un site de référence, le tableau affiché est exactement le tableau généré attendu, ligne pour ligne. Critère 1 de N2.7.
2. Aucune cellule n'est modifiable, par aucune voie : clic, clavier, collage, action en série.
3. Une destination modifiée marque périmées exactement les lignes qui la citent, et le bandeau en donne le nombre exact.
4. Un filtre actif affiche le nombre de lignes qu'il masque.
5. Une rupture de continuité est affichée à l'endroit exact où elle se produit.
6. Chaque source du panneau de détail mène à l'écran où elle se corrige.
7. La comparaison de deux versions distingue ajoutées, supprimées et modifiées, sans fausse suppression d'une ligne regénérée.
8. Un utilisateur qui a généré une version ne peut pas l'approuver.
9. Une annotation ouverte empêche l'approbation.
10. Deux exports d'une même version sont identiques, octet pour octet.
11. Un export ne contient ni annotation, ni marque Azimut.
12. Parcours complet au clavier seul, de l'ouverture à l'approbation.
13. Lisibilité intégrale en niveaux de gris.
14. Aucune violation détectable automatiquement aux niveaux A et AA, résultats incomplets listés pour revue manuelle.

La performance sur un site de plusieurs milliers de lignes suit le budget de rendu mesuré de la section G2. Aucune valeur n'est fixée ici sans mesure.

---

## R19. Décisions arrêtées

Quatre points du cahier des charges, révélés par la rédaction de cette partie, ont été tranchés par Atlas Studio. Chaque décision est reportée dans les sections qu'elle modifie.

| Décision | Reportée en |
| --- | --- |
| L'action en série sur le tableau des messages porte sur la revue, jamais sur le contenu | Section F5bis.3, section R8 |
| Les destinations écartées par la règle M02.W9 sont tracées par les champs `excluded` et `exclusion_reason` de `message_line` | Sections N2.2 et H11, section R9 |
| Chaque support porte un code lisible, `support.code`, unique par site, propriété du module 02 | Sections A5.6, N2.2 et D11, sections R5 et R11 |
| L'émission pour revue exige une validation de complétude du graphe passée | Règle M02.W11, sections R12 et R14 |

Motif de la quatrième décision : faire relire à la maîtrise d'ouvrage un tableau bâti sur un graphe incomplet reviendrait à lui faire valider une erreur.

---

## R20. Limites de périmètre

Les points encore ouverts relèvent du registre de la partie K. Cette partie se borne à préciser ce qu'elle laisse à d'autres sections.

1. **La génération elle-même.** L'algorithme qui produit les lignes relève du moteur, règle M02.W6 et section A7. Cet écran l'affiche, il ne la définit pas.
2. **Les libellés exacts des codes dans les deux langues.** Inscrits au registre, section K3.8.
3. **Les seuils de performance.** Mesurés selon la section G2, non fixés ici.
4. **La valeur probante de l'approbation électronique.** Inscrite au registre, section K3.8.

---

# PARTIE S. Ateliers de conception

Cette partie répond à sept demandes portant sur les ateliers : les vues du plan, les couleurs, les calques, la cotation, les exports, l'édition simultanée et l'assistant. Trois d'entre elles heurtaient des décisions antérieures ; la résolution retenue figure à chaque fois.

---

## S1. Vues du plan

### S1.1 Ce que les termes désignent ici

| Terme | Ce qu'il désigne dans ce document |
| --- | --- |
| Vue en plan, 2D | Projection orthogonale du niveau, vue de dessus, section D5 et vue simplifiée de la section E9.2 |
| Axonométrie | Famille de projections parallèles. L'isométrie en est une |
| Isométrie, 2,5D | Projection à angle fixe des volumes extrudés, section D5.1. C'est ce que le marché appelle 2,5D : un rendu en relief sans navigation |
| 3D | Scène navigable, avec rotation libre du point de vue |

**S-1.** Ces quatre vues dérivent du même modèle : empreintes, altitudes de base et hauteurs. Aucune n'est un fichier à part, aucune ne se dessine à la main.

**S-2.** La projection est automatique, la donnée ne l'est pas. Un plan importé ne produit pas seul une vue en relief : les hauteurs des volumes se saisissent, ou s'héritent d'une valeur par niveau. Ce qui est automatique, c'est le passage du modèle à la vue, et la régénération de toutes les vues à chaque modification.

**S-3.** L'angle de l'isométrie est fixé par site et figé à la publication, section D5.1. La mémoire spatiale de l'usager repose sur la stabilité de l'image.

### S1.2 La 3D, outil de revue et non livrable

**Décision, qui lève en partie celle de la section E3.** L'argument qui écartait la 3D visait le visiteur devant une borne, dont la mémoire spatiale se perd si la vue tourne. Il ne vaut pas pour un concepteur qui vérifie son travail.

**S-4.** La 3D et l'aperçu immersif sont des outils de revue dans l'atelier. Ils servent à contrôler des masques, des hauteurs, une covisibilité, la lisibilité d'un support depuis un point donné.

**S-5.** Ils ne sont jamais une surface visiteur, jamais un livrable, et aucun contrôle normatif ne s'y exécute. Le jugement d'un support se fait sur son exécution, à plat, dans les conditions de lecture du support réel, section F1.2.

**S-6.** La vue 3D ne modifie aucune donnée. Toute édition se fait dans les vues 2D et isométrique.

---

## S2. Couleurs

### S2.1 Le conflit et sa résolution

Repeindre un bloc à la main casse la régénération : la couleur d'une cellule vient de sa catégorie et de la charte, et se recalcule à chaque changement d'occupant. Le besoin, lui, est réel : distinguer des zones en cours de conception, et ajuster les couleurs d'un site.

Deux mécanismes distincts y répondent, et aucun ne casse la régénération.

### S2.2 Palette de catégorie, dans la charte

**S-7.** La couleur d'une catégorie se modifie dans la charte du site, section A5.8. Le changement se propage à tous les plans, toutes les vues et tous les supports qui emploient cette catégorie, et marque périmés ceux qui étaient approuvés, selon l'empreinte de contenu.

C'est la façon prévue de changer la couleur des blocs. Elle est versionnée, traçable, et cohérente d'un livrable à l'autre.

### S2.3 Coloration de travail

**S-8.** Un concepteur peut colorer librement des empreintes, des zones ou des calques pour son propre travail. Cette coloration est propre à l'utilisateur, n'est jamais partagée, n'entre dans aucun livrable, dans aucun export destiné à un tiers et dans aucun paquet de borne.

**S-9.** L'interface indique en permanence qu'une coloration de travail est active, et permet de la retirer d'un geste. Sans cela, un concepteur jugerait un plan sur des couleurs qui n'existent pas.

---

## S3. Calques thématiques

**S-10.** Les objets affichés se répartissent en calques thématiques : plan de fond, empreintes, circulation et parcours, signalétique, publicité, mobilier et habillage, pictogrammes, annotations, esquisse, cotations.

**S-11.** Chaque calque porte sa visibilité à l'écran et sa visibilité à l'impression, qui sont deux réglages distincts. Un calque d'esquisse visible à l'écran ne s'imprime jamais, section E9.

**S-12.** Un calque ne change pas la propriété des données. Il ne fait qu'organiser l'affichage : une empreinte appartient au module 01 qu'elle soit affichée ou non.

---

## S4. Cotation et échelle

**S-13.** L'atelier produit des cotations entre deux éléments désignés, exprimées en mètres, recalculées à toute modification de la géométrie. Une cotation n'est jamais saisie à la main.

**S-14.** Les cotations sont un calque, elles se masquent et s'impriment indépendamment.

**S-15.** Tout plan destiné à l'impression porte une échelle graphique générée, et non une mention d'échelle saisie. Une échelle écrite à la main devient fausse dès qu'une page est redimensionnée.

---

## S5. Exports

**S-16.** Formats de sortie, et ce à quoi chacun sert :

| Format | Usage | Limite |
| --- | --- | --- |
| PDF/X | Fabrication | Le seul format de fabrication, sections A4.7 et D10 |
| PDF/A | Archivage | Versions approuvées et dossiers de livraison |
| SVG | Échange vectoriel, intégration | |
| PNG | Partage rapide, courriel, présentation | **Jamais un livrable de fabrication** |
| Géométrie vers outils de conception assistée | Rendre la géométrie à un architecte ou à un bureau d'études | Format à trancher, section S9 |

**S-17.** Un export en mode point présenté comme un fichier de fabrication est refusé, `EXPORT.RASTER_FOR_FABRICATION`. Un support imprimé depuis une image en mode point est illisible au format d'un totem.

**S-18.** L'export de géométrie porte les empreintes, les volumes et le graphe, avec leurs identifiants stables, dans le repère métier en mètres. Il ne porte ni charte, ni contenu de support, ni donnée personnelle.

---

## S6. Édition simultanée

### S6.1 Ce qui change

**Décision, qui lève l'exclusion de la section G4.1.** L'édition simultanée était écartée parce que fusionner un graphe en temps réel expose à des états topologiquement incohérents. Elle est admise, mais encadrée : ce n'est pas une fusion continue, c'est une propagation de commandes validées.

### S6.2 Règles

**S-19.** Ce qui se propage, ce sont les commandes validées de la section E5.1, jamais un geste en cours ni une saisie caractère par caractère.

**S-20.** Un objet en cours d'édition est verrouillé fermement pour les autres pendant la session, et non plus seulement à titre consultatif, section G4.2. Le verrou tombe à la fin du geste ou à l'expiration.

**S-21.** La validation de complétude du graphe est rejouée après chaque propagation. Un état incohérent bloque la publication et nomme les commandes en cause.

**S-22.** La présence des utilisateurs, leur sélection et leur zone de travail sont visibles. Un concepteur doit voir où travaille un autre avant de s'y heurter.

**S-23.** Le travail hors ligne de la section G8 reste possible. Une session hors ligne ne participe pas à la propagation ; elle se synchronise au retour, avec l'arbitrage des conflits déjà spécifié.

**Charge.** C'est un lot de taille XL, qui ne peut pas entrer en développement sans être découpé, selon la règle de la partie G.

---

## S7. Module 14, assistant de conception

### S7.1 Rôle et frontière

L'assistant propose. Il ne décide jamais, n'écrit jamais directement, et ne se substitue à aucun contrôle.

Ce qu'il fait : proposer l'implantation de supports à partir des points de décision, nommer et catégoriser des repères d'après l'annuaire et la nomenclature, repérer des incohérences que les contrôles ne couvrent pas, suggérer un gabarit, proposer un ordre de lecture pour une face trop chargée.

**Il ne fait jamais**, et la liste est fermée :

**S-24.** Il ne touche pas au registre de sécurité, section A1.2.

**S-25.** Il ne produit aucune valeur d'origine normative. Une hauteur de caractère, un contraste, une dimension de pictogramme viennent du paquet de règles, jamais de lui, section A1.2, invariant 5.

**S-26.** Il n'écrit aucune donnée. Une proposition acceptée est appliquée par la commande du module propriétaire, exactement comme une action humaine, section E5.

**S-27.** Il ne remplace aucun contrôle. Une proposition acceptée passe les mêmes contrôles que toute autre modification, et peut être refusée par eux.

### S7.2 Traçabilité

**S-28.** Chaque proposition est enregistrée avec ce sur quoi elle s'appuie, la date, l'utilisateur à qui elle a été faite, et ce qu'il en a fait. Une proposition refusée n'est pas représentée pour le même geste.

**S-29.** Tout objet issu d'une proposition acceptée porte cette origine. Un audit doit pouvoir dire ce qui a été proposé et ce qui a été décidé par un humain.

**S-30.** L'assistant ne modifie jamais silencieusement son comportement d'une version à l'autre pour un même site : un changement de version est journalisé et visible.

### S7.3 Données, confidentialité, disponibilité

**S-31.** L'assistant s'active par organisation, avec un consentement explicite et révocable. Il est éteint par défaut.

**S-32.** Les plans d'un établissement recevant du public sont des données sensibles. Ce qui lui est transmis est limité au strict nécessaire de la proposition demandée, ne contient aucune donnée personnelle, et n'est jamais employé pour entraîner quoi que ce soit. Cet engagement figure au contrat.

**S-33.** L'assistant exige le réseau. Sans réseau, il s'éteint et le dit ; l'atelier continue de fonctionner sans lui, conformément à la contrainte de connectivité irrégulière des marchés visés. Aucune fonction de l'atelier ne dépend de lui.

**S-34.** Une organisation qui ne le souscrit pas ne voit rien de lui, jamais un bouton grisé.

### S7.4 Place dans l'architecture

Couche 3. Il lit le socle, le wayfinding, les parcours et la signalétique. Aucun module ne le lit. Optionnel, souscrit séparément.

---

## S8. Stationnement

Constat : l'objet `parking` et la géométrie d'une place n'étaient définis nulle part, alors que les contrôles du domaine `PARK` les supposent.

**S-35.** Une place de stationnement est une empreinte de nature `parking_space`. Un parking est une zone de nature `parking`. Ce sont les objets du socle, module 01.

Le type d'une place, accessible ou non, et son repère de travée sont portés par l'extension `parking_space` de la section A5.3, qui étend l'empreinte comme la liaison verticale étend l'arête. Ils ne sont pas des colonnes de l'empreinte générique : ils ne concernent qu'une seule de ses natures.

Le caractère gratuit ou payant d'un parking est un fait déclaré, clé `parking.free`, et non un attribut de la zone : c'est une affirmation qu'un plan d'accueil publie, elle doit donc porter sa source et son statut.

Aucune table propre au stationnement n'existe en dehors de cette extension. En particulier, les portails véhicules ne sont pas modélisés : ils relèveront des accès de livraison, inscrits au registre.

**S-36.** La capacité annoncée d'un parking est un fait du site, avec sa source et son statut, section A5.11. Les contrôles du domaine `PARK` comparent le compte des empreintes de nature `parking_space` à ce fait déclaré.

**S-37.** Une surface de parking non numérisée se déclare comme telle : une empreinte de nature `parking_space` peut être marquée non numérisée, avec le nombre de places qu'elle est censée porter, le motif pour lequel elle ne l'est pas, et sa source. Le nombre et le motif sont deux faits ciblant cette empreinte, clés `parking.undigitized_spaces` et `parking.undigitized_reason`. C'est elle qui explique un écart entre la capacité annoncée et les places comptées. Sans explication déclarée, l'écart lève `PARK.CAPACITY_UNEXPLAINED` ; avec elle, l'écart est admis à concurrence des places déclarées.

**S-38.** Le comptage des places obéit à une règle unique : une empreinte de place vaut une place, sauf si elle est marquée non numérisée, auquel cas elle vaut le nombre déclaré par son fait et ne compte jamais en plus pour elle-même. Sans cette règle, chaque surface non numérisée fausserait le compte d'une unité.

**S-39.** Rendu d'une place de stationnement, dans toutes les vues :

- Plan de niveau et plan orienté : contour léger, sans libellé. Une place ne porte ni occupant ni catégorie, et ne doit pas concurrencer visuellement les cellules commerciales.
- Place accessible : elle porte le pictogramme du registre de sécurité désigné par la fonction d'accessibilité, section A5.4, jamais un symbole maison, section A1.2, invariant 3. Si aucune fonction n'est désignée, la marque est omise et signalée par `PICTO.FUNCTION_NOT_DESIGNATED` : le rendu ne dessine jamais un pictogramme de remplacement.
- Vue isométrique : la place reste au sol, sans volume.
- Plan d'évacuation : elle n'y apparaît pas, sauf si elle porte un cheminement d'évacuation.

**S-40.** Une place de stationnement n'est ni une destination, ni une cellule. Elle n'entre dans aucun quantitatif de signalétique et ne porte pas de code de cellule.

---

## S9. Modèle de données

```sql
view_layer          (id, org_id, site_id, key, name, visible boolean,
                     print_visible boolean, z_order int)
                    key in ('base_plan','footprints','circulation','signage',
                            'advertising','furnishing','pictograms','annotations',
                            'sketch','dimensions')

work_color          (id, org_id, site_id, user_id, target_kind, target_id, hex)
-- Coloration de travail, propre à un utilisateur, jamais exportée.
-- hex : même notation que les jetons de la partie F, six chiffres hexadécimaux
-- précédés d'un croisillon, en majuscules.

dimension_note      (id, org_id, level_id, from_ref jsonb, to_ref jsonb,
                     style_role, created_by, created_at)
-- La longueur est calculée, jamais stockée.

assistant_setting   (id, org_id, enabled boolean, scope jsonb,
                     consented_by, consented_at, revoked_at)

assistant_suggestion (id, org_id, site_id, kind, inputs_digest, payload jsonb,
                     state, created_at, decided_by, decided_at, applied_command_id)
                    state in ('proposed','accepted','rejected','expired')
```

Propriétaires : `view_layer`, `work_color` et `dimension_note` au module 01 ; `assistant_setting` et `assistant_suggestion` au module 14.

---

## S10. Codes d'anomalie ajoutés

| Code | Gravité | Sens |
| --- | --- | --- |
| `EXPORT.RASTER_FOR_FABRICATION` | bloquant | Export en mode point présenté comme fichier de fabrication |
| `EXPORT.GEOMETRY_FORMAT_UNSET` | bloquant | Export de géométrie demandé sans format arrêté |
| `ASSIST.UNAVAILABLE` | information | Assistant indisponible, réseau absent ou option non souscrite |
| `ASSIST.OUT_OF_SCOPE` | bloquant | Proposition touchant le registre de sécurité ou une valeur normative, refusée |
| `DATA.PARKING_SPACE_WITHOUT_ZONE` | avertissement | Place de stationnement hors de toute zone de nature `parking` |

---

## S11. Rattachement

| Élément | Incrément | Taille |
| --- | --- | --- |
| Calques thématiques | 1, avec l'atelier | M |
| Coloration de travail | 1 | S |
| Palette de catégorie dans la charte | 2, avec la charte | S |
| Cotation et échelle générée | 2 | M |
| Exports PNG et géométrie | 2, avec les exécutions | M |
| Vue 3D de revue | 4 | L |
| Édition simultanée | 5 | XL, à découper |
| Module 14, assistant | 5, vendu séparément | XL, à découper |
| Stationnement | 1, avec les empreintes | S |

---

## S12. Ce que cette partie ne couvre pas

Inscrit au registre, section K3.8.

1. **Le format d'export de géométrie.** Le choix entre un format ouvert et un format propriétaire dépend de ce que lisent réellement les outils des clients, et de la bibliothèque disponible. Relève de la procédure d'arrêt et de demande.
2. **Le fournisseur et la nature du modèle de l'assistant.** Un modèle qui change de comportement d'une version à l'autre est incompatible avec la traçabilité exigée en section S7.2 ; le choix doit en tenir compte.
3. **Le régime juridique des données transmises à l'assistant.** Sous-traitance, localisation, durée de conservation, à traiter avec le conseil juridique déjà saisi pour la fidélité.
4. **Le coût d'usage de l'assistant**, qui conditionne son modèle de facturation.
5. **La visite virtuelle.** L'aperçu immersif de la section S1.2 est un outil de revue, pas un produit de visite destiné au public.

---

# ANNEXE T. Consigne T-2.14a, empreinte de contenu et versions de support

Cette consigne suit le format de la partie B du cahier des charges. Les règles de conduite de la section A2 s'appliquent intégralement.

---

## 1. Objectif

Implémenter le calcul de l'empreinte de contenu d'une face, et le cycle de vie des versions de support qui en découle.

À l'issue, le système sait dire exactement quelles faces sont périmées après une modification de donnée, et lesquelles ne le sont pas.

C'est le mécanisme qui fonde la promesse d'exploitation du produit. Sa valeur tient entièrement à sa précision : une empreinte trop large marque tout comme périmé, une empreinte trop étroite laisse passer des supports faux.

---

## 2. Périmètre

**Dans le périmètre**

- `packages/core-model` : fonction de sérialisation canonique, fonction d'empreinte.
- `packages/engine-layout` : calcul de `content_hash` à partir d'une face résolue.
- `packages/db` : migration des colonnes et contraintes de `support_version`, machine à états.
- Tests unitaires et d'intégration correspondants.

**Hors périmètre, à ne pas toucher**

- `composeFace` et sa chaîne de résolution de contenu. Voir la section 7.
- Toute autre table que `support_version`.
- Toute optimisation, harmonisation ou correction repérée au passage.

---

## 3. Composition de l'empreinte

### 3.1 Ce qui entre dans `content_hash`

Rien d'autre que ces sept éléments :

1. Le contenu résolu de la face, bloc par bloc, dans l'ordre des blocs.
2. La clé du gabarit et sa version.
3. L'identifiant de la charte et sa version.
4. Les clés et versions des paquets de règles rattachés au site, socle et surcouche, dans l'ordre de leur rôle.
5. Les langues actives de la face, triées.
6. Les dimensions calculées, largeur et hauteur en millimètres entiers.
7. Les identifiants des pictogrammes référencés, triés.

### 3.2 Ce qui n'entre pas

À exclure explicitement, et un test doit le prouver :

- L'identifiant du support et celui de la face.
- Tout horodatage, quel qu'il soit.
- L'auteur, le validateur, tout identifiant d'utilisateur.
- Le numéro de version.
- Le chemin de stockage d'un artefact.
- L'état de la version.
- L'ordre d'implantation, l'azimut, la distance de lecture. Ils influencent les dimensions calculées, qui sont déjà dans l'empreinte ; les inclure en plus ferait varier l'empreinte sans que le contenu change.

### 3.3 `inputs_hash`, à ne pas confondre

`inputs_hash` sert à l'invalidation du cache de parcours. Il porte les nœuds, arêtes et liaisons verticales du site, plus la définition du profil. Ni destinations, ni supports, ni chartes.

Les deux empreintes ne partagent aucune donnée et ne doivent pas partager de code au-delà de la fonction de sérialisation canonique.

---

## 4. Sérialisation canonique

C'est la partie où une décision implicite casse tout. Elle est donc entièrement spécifiée, il n'y a rien à choisir.

1. Format JSON, encodage UTF-8, aucun espace, aucun retour à la ligne.
2. Clés d'objet triées par ordre lexicographique de points de code.
3. Un champ absent est omis. **Jamais de valeur nulle, jamais de chaîne vide en remplacement d'une absence.** Deux états équivalents doivent produire la même chaîne.
4. Les tableaux ordonnés par le métier conservent leur ordre, blocs d'une face par exemple. Les ensembles sans ordre métier sont triés par identifiant, pictogrammes et langues par exemple.
5. Nombres au format fixe, jamais en notation exponentielle. Dimensions en entiers. Toute autre valeur décimale à trois décimales, arrondie par la fonction d'arrondi unique de `core-model`.
6. Le zéro négatif est interdit en sortie, il est converti en zéro.
7. Les chaînes sont normalisées en forme NFC avant hachage. Les accents du français peuvent être encodés de deux manières, ce qui produirait deux empreintes pour un même texte.
8. Booléens en `true` et `false`, jamais en 0 et 1.
9. Algorithme SHA-256, restitué en hexadécimal minuscule, préfixé `sha256:`.

---

## 5. Machine à états de `support_version`

Les transitions non listées sont interdites et lèvent une erreur.

| De | Vers | Déclencheur | Effet |
| --- | --- | --- | --- |
| `draft` | `draft` | Modification | Recalcule `content_hash` |
| `draft` | `in_review` | Émission d'une épreuve | Fige le contenu et l'empreinte |
| `in_review` | `draft` | Rejet | Motif obligatoire |
| `in_review` | `approved` | Approbation | Écrit une ligne d'approbation |
| `approved` | `superseded` | Nouvelle version approuvée | Automatique |

Règles complémentaires :

- Une version `approved` n'est jamais modifiable. Une correction crée une nouvelle version.
- La table des approbations est en insertion seule, garanti au niveau de la base et non par convention applicative. Une tentative de modification ou de suppression échoue même avec le rôle d'administration.
- Une version `in_review` ou `approved` conserve son empreinte figée. Elle ne se recalcule pas.
- Une face dont le `content_hash` recalculé diffère de celui de la dernière version `approved` est **périmée**. C'est un état dérivé, jamais stocké.

---

## 6. Critères d'acceptation

Chacun se vérifie par un test, pas par une appréciation.

1. **Déterminisme.** La même face sérialisée deux fois produit la même chaîne, octet pour octet, et la même empreinte.
2. **Indépendance à l'ordre d'insertion.** Une face construite en insérant ses pictogrammes dans un ordre, puis dans l'autre, produit la même empreinte.
3. **Exclusions effectives.** Modifier l'identifiant du support, l'horodatage, l'auteur, le numéro de version ou l'état ne change pas l'empreinte. Un test par élément exclu.
4. **Sensibilité.** Modifier le contenu d'un bloc, la version de la charte, la version du paquet de règles, une langue active, une dimension calculée ou un pictogramme change l'empreinte. Un test par élément inclus.
5. **Absence contre valeur nulle.** Une face dont un champ optionnel est absent et une face dont ce champ vaut null produisent la même empreinte.
6. **Normalisation des accents.** Deux écritures Unicode équivalentes d'un même libellé accentué produisent la même empreinte.
7. **Précision de la péremption, critère principal.** Sur un site de référence, modifier une destination et vérifier que le nombre de faces marquées périmées est exactement celui attendu, ni plus ni moins. Le test doit échouer si une face non concernée est marquée.
8. **Machine à états.** Chaque transition autorisée passe, chaque transition non listée lève une erreur avec un code stable.
9. **Insertion seule.** Une tentative de modification et une tentative de suppression d'une ligne d'approbation échouent au niveau de la base, avec le rôle d'administration.
10. **Empreinte figée.** Une version `approved` conserve son empreinte après modification des données sources.

---

## 7. Ce que tu ne fais pas dans cette tâche

**Ne fais pas le rewire de `composeFace`.**

Motif, et il est structurel : le tableau des messages s'intercale entre le graphe et la composition. `composeFace` consommera `message_line`, pas `content_block` directement. Le mapping que tu demandes n'existe pas encore parce que le modèle intermédiaire n'est pas arrêté.

Construire le rewire maintenant reviendrait à le refaire. Tu as d'ailleurs raison de relever qu'aucun producteur de lignes d'instance n'existe : c'est la conséquence du même manque, pas un oubli.

Porte le point en « constaté, non traité » et n'y touche pas.

---

## 8. Cas limites à couvrir

- Face sans aucun bloc.
- Face dont tous les blocs sont vides.
- Face à une seule langue active alors que le site en déclare deux.
- Libellé très long, et libellé contenant des caractères accentués, des apostrophes et des espaces insécables.
- Dimensions calculées nulles ou négatives, qui doivent lever une erreur avant le calcul d'empreinte plutôt que produire une empreinte.
- Paquet de règles absent : l'empreinte ne se calcule pas, une anomalie bloquante est levée.
- Deux faces d'un même support, contenus identiques, gabarits différents : empreintes différentes.
- Deux faces de supports différents, tout identique : empreintes identiques. C'est voulu, l'identifiant du support est exclu.

---

## 9. Rapport attendu

Format de la section A2.6, sans abréviation :

```
Tâche : T-2.14a
Fait : <liste des changements réels>
Fichiers touchés : <liste>
Vérifications : <sortie réelle de pnpm typecheck, lint, test, test:visual>
Constaté, non traité : <inclut le rewire composeFace>
Décisions prises : <liste ou "aucune">
Non vérifié : <liste ou "rien">
```

La sortie réelle des quatre commandes, pas un résumé. Une tâche annoncée terminée sans que les tests aient tourné est la faute la plus grave prévue par ce cahier des charges.

---

# ANNEXE Z. Journal de consolidation

Corrections appliquées lors de la consolidation, chacune vérifiée par une substitution qui devait trouver son texte d'origine exactement le nombre de fois attendu.

Chaque libellé emploie les identifiants en vigueur au moment de l'opération. Les règles de module ont ensuite été renommées avec le numéro de leur module, par exemple M02.W11 pour l'ancienne règle W11 : voir les entrées intitulées « Définitions » et « Renvoi ».

1. Ancienne section A0 remplacée par la nouvelle, document unique
2. INV-2 : résolution depuis le tableau des messages
3. A7.2 : signature de resolveFaceContent
4. T-2.3 : objectif aligné sur le tableau des messages
5. A11.1 : jetons neutres remplacés par les valeurs mesurées
6. A11.1 : couleurs réservées remplacées par les valeurs mesurées
7. A5.1 : rôle marketing ajouté
8. A5.2 : fuseau horaire et entité juridique ajoutés à site
9. A5.6 : scission de propriété de support reportée
10. A5.4 : définition de pictogram fusionnée avec celle de la partie J
11. A5.8 : définition de charter_color remplacée par celle de la partie G
12. Marquage historique C5
13. En-tête D converti en titre de partie
14. D : phrase de préséance retirée
15. D2.1 : liste des domaines alignée sur l'ensemble du document
16. D2.2 : vingt-deux codes manquants catalogués
17. D3.5 : formulation du code d'ambiguïté corrigée
18. Marquage historique D18
19. En-tête E converti en titre de partie
20. E : phrase de préséance retirée
21. E0.1 : dérivation depuis le tableau des messages
22. E1.3 : résolution depuis le tableau des messages
23. Marquage historique E19
24. En-tête F converti en titre de partie
25. F : phrase de préséance retirée
26. F5bis : treize modules
27. F5bis : lignes des modules 12, 13 et de la plateforme ajoutées
28. F5bis.1 : treize modules
29. F5bis.1 : famille propre de l'application visiteur reconnue
30. F19 : treize modules
31. Marquage historique F19
32. En-tête G converti en titre de partie
33. G : phrase de préséance retirée
34. G6.1 : définition de charter_color remplacée par un renvoi à A5.8
35. Marquage historique G10
36. En-tête H converti en titre de partie
37. H : phrase de préséance retirée
38. H1 : renvoi vers la carte complète
39. H2.5 : report dans l'invariant 2 constaté
40. H14 : treize modules
41. Marquage historique H14
42. En-tête I converti en titre de partie
43. I : phrase de préséance retirée
44. I4.4 : chemin du contenu précisé
45. Marquage historique I7
46. En-tête J converti en titre de partie
47. J : phrase de préséance retirée
48. J5.4 : définition de pictogram remplacée par un renvoi à A5.4
49. Marquage historique J10
50. En-tête K converti en titre de partie
51. K3.8 : seize points ouverts ajoutés au registre
52. K4 : préalables de première vente complétés
53. K4 : préalables de première livraison complétés
54. En-tête L converti en titre de partie
55. L : phrase de préséance retirée
56. L0 : report en A5.6 constaté
57. L1 R3 : lecture intra-couche intégrée
58. L2 : plateforme ajoutée
59. L2 : application visiteur ajoutée
60. L6 : plateforme et module 13 ajoutés
61. Marquage historique L7
62. En-tête M converti en titre de partie
63. M : phrase de préséance retirée
64. M0 : treize modules
65. Marquage historique M9
66. En-tête N converti en titre de partie
67. N : phrase de préséance retirée
68. N : périmètre des modules précisé
69. N2.4 : codes catalogués
70. N3.3 : codes catalogués
71. Second fichier de la partie N rattaché à la suite de la partie N
72. Marquage historique N13
73. En-tête O converti en titre de partie
74. O : phrase de préséance retirée
75. Marquage historique O20
76. En-tête P converti en titre de partie
77. P : phrase de préséance retirée
78. P4.4 : nom de table aligné sur le schéma
79. P4.3 : report dans R3 constaté
80. P9 : rôle marketing rattaché à A5.1
81. Marquage historique P17
82. F5bis.3 : action en série limitée à la revue
83. F5bis.3 : renvoi vers la partie R
84. N2.2 : champs de traçabilité de l'écartement
85. N2.2 : code lisible du support
86. N2.3 : règle W11 ajoutée
87. H11 : champs de traçabilité de l'écartement
88. A5.6 : colonne code ajoutée à support
89. A5.6 : code rattaché à l'implantation
90. D11 : nommage fondé sur le code du support
91. K3.8 : point de la spécification du tableau des messages retiré des points ouverts
92. K3.9 : point fermé consigné
93. Partie R ajoutée : écran du tableau des messages, spécification au champ près
94. Partie Q ajoutée : plateforme, rattachement des 32 tables, devises, entité juridique, taxes, incidents
95. M1 : fuseau horaire ajouté au formulaire de création
96. M1 : entité juridique et nom non traduit
97. M2 : critère 3 aligné sur la règle S2
98. M8 : critère 5 reformulé
99. T-1.15 : critère d'accessibilité reformulé
100. A5.2 : exigences de site précisées
101. A5.2 : table des points de calage et unités en pixels explicites
102. D1.1 : règle des pixels précisée
103. N1.3 : règle S2 précisée
104. N1.7 : critère 2 aligné sur la règle S2
105. F14 : portée du contrôle automatique précisée
106. R18 : critère 14 reformulé
107. Q1.3 : règle PL1 alignée
108. Q5 : entité juridique requise avant la première facture
109. Q8 : sens du code aligné
110. Q2 : propriétaire de plan_calibration_point
111. A5.2 : site complété (langues actives, origine du repère, altitude de référence)
112. A5.2 : building complété (largeur d'arête par défaut)
113. A5.2 : footprint complété (code de cellule)
114. A5.4 : destination complétée (historique d'occupation)
115. A5.6 : support complété (niveaux d'information)
116. A5.6 : niveaux d'information rattachés à l'implantation
117. A5.6 : support_typology complété (substrat par défaut, registre)
118. H11 : orientation_zone complétée (empreintes couvertes)
119. H11 : naming_rule complétée (portée d'unicité)
120. H11 : wayfinding_sequence, expected_level retenu
121. N1.2 : origine du repère nommée avec son unité
122. Annexe T : instruction ponctuelle de publication de commit retirée
123. Consigne T-2.14a jointe en annexe
124. Annexe T : accentuation corrigée, vérifiée identique au texte d'origine une fois les accents retirés
125. B1 : tâches T-0.13 à T-0.16 ajoutées
126. B2 : tâches T-1.2b à T-1.2d ajoutées
127. B2 : tâche T-1.16 ajoutée
128. B3 : tâches T-2.17 à T-2.20 ajoutées
129. Valeurs de opening.kind déclarées dans le schéma
130. Valeurs de zone.kind déclarées dans le schéma
131. Valeurs de ad_contract.state déclarées dans le schéma
132. Valeurs de ad_creative.state déclarées dans le schéma
133. Valeurs de ad_invoice.state déclarées dans le schéma
134. Valeurs de subscription.state déclarées dans le schéma
135. Valeurs de subscription_invoice.state déclarées dans le schéma
136. Valeurs de tax_rate.kind déclarées dans le schéma
137. Valeurs de vendor_consultation.state déclarées dans le schéma
138. Valeurs de vendor_offer.state déclarées dans le schéma
139. Valeurs de fabrication_lot.state déclarées dans le schéma
140. Valeurs de fabrication_order.state déclarées dans le schéma
141. Valeurs de provisional_support.state déclarées dans le schéma
142. Valeurs de inspection_finding.kind déclarées dans le schéma
143. Valeurs de inspection_finding.severity déclarées dans le schéma
144. Valeurs de incident.severity déclarées dans le schéma
145. Valeurs de tenant_signage_doc.kind déclarées dans le schéma
146. Valeurs de tenant_signage_rule.kind déclarées dans le schéma
147. Valeurs de kiosk_heartbeat.state déclarées dans le schéma
148. Valeurs de notification.kind déclarées dans le schéma
149. Valeurs de attachment.kind déclarées dans le schéma
150. Valeurs de footprint.kind déclarées dans le schéma
151. Valeurs de information_level.level déclarées dans le schéma
152. Valeurs de message_line.direction déclarées dans le schéma
153. Valeurs de message_schedule.state déclarées dans le schéma
154. Valeurs de naming_rule.target déclarées dans le schéma
155. Valeurs de orientation_zone.kind déclarées dans le schéma
156. Valeurs de user_invitation.role déclarées dans le schéma
157. Valeurs de ad_placement_state.state déclarées dans le schéma
158. Valeurs de tenant_signage_case.state déclarées dans le schéma
159. Valeurs de visitor_emergency_state.scope déclarées dans le schéma
160. E3.4 : bascule de rendu alignée sur le budget mesuré de G2
161. E15 : seuil fixe de 3 000 objets retiré
162. A5.7 : état de la divergence ajouté, section D9.3
163. J5.4 : épaisseur de trait en pourcentage de la grille
164. J3.4 : épaisseur d'esquisse en mètres du repère site
165. Définitions S de N1.3 renommées en M01.S
166. Définitions W de N2.3 renommées en M02.W
167. Définitions P de N3.2 renommées en M03.P
168. Définitions G de N4.3 renommées en M04.G
169. Définitions R de N5.2 renommées en M05.R
170. Définitions T de N6.2 renommées en M06.T
171. Définitions C de N7.2 renommées en M07.C
172. Définitions E de N8.2 renommées en M08.E
173. Définitions B de N9.2 renommées en M09.B
174. Définitions F de N10.2 renommées en M10.F
175. Définitions X de N11.2 renommées en M11.X
176. Définitions A de N12.2 renommées en M12.A
177. Définitions V de P2. renommées en M13.V
178. Définitions PL de Q1.3 renommées en M00.PL
179. Définitions R de L1. renommées en INT-
180. Définitions A de I3. renommées en M12.AS
181. Renvois W renommés en M02.W
182. Renvois S renommés en M01.S
183. Renvoi PL renommé en M00.PL
184. Partie S réinsérée après le renommage des règles
185. Renvoi V1 à V9 renommé
186. Renvoi V2 renommé, section P6.2
187. Renvoi V6 renommé
188. Renvoi V7 renommé
189. Renvoi V2 et V3 renommé, section P8.4
190. Renvoi assistance A5 renommé
191. Renvoi assistances A1 à A5 renommé
192. Renvoi assistances A1 et A4 renommé
193. Renvoi F1 renommé
194. Renvoi G1 renommé
195. Renvoi R2 d'intégration renommé
196. Renvoi R3 d'intégration renommé
197. Renvoi R3 d'intégration renommé, second
198. D2.2 : sens de RULES.PACK_NOT_BOUND précisé
199. M1 : gravité unique de RULES.PACK_NOT_BOUND, plus d'avertissement à la création
200. R12 : génération alignée sur la section N2.8
201. R14 : RULES.PACK_NOT_BOUND bloque l'émission pour revue
202. H11 : table message_schedule_approval ajoutée
203. L3 : module 02 propriétaire de message_schedule_approval
204. R12 : motif de rejet enregistré
205. R12 : ligne d'approbation dans la table du module 02
206. A5.3 : table graph_validation ajoutée
207. L3 : module 01 propriétaire de graph_validation
208. M5 : passage de validation enregistré
209. N2.3 : règle M02.W11 fondée sur graph_validation
210. A12.3 : insertion seule étendue aux deux nouvelles tables
211. N2.3 : règle M02.W12, appartenance calculée à une zone
212. R6.2 : filtre Bâtiment dérivé du nœud
213. R6.2 : filtre Zone d'orientation fondé sur M02.W12
214. Q9 : référentiel des pays ajouté
215. Q2 : propriétaire de la table country
216. M1 : pays issus du référentiel
217. M1 : fuseaux issus du référentiel
218. M1 : entité juridique affichée sous condition
219. A12.3 : insertion seule définie, avec l'unique exception de la purge
220. A5.11 : règle de suppression ajoutée
221. O15 : purge explicite et ordonnée
222. Q9.2 : colonne default_currency_code en attente de son fichier
223. K3.8 : correspondance pays vers devises inscrite au registre
224. A6.2 : rôle marketing ajouté au tableau des droits
225. A5.1 : sept rôles
226. T-0.5 : sept rôles
227. L7 : sept rôles
228. N13 : sept rôles
229. O3 : sept rôles
230. M8 : critère 4 rattaché au protocole de mesure D13
231. K3.8 : calage à n points avec résidu inscrit comme amélioration possible
232. N1.3 : règle M01.S10 sur les liaisons entre bâtiments
233. D2.2 : quatre codes de graphe ajoutés
234. D2.2 : trois codes de données ajoutés
235. M1bis : écran de fiche de site spécifié
236. N1.5 : fiche de site renvoyée vers M1bis
237. M4 : largeur d'arête héritée du bâtiment
238. C1 : site de référence portant des liaisons inter-bâtiments
239. D7.1 : réserve sur les liaisons entre bâtiments dans l'empreinte
240. D2.1 : domaine DOC ajouté
241. D2.1 : domaine EXPORT ajouté
242. D2.1 : domaine PARK ajouté
243. A7 : règle de refus d'une entrée invalide par les moteurs
244. A5.11 : faits du site avec source et statut
245. Q2 : propriétaire de site_fact
246. M2 : calage à n points adopté
247. K3.8 : point du calage à n points fermé, adopté en section M2
248. K3.9 : calage à n points consigné comme fermé
249. A5.8 : règles de charte pour le style de texte
250. D3.6 : règle pays non comparable refusée
251. D2.2 : 93 codes inscrits au catalogue
252. A5.8 : contrôle non exécuté quand la charte ne porte pas la règle
253. D2.1 : domaine CHARTER rétabli
254. D2.2 : code CHARTER.RULE_MALFORMED inscrit
255. A5.11 : distinction entre statut d'un fait et statut d'un objet
256. G4.1 : exclusion de l'édition simultanée levée par la partie S
257. A5.2 : nature parking_space ajoutée aux empreintes
258. L2 : module 14 placé en couche 3
259. A0 : partie S au sommaire
260. Q2 : propriétaires des tables de la partie S
261. K3.8 : quatre points ouverts de la partie S inscrits
262. Partie S ajoutée : ateliers de conception, vues, couleurs, calques, cotation, exports, édition simultanée, assistant
263. A5.11 : un fait du site peut désigner un objet
264. A5.2 : une zone porte ses empreintes
265. S8 : surface de parking non numérisée spécifiée
266. M3 : nature place de stationnement ajoutée à l'écran
267. S9 : notation de la couleur de travail fixée
268. A5.11 : convention de clé des faits, avec type attendu et cible
269. A5.3 : extension parking_space d'une empreinte
270. S8 : extension, gratuité et retrait des portails
271. K3.8 : portails véhicules inscrits comme besoin possible
272. Q2 : propriétaire de l'extension parking_space
273. S8 : comptage des places non numérisées et rendu d'une place
274. A5.4 : désignation de fonction d'un pictogramme
275. D2.2 : deux codes de désignation de fonction
276. S-39 : marque d'accessibilité fondée sur la désignation de fonction
277. K3.8 : grille des pictogrammes et poids du paquet inscrits
278. A5.4 : portée d'unicité d'une fonction de pictogramme
279. A5.11 : clé du motif d'une surface non numérisée
280. S-37 : motif d'une surface non numérisée
281. A5.4 : paquet obligatoire pour un pictogramme de sécurité
282. A5.8 : rattachement à deux paquets, avec rôle et précédence
283. A5.2 : rattachement aux paquets retiré de la table des sites
284. D2.2 : avertissement sur le motif d'une surface non numérisée
285. D7.1 : l'empreinte porte le socle et la surcouche
286. Annexe T : composition de l'empreinte alignée sur D7.1
287. A8 : portée de la limite de 400 lignes précisée
288. D7.2 : forme canonique de l'empreinte précisée
289. D10.0 : le paquet agrège les anomalies et bloque sur une marque de sécurité omise
290. D7.2 : la forme canonique vaut pour toutes les empreintes
