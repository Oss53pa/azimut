# Cahier des charges de développement
## Azimut, logiciel de conception signalétique et de parcours d'orientation pour ERP

Éditeur : Atlas Studio
Document destiné à l'agent de développement et à toute personne intervenant sur le code.

---

## A0. Comment lire ce document

Ce document a deux natures.

La **partie A** est un socle permanent. Elle décrit ce qui ne change pas d'un incrément à l'autre : pile technique, structure, modèle de données, contrats, conventions, règles de qualité et règles de conduite. Elle s'applique à toute tâche, sans exception, y compris aux tâches non listées ici.

La **partie B** est le découpage en lots de développement. Sa précision décroît volontairement avec l'horizon : tâches détaillées pour les incréments 0 à 2, lots pour les incréments 3 et 4, exigences pour les incréments 5 et 6. Un lot lointain sera détaillé quand il deviendra le lot suivant, pas avant.

La **partie C** rassemble les annexes opérationnelles.

Règle de préséance en cas de contradiction : partie A > partie B > commentaire dans le code > habitude.

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
Le contenu d'une face de support est résolu depuis le graphe et l'annuaire au moment du rendu. Il n'est jamais saisi librement, sauf pour les blocs explicitement typés comme libres.

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
                    role in ('admin','designer','owner_rep','vendor','operator','auditor')
```

`role` correspond aux six rôles définis en A6.2.

### A5.2 Site et géométrie

```sql
site                (id, org_id, name, country_code, rules_pack_id, created_at, updated_at, deleted_at)
building            (id, org_id, site_id, name, independent_access boolean, opening_hours jsonb)
level               (id, org_id, building_id, name, ordinal int, elevation_m numeric)
zone                (id, org_id, level_id, name, kind)

plan_source         (id, org_id, level_id, storage_path, media_type, uploaded_at)
plan_calibration    (id, org_id, plan_source_id, scale_m_per_px numeric,
                     origin_x numeric, origin_y numeric, rotation_deg numeric)

footprint           (id, org_id, level_id, geometry jsonb, kind)
                    geometry = polygone en coordonnées métier, mètres
volume              (id, org_id, footprint_id, base_elevation_m numeric,
                     height_m numeric, material_key)
opening             (id, org_id, footprint_id, position jsonb, width_m numeric, kind)
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
                    kind in ('elevator','stair','escalator','ramp')

building_link       (id, org_id, edge_id, from_building_id, to_building_id, sheltered boolean)
```

Contrainte : `edge.length_m` est calculé, jamais saisi. Une arête relie deux nœuds distincts. Une arête entre deux niveaux différents doit avoir une ligne `vertical_link`.

### A5.4 Destinations

```sql
category            (id, org_id, sector_key, code, parent_id)
pictogram           (id, org_id, category_id, source, standard_ref, svg_path, registry)
                    registry in ('safety','wayfinding')
destination         (id, org_id, footprint_id, node_id, category_id,
                     occupant_name, occupancy_status, display_priority int)
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
support             (id, org_id, site_id, node_id, typology_id,
                     azimuth_deg numeric, reading_distance_m numeric,
                     width_mm int, height_mm int, dimensions_source,
                     substrate_key, mounting jsonb, registry,
                     created_at, updated_at, deleted_at)
                    dimensions_source in ('computed','overridden')
                    registry in ('safety','wayfinding')

support_typology    (id, org_id, key, name, face_count int, template_key)

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

divergence          (id, org_id, support_id, kind, detected_at, resolved_at, detail jsonb)
                    kind in ('outdated_content','wrong_orientation','undersized',
                             'missing','superfluous','damaged')

work_order          (id, org_id, site_id, scope jsonb, estimated_cost numeric,
                     currency, state, created_at, closed_at)
                    state in ('draft','issued','in_progress','done','cancelled')
```

### A5.8 Chartes et règles

```sql
charter             (id, org_id, site_id, name, version, created_at)
charter_color       (id, org_id, charter_id, key, hex, usage)
charter_typeface    (id, org_id, charter_id, key, family, weight, min_size_mm)
charter_rule        (id, org_id, charter_id, kind, params jsonb)
                    kind in ('adjacency_forbidden','min_logo_width','background_allowed',
                             'proportion','signature_usage')
lexicon_term        (id, org_id, charter_id, lang, term, severity)
                    severity in ('forbidden','discouraged')

rules_pack          (id, key, version, jurisdiction, effective_from, source_ref, checksum)
rules_pack_rule     (id, rules_pack_id, code, scope, params jsonb, source_ref)
site_rules_binding  (id, org_id, site_id, rules_pack_id, bound_at)
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

### A7.1 engine-graph

- `validateGraph(site)` : complétude. Détecte nœuds orphelins, zones inatteignables, destinations non reliées, impasses non justifiées, niveaux sans liaison verticale accessible, arêtes de longueur nulle, graphe non connexe.
- `computeRoute(graph, profile, from, to)` : plus court chemin pondéré.
- `deriveDecisionPoints(graph, profile, destinations)` : nœuds où le parcours offre plus d'un choix.
- `auditCoverage(graph, profile, supports)` : points de décision non couverts, supports ne servant aucun parcours.
- `auditEvacuation(graph)` : couverture des cheminements d'évacuation.
- `auditAccessibility(graph, profile)` : destinations non atteignables par un profil accessible.

Règle : `auditCoverage` refuse de produire un taux si `validateGraph` n'est pas passé. Application de l'exigence de complétude.

### A7.2 engine-layout

- `resolveFaceContent(face, graph, directory, langs)` : résolution du contenu depuis le graphe.
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
- Fichiers de 400 lignes maximum. Fonctions de 50 lignes maximum.
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
surface-page      #FBFAF8
surface-panel     #FFFFFF
border            #E3DFD8
text-primary      #1C1F24
text-secondary    #6B7280
accent            #17457A
accent-secondary  #2D7A6B
```

Couleurs réservées, communes à tous les thèmes, à usage sémantique exclusif :

```
state-blocking    #C2352B
state-warning     #C77D14
state-valid       #2E7D4F
state-info        #2B6CB0
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

`audit_log` et `approval` sont en insertion seule, garanti par politique en base et non par convention applicative. Toute tentative de modification ou de suppression échoue au niveau de la base.

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
Objectif : Supabase Auth, table des membres, six rôles de A6.2.
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
Acceptation : conformité AA vérifiée automatiquement sur les écrans livrés. Aucune couleur hors jetons.

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
Objectif : `resolveFaceContent` depuis le graphe et l'annuaire.
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
| `ref-retail` | Commerce multibâtiment, 5 niveaux | Accès indépendants, lobby commun, horaires distincts par bâtiment |
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

Écrit ici pour que personne ne le découvre plus tard.

1. Les versions de bibliothèques de A3.1 sont celles connues à la rédaction. Elles doivent être confirmées au démarrage.
2. Les seuils de performance repris du plan de conception ne reposent sur aucune mesure. Ce sont des cibles, à réviser après le premier site réel modélisé.
3. La charge des tâches n'est pas estimée. Ce document décrit ce qu'il faut faire et comment le vérifier, pas combien de temps cela prend.
4. Le comportement exact des politiques de cloisonnement sur les requêtes agrégées et les jointures profondes demande une validation empirique, pas une lecture de documentation.
5. La faisabilité du déterminisme strict à l'octet sur la sortie PDF dépend de la bibliothèque retenue et n'est pas acquise. C'est un critère de la décision T-0.9.
